"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Select, Sheet } from "@/components/memoriesmt";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText, brl, chargeHint, parseBrl, planPreview, reasonError, REASON_MAX, refundFailureText } from "./billing";

/** Motivo obrigatório (10 a 500): o erro só aparece depois da primeira tentativa de enviar. */
function ReasonField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error: string | null }) {
  const id = useId();
  return (
    <div className="mm-field">
      <label className="mm-field-label" htmlFor={id}>{label}</label>
      <textarea id={id} className="mm-field-input adm-textarea" rows={4} maxLength={REASON_MAX + 50} value={value}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-erro` : undefined} onChange={(e) => onChange(e.target.value)} />
      {error && <span id={`${id}-erro`} className="mm-field-erro">{error}</span>}
    </div>
  );
}

function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="adm-switch-row">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="checkbox" role="switch" className="adm-switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  return { router, busy, setBusy, error, setError, tried, setTried };
}

// ---------------------------------------------------------------- cortesia
export function CourtesyButton({ events, plans }: { events: { id: string; label: string }[]; plans: { code: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [plan, setPlan] = useState(plans[0]?.code ?? "");
  const [reason, setReason] = useState("");
  const a = useAction();
  const rErr = a.tried ? reasonError(reason) : null;
  const close = () => { setOpen(false); a.setError(null); a.setTried(false); };
  async function submit() {
    a.setTried(true);
    if (reasonError(reason) || !eventId || !plan) return;
    a.setBusy(true); a.setError(null);
    const { error } = await browserSupabase().rpc("admin_grant_courtesy", { p_event: eventId, p_plan: plan, p_reason: reason.trim() });
    a.setBusy(false);
    if (error) { a.setError(adminErrorText(error.code, error.message)); return; }
    setReason(""); close(); a.router.refresh();
  }
  return (
    <>
      <Button variant="secundario" small onClick={() => setOpen(true)} disabled={!events.length}>Conceder cortesia</Button>
      {open && (
        <Sheet title="Conceder cortesia" onClose={close}>
          <Select label="Evento" value={eventId} onChange={(e) => setEventId(e.target.value)} options={events.map((e) => ({ value: e.id, label: e.label }))} />
          <Select label="Plano" value={plan} onChange={(e) => setPlan(e.target.value)} options={plans.map((p) => ({ value: p.code, label: p.name }))} />
          <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={rErr} />
          <p className="adm-nota adm-sheet-nota">O evento ganha os limites do plano sem cobrança, em qualquer ambiente. Fica no registro de auditoria.</p>
          {a.error && <p className="mm-field-erro" role="alert">{a.error}</p>}
          <Button block onClick={submit} disabled={a.busy}>{a.busy ? "Concedendo…" : "Conceder cortesia"}</Button>
          <Button variant="texto" block onClick={close}>Cancelar</Button>
        </Sheet>
      )}
    </>
  );
}

// ---------------------------------------------------------------- reembolso
export interface RefundOrder { orderId: string; eventTitle: string | null; planName: string | null; amountCents: number; providerChargeId: string | null; refundRequestedAt: string | null }

/** Grava a solicitação (admin_request_refund) e chama payments-refund com o JWT do Master. Já solicitado: só reenvia ao provedor. */
export function RefundButton({ order }: { order: RefundOrder }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const a = useAction();
  const retry = order.refundRequestedAt != null;
  const rErr = a.tried && !retry ? reasonError(reason) : null;
  const close = () => { setOpen(false); a.setError(null); a.setTried(false); };
  async function submit() {
    a.setTried(true);
    if (!retry && reasonError(reason)) return;
    a.setBusy(true); a.setError(null);
    const sb = browserSupabase();
    if (!retry) {
      const { error } = await sb.rpc("admin_request_refund", { p_order: order.orderId, p_reason: reason.trim() });
      if (error) { a.setBusy(false); a.setError(adminErrorText(error.code, error.message)); return; }
    }
    const fn = await sb.functions.invoke("payments-refund", { body: { orderId: order.orderId } });
    a.setBusy(false);
    a.router.refresh();
    if (fn.error) {
      let code: string | undefined;
      try {
        const body = await (fn.error as { context?: Response }).context?.json();
        code = typeof body?.error === "string" ? body.error : undefined;
      } catch { /* corpo ausente ou não JSON */ }
      a.setError(refundFailureText(code));
      return;
    }
    setReason(""); close();
  }
  const resumo = `${order.eventTitle ?? "Evento excluído"} · ${order.planName ?? "—"} · ${brl(order.amountCents)} · ${chargeHint(order.providerChargeId)}`;
  return (
    <>
      <Button variant={retry ? "secundario" : "destrutivo"} small onClick={() => setOpen(true)}>{retry ? "Reenviar reembolso" : "Solicitar reembolso"}</Button>
      {open && (
        <Sheet title={retry ? "Reenviar reembolso" : "Solicitar reembolso"} onClose={close}>
          <p className="adm-nota adm-sheet-nota">{resumo}</p>
          {!retry && <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={rErr} />}
          <p className="adm-nota adm-sheet-nota">Reembolso integral pela AbacatePay. O status vira estornado quando o provedor confirmar. Fica no registro de auditoria.</p>
          {a.error && <p className="mm-field-erro" role="alert">{a.error}</p>}
          <Button variant="destrutivo" block onClick={submit} disabled={a.busy}>{a.busy ? "Enviando…" : retry ? "Reenviar ao provedor" : "Solicitar reembolso integral"}</Button>
          <Button variant="texto" block onClick={close}>Cancelar</Button>
        </Sheet>
      )}
    </>
  );
}

// ---------------------------------------------------------------- planos
export interface PlanRow {
  code: string; name: string; maxGuests: number | null; maxShots: number | null; priceCents: number; isFree: boolean;
  sandboxActive: boolean; productionActive: boolean;
  history: { at: string; reason: string | null; actorRole: string | null; old: { priceCents: number } | null; new: { priceCents: number; sandboxActive: boolean; productionActive: boolean } | null }[];
}

const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Cuiaba" });
const reais = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export function PlanEditButton({ plan }: { plan: PlanRow }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(reais(plan.priceCents));
  const [sandbox, setSandbox] = useState(plan.sandboxActive);
  const [production, setProduction] = useState(plan.productionActive);
  const [reason, setReason] = useState("");
  const a = useAction();
  const cents = parseBrl(price);
  const priceErr = plan.isFree ? null : cents == null ? "Digite o preço em reais, por exemplo 189,00." : cents < 100 ? "Mínimo R$ 1,00 para planos pagos." : null;
  const rErr = a.tried ? reasonError(reason) : null;
  const preview = planPreview(plan, cents ?? plan.priceCents);
  const close = () => { setOpen(false); a.setError(null); a.setTried(false); };
  const reset = () => { setPrice(reais(plan.priceCents)); setSandbox(plan.sandboxActive); setProduction(plan.productionActive); setReason(""); };
  async function submit() {
    a.setTried(true);
    if (plan.isFree || priceErr || cents == null || reasonError(reason)) return;
    a.setBusy(true); a.setError(null);
    const { error } = await browserSupabase().rpc("admin_set_plan", {
      p_code: plan.code, p_price_cents: cents, p_sandbox_active: sandbox, p_production_active: production, p_reason: reason.trim(),
    });
    a.setBusy(false);
    if (error) { a.setError(adminErrorText(error.code, error.message)); return; }
    setReason(""); close(); a.router.refresh();
  }
  return (
    <>
      <Button variant="texto" small onClick={() => { reset(); setOpen(true); }} aria-label={`Editar ${plan.name}`}>Editar</Button>
      {open && (
        <Sheet title={`Editar ${plan.name}`} onClose={close}>
          <Field label="Preço (R$)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} disabled={plan.isFree}
            error={a.tried ? priceErr ?? undefined : undefined}
            help={plan.isFree ? "O plano Grátis não muda de preço nem de ativação." : "Mínimo R$ 1,00 para planos pagos. Upgrade cobra a diferença entre faixas."} />
          <Switch label="Ativo no sandbox" checked={sandbox} onChange={setSandbox} disabled={plan.isFree} />
          <Switch label="Ativo em produção" checked={production} onChange={setProduction} disabled={plan.isFree} />
          {!plan.isFree && <ReasonField label="Motivo (obrigatório)" value={reason} onChange={setReason} error={rErr} />}
          <div className="adm-preview">
            <span className="adm-eyebrow">Prévia para o organizador</span>
            <strong>{preview.titulo}</strong>
            <span>{preview.nota}</span>
          </div>
          <div>
            <span className="adm-eyebrow">Histórico</span>
            {plan.history.length ? (
              <ul className="adm-history">
                {plan.history.map((h, i) => (
                  <li key={i}>{day(h.at)} · {h.new ? brl(h.new.priceCents) : "—"}{h.old && h.new && h.old.priceCents !== h.new.priceCents ? ` (antes ${brl(h.old.priceCents)})` : ""} · {h.reason ?? "sem motivo"} · {h.actorRole ?? "operador"}</li>
                ))}
              </ul>
            ) : <p className="adm-nota adm-sheet-nota">Sem alterações registradas desde a aprovação.</p>}
          </div>
          {a.error && <p className="mm-field-erro" role="alert">{a.error}</p>}
          {!plan.isFree && <Button block onClick={submit} disabled={a.busy}>{a.busy ? "Salvando…" : "Salvar com motivo"}</Button>}
          <Button variant="texto" block onClick={close}>{plan.isFree ? "Fechar" : "Cancelar"}</Button>
        </Sheet>
      )}
    </>
  );
}
