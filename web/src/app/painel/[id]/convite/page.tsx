"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/features/admin/context";
import { InvitePrintSheet, useInviteA5 } from "@/features/invitations/InviteA5";
import { qrMatrix } from "@/features/invitations/invite-pdf";
import { PainelConviteA5 } from "@/revela/screens/PainelConviteA5";

const longDate = (ts: number, tz: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "numeric", month: "long", year: "numeric" }).format(new Date(ts));

/** Convite A5 para imprimir (17k): prévia do convite, PDF para gráfica (fontes do Revela embutidas) e impressão em A5. */
export default function ConviteA5() {
  const router = useRouter();
  const { event, now } = useAdmin();
  const state = useInviteA5(event, now);
  const { inv } = state;
  const qr = useMemo(() => qrMatrix(inv.qrText), [inv.qrText]);
  const poses = event.shotsPerPerson === null ? "poses sem limite" : `${event.shotsPerPerson} ${"poses suas"}`;
  return (
    <>
      <PainelConviteA5
        name={inv.title} date={longDate(event.startAt, event.timezone)}
        steps={["1 · Aponte a câmera", "2 · Escreva seu nome", `3 · ${poses}`]}
        code={inv.code} footer={inv.reveal} qr={qr}
        busy={state.busy} error={state.error}
        onBack={() => router.push(`/painel/${event.id}/convites`)}
        onPdf={() => void state.onDownload()} onPrint={state.onPrint}
      />
      <InvitePrintSheet state={state} />
    </>
  );
}
