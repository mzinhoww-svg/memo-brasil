"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/** Confirmação de ação destrutiva em folha: foco inicial em "Cancelar", a ação só roda depois de "Remover". */
export function ConfirmSheet({ title, body, confirmLabel = "Remover", onCancel, onConfirm }: { title: string; body?: string; confirmLabel?: string; onCancel: () => void; onConfirm: () => void | Promise<void> }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={title} onClose={() => { if (!busy) onCancel(); }}>
      {error && <p className="app-p" role="alert">{error}</p>}
      {body && <p className="app-p app-muted">{body}</p>}
      <div className="app-stack-sm">
        <Button variant="secundario" block disabled={busy} onClick={onCancel}>Cancelar</Button>
        <Button variant="destrutivo" block disabled={busy} onClick={async () => { if (busy) return; setError(undefined); setBusy(true); try { await onConfirm(); } catch (e) { setError((e as { userMessage?: string }).userMessage ?? "Não foi possível concluir. Tente de novo."); } finally { setBusy(false); } }}>{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}
