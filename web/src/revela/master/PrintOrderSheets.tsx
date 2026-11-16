"use client";
/* Folhas do pedido de impressão (M30.f1 avançar status, M30.f2 cancelar): Master-impressao-detalhe--folha-avancar.html e --folha-cancelar.html.
   Avançar não pede motivo (como no desenho; o servidor audita quem e quando). Cancelar usa a folha de ação com motivo de 10 a 500 e não desfaz. */
import { useState } from "react";
import { ADVANCE, STATUS_LABEL, type PrintStatus } from "@/lib/master/print-orders";
import { ActionSheet, ErrLine } from "./ActionSheet";
import { MasterModal, ModalButtons } from "./MasterModal";

export interface PrintAdvanceSheetProps {
  code: string;
  from: PrintStatus;
  to: keyof typeof ADVANCE;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  error?: string | null;
  inline?: boolean;
}

export function PrintAdvanceSheet({ code, from, to, onConfirm, onCancel, error, inline }: PrintAdvanceSheetProps) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  }
  return (
    <MasterModal label={ADVANCE[to].title} inline={inline} onClose={busy ? undefined : onCancel}>
      <h2 className="rv-title">{ADVANCE[to].title}</h2>
      <p className="rv-caption" style={{ marginTop: "6px" }}>Pedido {code}. A pessoa que pediu vê o novo status.</p>
      <div className="kv">
        <div><span>De</span><b>{STATUS_LABEL[from]}</b></div>
        <div><span>Para</span><b>{STATUS_LABEL[to]}</b></div>
      </div>
      {error && <ErrLine>{error}</ErrLine>}
      <ModalButtons>
        <button type="button" className="rv-btn rv-btn--block" style={{ flex: 1 }} onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" style={{ flex: 1 }} onClick={() => void confirm()} disabled={busy} aria-busy={busy || undefined} data-autofocus>
          {busy ? "Salvando…" : ADVANCE[to].button}
        </button>
      </ModalButtons>
    </MasterModal>
  );
}

export interface PrintCancelSheetProps {
  code: string;
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
  error?: string | null;
  initialReason?: string;
  inline?: boolean;
}

export function PrintCancelSheet({ code, onConfirm, onCancel, error, initialReason, inline }: PrintCancelSheetProps) {
  return (
    <ActionSheet title={`Cancelar o pedido ${code}?`} body="Não dá para reabrir um pedido cancelado." cancelLabel="Voltar" confirmLabel="Cancelar pedido" busyLabel="Cancelando…"
      tone="danger" onConfirm={onConfirm} onCancel={onCancel} error={error} initialReason={initialReason} inline={inline} />
  );
}
