"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { ReasonField } from "../billing-actions";
import { browserSupabase } from "@/lib/supabase/client";
import { MasterPlanosView, type PlanoRow, type PreviewPlan } from "@/revela/screens/MasterPlanos";
import { PublicarModal, type PublicarDiff } from "@/revela/screens/MasterPlanoPublicar";
import { adminErrorText, brl, parseBrl, reasonError } from "../billing";
import { FIELD_LABEL, IMPACT_TEXT, diffPlans, draftErrors, setHighlight, showValue, slugify, toChanges, type PlanRow } from "../prices";

type Env = "sandbox" | "production";
/** Pedidos por plano: quantos já foram pagos e quantos Pix estão abertos (mantêm o valor cotado). */
export type PlanImpact = Record<string, { paid: number; open: number }>;

const money = (cents: number) => (cents % 100 === 0 ? `R$ ${cents / 100}` : brl(cents));
const PLAN_W = 96, GAP = 8, VIEW = 248;

/** Prévia do paywall como o anfitrião vê, já com os valores ainda não publicados (só planos ativos no ambiente). */
export function previewOf(plans: PlanRow[], env: Env): { plans: PreviewPlan[]; cta: string; shift: number } {
  const visible = plans.filter((p) => p.isFree || (env === "sandbox" ? p.sandboxActive : p.productionActive)).sort((a, b) => a.sort - b.sort);
  const chosen = visible.find((p) => p.highlighted) ?? visible[visible.length > 1 ? 1 : 0];
  const idx = Math.max(0, visible.findIndex((p) => p.code === chosen?.code));
  const total = visible.length * PLAN_W + Math.max(0, visible.length - 1) * GAP;
  return {
    plans: visible.map((p, i) => ({
      code: p.code, tier: p.name, price: p.isFree ? "Grátis" : money(p.priceCents),
      note: [p.maxGuests == null ? "convidados sem limite" : `${p.maxGuests} convidados`, p.maxShots == null ? "poses livres" : `${p.maxShots} poses cada`],
      on: p.code === chosen?.code, gold: !p.isFree && i === visible.length - 1 && visible.length > 2,
    })),
    cta: chosen ? `Continuar${chosen.isFree ? "" : ` · ${money(chosen.priceCents)}`}` : "Continuar",
    shift: Math.max(0, Math.min(idx * (PLAN_W + GAP) - 162, total - VIEW)),
  };
}

/** M04: de → para, impacto e o código do autenticador (TOTP, segundo fator) antes de publicar. */
function ConfirmModal({ original, draft, impact, onClose, onDone }: { original: PlanRow[]; draft: PlanRow[]; impact: PlanImpact; onClose: () => void; onDone: () => void }) {
  const diffs = useMemo(() => diffPlans(original, draft), [original, draft]);
  const [reason, setReason] = useState("");
  const [reasonConfirmed, setReasonConfirmed] = useState(false);
  const [code, setCode] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{ factorId: string; uri: string; secret: string } | null>(null);
  const [needEnroll, setNeedEnroll] = useState(false);
  const rErr = tried ? reasonError(reason) : null;

  const shown: PublicarDiff[] = diffs.flatMap((d) => d.changes
    .filter((c) => (d.isNew ? ["priceCents", "maxGuests", "maxShots"].includes(c.field) : true))
    .map((c) => ({ label: c.field === "priceCents" ? `${d.name}${d.isNew ? " (plano novo)" : ""}` : `${d.name} · ${FIELD_LABEL[c.field]}`, from: d.isNew ? "—" : showValue(c.field, c.from), to: showValue(c.field, c.to) })));
  const priced = diffs.filter((d) => d.changes.some((c) => c.field === "priceCents"));
  const paid = priced.reduce((n, d) => n + (impact[d.code]?.paid ?? 0), 0);
  const open = priced.reduce((n, d) => n + (impact[d.code]?.open ?? 0), 0);
  const quote=priced.length===1?original.find(p=>p.code===priced[0].code)?.priceCents:undefined;
  const single = diffs.length === 1 && diffs[0].changes.length === 1 && diffs[0].changes[0].field === "priceCents" ? diffs[0].changes[0].to as number : null;

  async function verifyTotp(): Promise<boolean> {
    const mfa = browserSupabase().auth.mfa;
    const list = await mfa.listFactors();
    let factorId = list.data?.totp.find((f) => f.status === "verified")?.id;
    if (!factorId) {
      // primeiro uso: cadastra o autenticador e confirma com o primeiro código
      const pending = enroll ?? await (async () => {
        const r = await mfa.enroll({ factorType: "totp", friendlyName: "Revela Master" });
        if (r.error || !r.data) return null;
        const e = { factorId: r.data.id, uri: r.data.totp.uri, secret: r.data.totp.secret };
        setEnroll(e);
        return e;
      })();
      if (!pending) { setError("Não foi possível preparar o autenticador."); return false; }
      if (!enroll) { setNeedEnroll(true); setError("Cadastre o autenticador com a chave abaixo e digite o primeiro código."); return false; }
      factorId = pending.factorId;
    }
    const ch = await mfa.challenge({ factorId });
    if (ch.error || !ch.data) { setError("Não foi possível validar o código. Tente de novo."); return false; }
    const v = await mfa.verify({ factorId, challengeId: ch.data.id, code });
    if (v.error) { setError("Código incorreto ou expirado."); return false; }
    return true;
  }

  async function publish() {
    setTried(true);
    if (reasonError(reason) || !/^\d{6}$/.test(code)) { if (!/^\d{6}$/.test(code)) setError("Digite os 6 números do aplicativo autenticador."); return; }
    setBusy(true); setError(null);
    try {
      if (!(await verifyTotp())) return;
      const { error: err } = await browserSupabase().rpc("admin_publish_plans", { p_changes: toChanges(original, draft), p_reason: reason.trim() });
      if (err) { setError(err.code === "MM016" ? "A sessão não passou pela confirmação em duas etapas. Tente de novo." : adminErrorText(err.code, err.message)); return; }
      onDone();
    } finally { setBusy(false); }
  }

  if (!reasonConfirmed) return <Sheet title="Publicar novo preço?" onClose={onClose}>
    <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={rErr}/>
    <Button onClick={()=>{setTried(true);if(!reasonError(reason)){setTried(false);setReasonConfirmed(true);}}}>Continuar</Button>
    <Button variant="texto" onClick={onClose}>Cancelar</Button>
  </Sheet>;

  return (
    <PublicarModal
      title={diffs.length === 1 ? "Publicar novo preço?" : "Publicar novos preços?"}
      diffs={shown}
      rows={[
        ...(priced.length ? [{ icon: "check" as const, text: `${paid} ${paid === 1 ? "evento já pago continua igual" : "eventos já pagos continuam iguais"}` }, { icon: "pix" as const, text: `${open} ${open === 1 ? "Pix aberto mantém" : "Pix abertos mantêm"} ${quote===undefined?"o valor cotado":brl(quote)} até expirar` }] : [{ icon: "check" as const, text: IMPACT_TEXT }]),
        { icon: "history", text: "Fica registrado na auditoria com seu nome" },
      ]}
      code={code} onCode={(v) => { setCode(v); if (error === "Digite os 6 números do aplicativo autenticador.") setError(null); }}
      extra={enroll && needEnroll ? (
        <div className="mnote" style={{ margin: "14px 0 0" }}>
          <span>Adicione ao aplicativo autenticador esta chave (ou abra o link no celular): <code aria-label="Chave do autenticador">{enroll.secret}</code> · <a className="link" href={enroll.uri}>Abrir no autenticador</a></span>
        </div>
      ) : undefined}
      error={error} busy={busy} cta={single != null ? `Publicar ${money(single)}` : "Publicar preços"}
      onCancel={onClose} onPublish={() => void publish()}
    />
  );
}

export function PricesEditor({ plans, env, impact = {} }: { plans: PlanRow[]; env: string; impact?: PlanImpact }) {
  const router = useRouter();
  const [draft, setDraft] = useState<PlanRow[]>(plans);
  const [open, setOpen] = useState(false);
  const penv: Env = env === "production" ? "production" : "sandbox";
  const diffs = useMemo(() => diffPlans(plans, draft), [plans, draft]);
  const errors = useMemo(() => draftErrors(draft), [draft]);
  const blocked = Object.keys(errors).length > 0;
  const set = (code: string, patch: Partial<PlanRow>) => setDraft((d) => d.map((p) => (p.code === code ? { ...p, ...patch } : p)));
  const num = (v: string): number | null => (v.trim() === "" ? null : Number.parseInt(v, 10) || 0);
  const orig = new Map(plans.map((p) => [p.code, p]));
  const cell = (n: number | null) => (n == null ? "" : String(n));

  const rows: PlanoRow[] = draft.map((p) => {
    const o = orig.get(p.code);
    const changed = diffs.some((d) => d.code === p.code);
    return {
      code: p.code, name: p.name, price: (p.priceCents / 100).toFixed(2).replace(".", ","), was: o && o.priceCents !== p.priceCents ? brl(o.priceCents) : undefined,
      guests: cell(p.maxGuests), shots: cell(p.maxShots), sandbox: p.sandboxActive, production: p.productionActive, highlighted: p.highlighted, free: p.isFree, changed, isNew: p.isNew,
    };
  });
  const errs = [...Object.entries(errors).map(([k, v]) => (k === "_destaque" ? v : `${draft.find((p) => p.code === k)?.name ?? k}: ${v}`))];
  const pv = previewOf(draft, penv);
  const summary = diffs.length === 1 ? diffs[0].changes.filter((c) => c.field === "priceCents").map((c) => `${diffs[0].name}: ${showValue("priceCents", c.from)} → ${showValue("priceCents", c.to)}`)[0] ?? `${diffs[0].name}: ${diffs[0].isNew ? "plano novo" : "ajustes"}` : diffs.map((d) => d.name).join(", ");

  return (
    <MasterPlanosView
      rows={rows} preview={pv.plans} previewCta={pv.cta} previewShift={pv.shift} errors={errs} historyHref="/master/auditoria?a=plan."
      payNote="Pix ou cartão" provider="ValidaPay"
      dirty={diffs.length ? {
        title: `${diffs.length} ${diffs.length === 1 ? "alteração não publicada" : "alterações não publicadas"}`, summary, blocked,
        onDiscard: () => setDraft(plans), onPublish: () => setOpen(true),
      } : null}
      onPrice={(code, text) => { const c = parseBrl(text); if (c == null) return false; set(code, { priceCents: c }); return true; }}
      onGuests={(code, v) => set(code, { maxGuests: num(v) })} onShots={(code, v) => set(code, { maxShots: num(v) })}
      onToggle={(code, e) => { const p = draft.find((x) => x.code === code); if (p) set(code, e === "sandbox" ? { sandboxActive: !p.sandboxActive } : { productionActive: !p.productionActive }); }}
      onHighlight={(code) => setDraft((d) => setHighlight(d, code))}
      onName={(code, name) => setDraft((d) => d.map((x) => x.code === code ? { ...x, name, code: slugify(name) || x.code } : x))}
      onAdd={() => {
        const n = draft.filter((p) => p.isNew).length + 1;
        const name = `Novo plano ${n}`;
        setDraft((d) => [...d, { code: slugify(name), name, maxGuests: 50, maxShots: 24, priceCents: 5900, sandboxActive: true, productionActive: false, highlighted: false, isFree: false, sort: Math.max(...d.map((p) => p.sort)) + 1, isNew: true }]);
      }}
      confirming={open}
      modal={open ? <ConfirmModal original={plans} draft={draft} impact={impact} onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} /> : undefined}
    />
  );
}
