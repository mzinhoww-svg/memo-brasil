"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Sheet } from "@/components/revela";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText, reasonError } from "../billing";
import { ReasonField } from "../billing-actions";
import { nextSteps, STATUS_LABEL, type PrintStatus } from "./status";

/** Ações de um pedido de impressão: avançar o status (ou cancelar com motivo) e guardar uma nota interna. Tudo auditado no banco. */
export function PrintOrderActions({ id, status, note }: { id: string; status: PrintStatus; note: string | null }) {
  const router = useRouter();
  const steps = nextSteps(status);
  const [step, setStep] = useState<ReturnType<typeof nextSteps>[number] | null>(null);
  const [text, setText] = useState(note ?? "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setStep(null); setError(null); setTried(false); };
  async function submit() {
    if (!step) return;
    setTried(true);
    if (step.needsReason && reasonError(text)) return;
    setBusy(true); setError(null);
    const { error: e } = await browserSupabase().rpc("admin_set_print_order_status", { p_id: id, p_status: step.to, p_note: text.trim() || null });
    setBusy(false);
    if (e) { setError(e.code === "MM009" ? "O pedido já mudou de estado. Atualize a página." : adminErrorText(e.code, e.message)); return; }
    close(); router.refresh();
  }
  if (!steps.length) return note ? <span className="rv-caption" title="Nota interna">{note}</span> : null;
  return (
    <>
      {steps.map((s) => <button key={s.to} type="button" className="rv-btn rv-btn--sm" onClick={() => setStep(s)}>{s.label}</button>)}
      {step && (
        <Sheet title={`${step.label}: ${STATUS_LABEL[step.to]}`} onClose={close}>
          <ReasonField label={step.needsReason ? "Motivo (obrigatório, 10 a 500 caracteres)" : "Nota interna (opcional, só o Master vê)"} value={text} onChange={setText} error={step.needsReason && tried ? reasonError(text) : null} />
          {error && <p className="rv-field-erro" role="alert">{error}</p>}
          <Button block onClick={() => void submit()} disabled={busy} aria-busy={busy}>Confirmar</Button>
          <Button variant="texto" block onClick={close}>Voltar</Button>
        </Sheet>
      )}
    </>
  );
}
