"use client";
/* Folha "Conciliar agora" (M23 código do autenticador, M23-r resultado, M23-w espera): Master-pagamentos--folha-conciliar-*.html.
   Fluxo: se a sessão não tem aal2, pede o código de 6 dígitos do app autenticador (TOTP); confirma; chama `admin_request_reconcile` (via a função
   `payments-reconcile-now`, que só então fala com o provedor); mostra o resultado. Uma conciliação manual por minuto: antes disso, a espera com contagem regressiva. */
import { useCallback, useEffect, useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { reconcileNow, type ReconcileOutcome } from "@/lib/master/reconcile";
import { Ico } from "../master-kit";
import { ErrLine } from "./ActionSheet";
import { MasterModal, ModalButtons } from "./MasterModal";

export const RECONCILE_WAIT_SECONDS = 60;
const OTP_LENGTH = 6;

export interface ReconcileResult {
  confirmed: number;
  failed: number;
  /** "Sem mudança": a função ainda não devolve (pendência da onda de Pagamentos); sem valor, o cartão mostra "—". */
  unchanged?: number;
  /** "hoje 08:51" (hora da conciliação). */
  at?: string;
  /** "4 s". */
  tookSeconds?: number;
  /** Falhas por pedido ("#RV-2039 · Formatura Medicina" + o motivo). */
  failures?: { label: string; message: string }[];
}

/** "00:57" para a contagem e para "Próxima conciliação manual liberada em". */
export const clock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const two = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

export type ReconcileStep =
  | { step: "code"; error?: string; busy?: boolean }
  | { step: "running" }
  | { step: "result"; result: ReconcileResult; nextIn: number }
  | { step: "wait"; remaining: number; last?: string }
  | { step: "error"; message: string };

export interface UseReconcileArgs {
  /** A sessão já está em aal2? Padrão: pergunta ao Auth. */
  hasSecondFactor?: () => Promise<boolean>;
  /** Confere o código do autenticador. Devolve false se errado. Padrão: TOTP do Supabase. */
  verifyCode?: (code: string) => Promise<"ok" | "wrong" | "no-factor">;
  /** Dispara a conciliação. Padrão: `payments-reconcile-now`. */
  reconcile?: () => Promise<ReconcileOutcome>;
  /** "Última: hoje 08:51, por marcos@revela.app" quando a espera é anterior a esta tela. */
  last?: string;
  onDone?: () => void;
  /** Relógio (testes). */
  now?: () => number;
}

async function defaultHasSecondFactor(): Promise<boolean> {
  const lvl = await browserSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
  return lvl.data?.currentLevel === "aal2";
}
async function defaultVerify(code: string): Promise<"ok" | "wrong" | "no-factor"> {
  const mfa = browserSupabase().auth.mfa;
  const factorId = (await mfa.listFactors()).data?.totp.find((f) => f.status === "verified")?.id;
  if (!factorId) return "no-factor";
  const v = await mfa.challengeAndVerify({ factorId, code });
  return v.error ? "wrong" : "ok";
}

/** Máquina da folha: código → resultado | espera. `start()` abre (pula o código se já há aal2); `submitCode()` confirma. */
export function useReconcile({ hasSecondFactor = defaultHasSecondFactor, verifyCode = defaultVerify, reconcile = reconcileNow, last, onDone, now = Date.now }: UseReconcileArgs = {}) {
  const [state, setState] = useState<ReconcileStep | null>(null);
  const until = useRef(0);

  const run = useCallback(async () => {
    const t0 = now();
    const o = await reconcile();
    if (o.kind === "ok") {
      until.current = now() + RECONCILE_WAIT_SECONDS * 1000;
      setState({ step: "result", result: { confirmed: o.confirmed, failed: o.failed, tookSeconds: Math.max(1, Math.round((now() - t0) / 1000)) }, nextIn: RECONCILE_WAIT_SECONDS });
      onDone?.();
    } else if (o.kind === "ratelimited") {
      until.current = now() + RECONCILE_WAIT_SECONDS * 1000;
      setState({ step: "wait", remaining: RECONCILE_WAIT_SECONDS, last });
    } else if (o.kind === "stepup") {
      setState({ step: "code", error: undefined });
    } else {
      setState({ step: "error", message: o.kind === "forbidden" ? "Sem permissão para conciliar." : "A conciliação imediata está indisponível. A rotina automática confirma em até 5 minutos." });
    }
  }, [now, reconcile, last, onDone]);

  const start = useCallback(async () => {
    try {
      if (await hasSecondFactor()) { setState({ step: "running" }); await run(); }
      else setState({ step: "code" });
    } catch { setState({ step: "error", message: "Não foi possível conciliar agora. Tente de novo." }); }
  }, [hasSecondFactor, run]);

  const submitCode = useCallback(async (code: string) => {
    const clean = code.replace(/\s/g, "");
    if (clean.length !== OTP_LENGTH) { setState({ step: "code", error: "Digite os 6 números do aplicativo." }); return; }
    setState({ step: "code", busy: true });
    try {
      const v = await verifyCode(clean);
      if (v === "no-factor") { setState({ step: "code", error: "Cadastre o autenticador antes (ele é pedido ao publicar preços em Planos)." }); return; }
      if (v === "wrong") { setState({ step: "code", error: "Código incorreto. Tente de novo." }); return; }
      await run();
    } catch { setState({ step: "code", error: "Não foi possível confirmar agora. Tente de novo." }); }
  }, [verifyCode, run]);

  // contagem regressiva: a cada segundo recalcula pelo relógio (não acumula erro) e, ao zerar na espera, volta ao código/pedido
  const counting = state?.step === "result" || state?.step === "wait";
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((until.current - now()) / 1000));
      setState((s) => (s?.step === "result" ? { ...s, nextIn: left } : s?.step === "wait" ? { ...s, remaining: left } : s));
    }, 1000);
    return () => clearInterval(id);
  }, [counting, now]);

  return { state, start, submitCode, close: () => setState(null) };
}

export interface ReconcileSheetProps {
  state: ReconcileStep;
  onSubmitCode: (code: string) => void;
  onClose: () => void;
  inline?: boolean;
  /** Código já digitado (telas de comparação). */
  initialCode?: string;
}

/** Os seis quadros do código: o campo real é um só, invisível por cima dos quadros (digitar, colar e preenchimento automático funcionam); os quadros só mostram. */
function Otp({ value, onChange, error, busy }: { value: string; onChange: (v: string) => void; error?: boolean; busy?: boolean }) {
  const digits = value.padEnd(OTP_LENGTH, " ").split("");
  const at = Math.min(value.length, OTP_LENGTH - 1);
  return (
    <div className={`otp${error ? " otp--err" : ""}`} style={{ position: "relative" }}>
      {digits.map((d, i) => <span key={i} className={i === at ? "on" : ""} aria-hidden="true">{d}</span>)}
      <input aria-label="Código do app autenticador" inputMode="numeric" autoComplete="one-time-code" maxLength={OTP_LENGTH} value={value} disabled={busy}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "text" }} />
    </div>
  );
}

export function ReconcileSheet({ state, onSubmitCode, onClose, inline, initialCode = "" }: ReconcileSheetProps) {
  const [code, setCode] = useState(initialCode);
  if (state.step === "code") {
    return (
      <MasterModal label="Conciliar agora" inline={inline} onClose={state.busy ? undefined : onClose}>
        <h2 className="rv-title">Conciliar agora</h2>
        <p className="rv-caption" style={{ marginTop: "6px" }}>Consulta na ValidaPay as cobranças abertas e acerta os pedidos. Esta sessão ainda não confirmou o segundo fator.</p>
        <p className="rv-caption" style={{ margin: "18px 0 8px" }}>Código do app autenticador</p>
        <Otp value={code} onChange={setCode} error={!!state.error} busy={state.busy} />
        {state.error && <ErrLine>{state.error}</ErrLine>}
        <ModalButtons>
          <button type="button" className="rv-btn rv-btn--block" style={{ flex: 1 }} onClick={onClose} disabled={state.busy}>Cancelar</button>
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" style={{ flex: 1 }} disabled={code.length !== OTP_LENGTH || state.busy} aria-busy={state.busy || undefined} onClick={() => onSubmitCode(code)}>
            {state.busy ? "Conciliando…" : "Conciliar"}
          </button>
        </ModalButtons>
      </MasterModal>
    );
  }
  if (state.step === "running") {
    return (
      <MasterModal label="Conciliar agora" inline={inline}>
        <h2 className="rv-title">Conciliar agora</h2>
        <p className="rv-caption" style={{ marginTop: "6px" }} role="status">Consultando a ValidaPay…</p>
      </MasterModal>
    );
  }
  if (state.step === "wait") {
    return (
      <MasterModal label="Aguarde um pouco" inline={inline} onClose={onClose}>
        <h2 className="rv-title">Aguarde um pouco</h2>
        <p className="rv-caption" style={{ marginTop: "6px" }}>A conciliação manual só pode rodar uma vez por minuto.</p>
        <div className="countdown" style={{ marginTop: "18px" }} role="timer" aria-label={`Faltam ${clock(state.remaining)}`}>
          <div><b>{two(state.remaining / 60)}</b><span>min</span></div>
          <div><b>{two(state.remaining % 60)}</b><span>seg</span></div>
        </div>
        <p className="rv-caption" style={{ marginTop: "12px" }}>{state.last ? `Última: ${state.last}. ` : ""}A conciliação automática continua rodando.</p>
        <ModalButtons>
          <button type="button" className="rv-btn rv-btn--block" style={{ flex: 1 }} onClick={onClose} data-autofocus>Fechar</button>
        </ModalButtons>
      </MasterModal>
    );
  }
  if (state.step === "error") {
    return (
      <MasterModal label="Conciliar agora" inline={inline} onClose={onClose}>
        <h2 className="rv-title">Conciliar agora</h2>
        <ErrLine>{state.message}</ErrLine>
        <ModalButtons><button type="button" className="rv-btn rv-btn--block" style={{ flex: 1 }} onClick={onClose} data-autofocus>Fechar</button></ModalButtons>
      </MasterModal>
    );
  }
  const r = state.result;
  return (
    <MasterModal label="Conciliação concluída" inline={inline} onClose={onClose}>
      <h2 className="rv-title">Conciliação concluída</h2>
      <p className="rv-caption" style={{ marginTop: "6px" }}>{[r.at, r.tookSeconds !== undefined ? `levou ${r.tookSeconds} s` : undefined].filter(Boolean).join(" · ")}</p>
      <div className="tiles">
        <div className="tile"><span>Conciliados</span><b>{r.confirmed}</b></div>
        <div className="tile"><span>Falhas</span><b>{r.failed}</b></div>
        <div className="tile"><span>Sem mudança</span><b>{r.unchanged ?? "—"}</b></div>
      </div>
      {!!r.failures?.length && (
        <div className="rv-group" style={{ marginTop: "14px" }}>
          {r.failures.map((f) => (
            <div className="rv-row" key={f.label}><Ico n="warn" /><div className="rv-row__text">{f.label}<span className="rv-row__meta">{f.message}</span></div></div>
          ))}
        </div>
      )}
      {state.nextIn > 0 && <p className="rv-caption" style={{ marginTop: "12px" }}>Próxima conciliação manual liberada em {clock(state.nextIn)}.</p>}
      <ModalButtons><button type="button" className="rv-btn rv-btn--block" style={{ flex: 1 }} onClick={onClose} data-autofocus>Fechar</button></ModalButtons>
    </MasterModal>
  );
}
