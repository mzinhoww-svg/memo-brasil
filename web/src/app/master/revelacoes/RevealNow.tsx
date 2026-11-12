"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText, reasonError } from "../billing";
import { ReasonField } from "../billing-actions";

/** "Revelar agora" (M08): chama reveal_now (a mesma RPC do anfitrião) com motivo; o servidor revela uma vez só e registra na auditoria. */
export function RevealNow({ event }: { event: { id: string; title: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setOpen(false); setError(null); setTried(false); };
  async function submit() {
    setTried(true);
    if (reasonError(reason)) return;
    setBusy(true); setError(null);
    const { error: e } = await browserSupabase().rpc("reveal_now", { p_event: event.id, p_reason: reason.trim() });
    setBusy(false);
    if (e) { setError(adminErrorText(e.code, e.message)); return; }
    setReason(""); close(); router.refresh();
  }
  return (
    <>
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => setOpen(true)} aria-label={`Revelar agora: ${event.title}`}>Revelar agora</button>
      {open && (
        <Sheet title="Revelar agora" onClose={close}>
          <p className="rv-caption">{event.title}. As fotos ficam visíveis para quem tem acesso ao evento, agora, e não dá para desfazer.</p>
          <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={tried ? reasonError(reason) : null} />
          {error && <p className="rv-field-erro" role="alert">{error}</p>}
          <Button block onClick={() => void submit()} disabled={busy}>{busy ? "Revelando…" : "Revelar agora"}</Button>
          <Button variant="texto" block onClick={close}>Cancelar</Button>
        </Sheet>
      )}
    </>
  );
}
