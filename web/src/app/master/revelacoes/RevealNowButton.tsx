"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Sheet } from "@/components/memoriesmt";
import { reasonError } from "../billing";
import { ReasonField } from "../billing-actions";
import { revealNow } from "./actions";
import css from "./page.module.css";

/** "Revelar agora": justificativa obrigatória e confirmação explícita; a revelação é a mesma rotina do servidor. */
export function RevealNowButton({ eventId, title, when }: { eventId: string; title: string; when: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = () => { setOpen(false); setReason(""); setConfirm(false); setTried(false); setError(null); };
  const submit = () => {
    setTried(true);
    if (reasonError(reason) || !confirm) return;
    start(async () => {
      const r = await revealNow(eventId, reason);
      if (!r.ok) { setError(r.error); return; }
      close(); router.refresh();
    });
  };
  return (
    <>
      <button type="button" className="adm-btn" onClick={() => setOpen(true)}>Revelar agora</button>
      {open && (
        <Sheet title="Revelar agora" onClose={close}>
          <p className="adm-nota adm-sheet-nota">{title} · programada para {when}. As fotos ficam visíveis para todos os participantes e isso não pode ser desfeito.</p>
          <ReasonField label="Justificativa (obrigatória, 10 a 500 caracteres)" value={reason} onChange={setReason} error={tried ? reasonError(reason) : null} />
          <label className={css.confirm}>
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            Confirmo revelar este evento agora
          </label>
          {tried && !confirm && <p className="mm-field-erro">Marque a confirmação para continuar.</p>}
          {error && <p className="mm-field-erro" role="alert">{error}</p>}
          <Button variant="destrutivo" block onClick={submit} disabled={pending}>{pending ? "Revelando…" : "Revelar agora"}</Button>
          <Button variant="texto" block onClick={close}>Cancelar</Button>
        </Sheet>
      )}
    </>
  );
}
