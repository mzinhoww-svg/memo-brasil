"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/** Confirmação de ação destrutiva em folha: foco inicial em "Cancelar", a ação só roda depois de "Remover". As ações ficam fixas no pé. */
export function ConfirmSheet({ title, body, confirmLabel = "Remover", onCancel, onConfirm, history }: { title: string; body?: string; confirmLabel?: string; onCancel: () => void; onConfirm: () => void | Promise<void>; history?: boolean }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={title} onClose={() => { if (!busy) onCancel(); }} history={history}
      footer={(
        <div className="app-stack-sm">
          <Button variant="secundario" block disabled={busy} onClick={onCancel}>Cancelar</Button>
          <Button variant="destrutivo" block disabled={busy} onClick={async () => { if (busy) return; setError(undefined); setBusy(true); try { await onConfirm(); } catch (e) { setError((e as { userMessage?: string }).userMessage ?? "Não foi possível concluir. Tente de novo."); } finally { setBusy(false); } }}>{confirmLabel}</Button>
        </div>
      )}>
      {error && <p className="app-p" role="alert">{error}</p>}
      {body && <p className="app-p app-muted">{body}</p>}
    </Sheet>
  );
}
