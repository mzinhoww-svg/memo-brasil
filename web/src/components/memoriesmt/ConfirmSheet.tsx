"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/** Confirmação de ação destrutiva em folha: foco inicial em "Cancelar", a ação só roda depois de "Remover". */
export function ConfirmSheet({ title, body, confirmLabel = "Remover", onCancel, onConfirm }: { title: string; body?: string; confirmLabel?: string; onCancel: () => void; onConfirm: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={title} onClose={onCancel}>
      {body && <p className="app-p app-muted">{body}</p>}
      <div className="app-stack-sm">
        <Button variant="secundario" block onClick={onCancel}>Cancelar</Button>
        <Button variant="destrutivo" block disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}
