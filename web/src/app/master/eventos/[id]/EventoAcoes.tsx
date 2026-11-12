"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionSheet } from "@/revela/master/ActionSheet";
import { RevealNowSheet } from "@/revela/master/RevealNowSheet";
import { Ico } from "@/revela/master-kit";
import { FlagIcon } from "@/revela/screens/MasterEventoDetalhe";
import { RefusalSheet } from "@/revela/screens/MasterEventosFolhas";
import { deleteTestEvents, refusalSentence, setTestFlag, TEST_ERROR_TEXT, type TestOutcome } from "@/lib/master/test-events";

type Sheet = null | "mark" | "unmark" | "delete" | "reveal" | { refused: string };
export interface EventoAcoesProps {
  eventId: string; title: string; isTest: boolean; photos: number;
  /** Só o master marca, desmarca, exclui teste e revela daqui (o banco confere de novo). */
  master: boolean;
  /** Revelação ligada, ainda não executada e evento não excluído. */
  canReveal: boolean;
  plannedAt: string; notices: string;
}

/** Botões do cabeçalho da M21 e as folhas: marcar como teste (M21-f1 e recusa M21-f1r), excluir evento de teste (M21-f2) e Revelar agora (M25, a folha única). */
export function EventoAcoes({ eventId, title, isTest, photos, master, canReveal, plannedAt, notices }: EventoAcoesProps) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setSheet(null); setError(null); };
  function settle(o: TestOutcome, after: "refresh" | "list") {
    if (o.ok) { close(); if (after === "list") router.push("/master/eventos?filtro=teste"); else router.refresh(); return; }
    if (o.kind === "refused") { setError(null); setSheet({ refused: refusalSentence(o.refusals[0]?.reason ?? "Recusado pelo servidor") }); return; }
    setError(TEST_ERROR_TEXT[o.kind]);
  }
  return (
    <>
      <Link className="rv-btn rv-btn--sm" href="/master/eventos"><Ico n="back" />Voltar</Link>
      {master && !isTest && <button type="button" className="rv-btn rv-btn--sm" onClick={() => setSheet("mark")}><FlagIcon />Marcar como teste</button>}
      {master && isTest && <button type="button" className="rv-btn rv-btn--sm" onClick={() => setSheet("unmark")}><FlagIcon />Desmarcar teste</button>}
      {master && isTest && <button type="button" className="rv-btn rv-btn--sm" style={{ color: "var(--danger)" }} onClick={() => setSheet("delete")}><Ico n="trash" />Excluir evento de teste</button>}
      {master && canReveal && <button type="button" className="rv-btn rv-btn--sm rv-btn--primary" onClick={() => setSheet("reveal")}><Ico n="spark" />Revelar agora</button>}

      {sheet === "mark" && (
        <ActionSheet title="Marcar como evento de teste?" body="Eventos de teste saem das métricas e podem ser excluídos em lote. Evento pago não pode ser marcado." confirmLabel="Marcar como teste" busyLabel="Marcando…"
          error={error} onCancel={close} onConfirm={async (reason) => settle(await setTestFlag([eventId], true, reason), "refresh")} />
      )}
      {sheet === "unmark" && (
        <ActionSheet title="Desmarcar este evento como teste?" body="Ele volta para as métricas e para a lista de eventos." confirmLabel="Desmarcar teste" busyLabel="Desmarcando…"
          error={error} onCancel={close} onConfirm={async (reason) => settle(await setTestFlag([eventId], false, reason), "refresh")} />
      )}
      {sheet === "delete" && (
        <ActionSheet title="Excluir este evento de teste?" tone="danger" confirmLabel="Excluir evento" busyLabel="Excluindo…"
          body={`O evento, as ${photos.toLocaleString("pt-BR")} fotos e os convites somem. Só eventos marcados como teste e sem pagamento podem ser excluídos.`}
          error={error} onCancel={close} onConfirm={async (reason) => settle(await deleteTestEvents([eventId], reason), "list")} />
      )}
      {sheet === "reveal" && <RevealNowSheet eventId={eventId} eventTitle={title} plannedAt={plannedAt} notices={notices} onClose={close} onDone={() => router.refresh()} />}
      {typeof sheet === "object" && sheet && "refused" in sheet && (
        <RefusalSheet title="Não dá para marcar como teste" body="Só eventos sem pagamento podem virar teste." error={sheet.refused} closeLabel="Entendi" onClose={close} />
      )}
    </>
  );
}
