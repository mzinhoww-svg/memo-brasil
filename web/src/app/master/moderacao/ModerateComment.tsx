"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { Ico } from "@/revela/master-kit";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText, reasonError } from "../billing";
import { ReasonField } from "../billing-actions";

type Action = "mostrar" | "esconder" | "remover";
const TITLE: Record<Action, string> = { mostrar: "Manter o comentário", esconder: "Esconder o comentário", remover: "Remover o comentário" };

/** Manter / Esconder / Remover (moderate_comment): o master justifica (10 a 500) e a ação fica na auditoria. */
export function ModerateComment({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setAction(null); setError(null); setTried(false); setReason(""); };
  async function submit() {
    setTried(true);
    if (!action || reasonError(reason)) return;
    setBusy(true); setError(null);
    const { error: e } = await browserSupabase().rpc("moderate_comment", { p_comment: id, p_action: action, p_reason: reason.trim() });
    setBusy(false);
    if (e) { setError(adminErrorText(e.code, e.message)); return; }
    close(); router.refresh();
  }
  return (
    <>
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => setAction("mostrar")}>Manter</button>
      {!hidden && <button type="button" className="rv-btn rv-btn--sm" onClick={() => setAction("esconder")}>Esconder</button>}
      <button type="button" className="rv-btn rv-btn--sm" style={{ color: "var(--danger)" }} aria-label="Remover" onClick={() => setAction("remover")}><Ico n="trash" /></button>
      {action && (
        <Sheet title={TITLE[action]} onClose={close}>
          <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={tried ? reasonError(reason) : null} />
          {error && <p className="rv-field-erro" role="alert">{error}</p>}
          <Button block variant={action === "remover" ? "destrutivo" : "primario"} onClick={() => void submit()} disabled={busy}>{busy ? "Enviando…" : TITLE[action]}</Button>
          <Button variant="texto" block onClick={close}>Cancelar</Button>
        </Sheet>
      )}
    </>
  );
}
