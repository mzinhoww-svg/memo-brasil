"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { eventStatus, isRevealed, shotsLeft } from "@/domain/event";
import { useNow } from "@/features/app/hooks";
import { countdown, revealLine, stampDay } from "@/features/guest/format";
import { ConvidadoLaboratorio } from "@/revela/screens/ConvidadoLaboratorio";
import { RevealedFeed } from "@/features/feed/RevealedFeed";
import { RevealIntro } from "@/features/reveal/RevealIntro";
import { useGuest } from "@/features/events/guest-context";

/** 23b · Feed antes da revelação: o convidado vê só a contagem, a espera e o botão da câmera. */
function Laboratorio() {
  const { event, counts, participants } = useGuest();
  const now = useNow(1000);
  const left = shotsLeft(event, counts.mine);
  const ms = event.revealEnabled && event.revealAt ? event.revealAt - now : null;
  return (
    <ConvidadoLaboratorio
      code={event.code}
      stamp={stampDay(event.startAt, event.timezone)}
      title={event.title}
      live={eventStatus(event, now) === "ativo"}
      photos={counts.total}
      guests={Math.max(participants.length, 1)}
      countdown={ms === null ? null : countdown(ms)}
      revealLabel={event.revealAt ? revealLine(event.revealAt, event.timezone) : "Revela na hora"}
      cta={left === null || left <= 0 ? "Abrir câmera" : `Abrir câmera · ${left} ${left === 1 ? "pose" : "poses"}`}
    />
  );
}

/** Quem chega pelo aviso do aparelho (`?aviso=1`) passa por 24b → 24c antes do feed (24d). */
function Revelado() {
  const fromNotice = useSearchParams().get("aviso") === "1";
  const [stage, setStage] = useState<"aviso" | "revelou" | "feed">(fromNotice ? "aviso" : "feed");
  if (stage === "feed") return <RevealedFeed />;
  return <RevealIntro stage={stage} onOpen={() => setStage(stage === "aviso" ? "revelou" : "feed")} />;
}

export default function Agora() {
  const g = useGuest();
  if (!g.viewer.host && !isRevealed(g.event, g.now)) return <Laboratorio />;
  return <Revelado />;
}
