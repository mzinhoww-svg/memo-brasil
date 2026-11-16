"use client";
/* Folha "Revelar agora" (M25, M25-a, M25-b): Master-revelar-agora--folha*.html. UMA folha para o Master (Revelações, detalhe do evento) e para o painel do anfitrião (17c).
   A regra é a do servidor (RPC `reveal_now`: revela uma vez só, grava a auditoria, enfileira o e-mail uma vez). O botão principal, em destaque, é
   "Manter a hora"; "Revelar mesmo assim" só liga com motivo de 10 a 500 caracteres. As mensagens de recusa são as do servidor, como estão. */
import { useCallback, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { reasonValid } from "@/lib/master/reason";
import { Ico } from "../master-kit";
import { ErrLine, ReasonField, useReasonField } from "./ActionSheet";
import { MasterModal, ModalButtons } from "./MasterModal";

export type RevealFailure = "revealed" | "invalid" | "forbidden" | "reason" | "unknown";
export type RevealOutcome = { ok: true } | { ok: false; failure: RevealFailure };

/** Mensagens das recusas, exatamente as do desenho (M25-a, M25-b e a de permissão). */
export const REVEAL_MESSAGES: Record<RevealFailure, string> = {
  revealed: "Este evento já foi revelado.",
  invalid: "Evento sem revelação ligada.",
  forbidden: "Sem permissão",
  reason: "Escreva o motivo com 10 a 500 caracteres.",
  unknown: "Não foi possível revelar agora. Tente de novo.",
};

/** Código de erro da RPC → recusa (MM008 já revelado · MM005 sem revelação ligada ou evento excluído · MM004 sem permissão · MM011 motivo). */
export function revealFailureOf(code: string | undefined, message = ""): RevealFailure {
  if (code === "MM008" || /revealed/.test(message)) return "revealed";
  if (code === "MM005" || /invalid/.test(message)) return "invalid";
  if (code === "MM004" || /forbidden/.test(message)) return "forbidden";
  if (code === "MM011" || /reasonrequired/.test(message)) return "reason";
  return "unknown";
}

/** Chama `reveal_now` com a sessão de quem está logado (anfitrião do evento ou master). */
export async function revealNowRpc(eventId: string, reason: string): Promise<RevealOutcome> {
  const { error } = await browserSupabase().rpc("reveal_now", { p_event: eventId, p_reason: reason });
  return error ? { ok: false, failure: revealFailureOf(error.code, error.message) } : { ok: true };
}

export interface UseRevealNowArgs {
  eventId: string;
  /** Troca o envio (o painel do anfitrião no modo local usa o repositório; testes). Padrão: a RPC. */
  send?: (eventId: string, reason: string) => Promise<RevealOutcome>;
  onDone?: () => void;
  /** Recusa já mostrada ao abrir (telas de comparação /dev/revela). */
  initialFailure?: RevealFailure;
}

/** Handler da folha: valida o motivo, envia e traduz a recusa para a mensagem do servidor. */
export function useRevealNow({ eventId, send = revealNowRpc, onDone, initialFailure }: UseRevealNowArgs) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialFailure ? REVEAL_MESSAGES[initialFailure] : null);
  const submit = useCallback(async (reason: string) => {
    if (!reasonValid(reason)) { setError(REVEAL_MESSAGES.reason); return false; }
    setBusy(true);
    setError(null);
    try {
      const r = await send(eventId, reason.trim());
      if (!r.ok) { setError(REVEAL_MESSAGES[r.failure]); return false; }
      onDone?.();
      return true;
    } catch {
      setError(REVEAL_MESSAGES.unknown);
      return false;
    } finally {
      setBusy(false);
    }
  }, [eventId, send, onDone]);
  return { busy, error, submit };
}

export interface RevealNowSheetProps extends UseRevealNowArgs {
  eventTitle: string;
  /** "Hora prevista" já formatada (ex.: "dom, 15 mar 2027 12:00"). */
  plannedAt: string;
  /** "Avisos que serão enviados" (ex.: "21 e-mails, de uma vez"); sem valor, a linha não aparece (o painel do anfitrião não conhece os avisos). */
  notices?: string;
  /** Legenda do desenho. */
  caption?: string;
  /** Fecha sem revelar ("Manter a hora"). */
  onClose: () => void;
  initialReason?: string;
  inline?: boolean;
}

export function RevealNowSheet({ eventTitle, plannedAt, notices, caption = "A mesma folha é usada pelo anfitrião, no painel do evento.", onClose, initialReason = "", inline, ...args }: RevealNowSheetProps) {
  const { busy, error, submit } = useRevealNow({ ...args, onDone: () => { args.onDone?.(); onClose(); } });
  const f = useReasonField(initialReason);
  return (
    <MasterModal label="Revelar agora" width={520} inline={inline} onClose={busy ? undefined : onClose}>
      <h2 className="rv-title">Revelar agora</h2>
      <p className="rv-caption" style={{ marginTop: "6px" }}>{caption}</p>
      <div className="kv">
        <div><span>Evento</span><b>{eventTitle}</b></div>
        <div><span>Hora prevista</span><b>{plannedAt}</b></div>
        {notices !== undefined && <div><span>Avisos que serão enviados</span><b>{notices}</b></div>}
      </div>
      <div className="mnote" style={{ margin: "14px 0 0" }}>
        <Ico n="spark" />
        <span>Revelar antes tira a graça: os convidados estão esperando a hora combinada. Não dá para desfazer.</span>
      </div>
      <ReasonField value={f.reason} onChange={f.setReason} disabled={busy} />
      {error && <ErrLine>{error}</ErrLine>}
      <ModalButtons>
        <button type="button" className="rv-btn rv-btn--block" style={{ flex: 1 }} onClick={onClose} disabled={busy} data-autofocus>Manter a hora</button>
        <button type="button" className="rv-btn rv-btn--block rv-btn--line" style={{ flex: 1, color: "var(--danger)" }} disabled={!f.valid || busy} aria-busy={busy || undefined} onClick={() => void submit(f.reason)}>
          {busy ? "Revelando…" : "Revelar mesmo assim"}
        </button>
      </ModalButtons>
    </MasterModal>
  );
}
