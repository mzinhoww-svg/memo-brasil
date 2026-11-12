"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RevealNowSheet } from "@/revela/master/RevealNowSheet";

/** "Revelar agora" (M08): o botão da linha abre a folha única (M25), a mesma do painel do anfitrião. A RPC `reveal_now` revela uma vez só e registra na auditoria. */
export function RevealNow({ event }: { event: { id: string; title: string; plannedAt: string; notices: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => setOpen(true)} aria-label={`Revelar agora: ${event.title}`}>Revelar agora</button>
      {open && <RevealNowSheet eventId={event.id} eventTitle={event.title} plannedAt={event.plannedAt} notices={event.notices} onClose={() => setOpen(false)} onDone={() => router.refresh()} />}
    </>
  );
}
