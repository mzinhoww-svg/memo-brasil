"use client";

import { StatGrid, StatTile } from "@/components/revela";
import type { MemoEvent } from "@/domain/event";
import { formatCountdown, formatInZone, zoneLabel } from "@/domain/reveal";
import { revealDayTime } from "@/features/invitations/invite-copy";
import { useClock } from "@/features/app/hooks";

/** Tela de espera da revelação: contagem regressiva no fuso do evento. `preview` marca a prévia do organizador. */
export function WaitingReveal({ event, ownCount, totalCount, preview }: { event: MemoEvent; ownCount: number; totalCount: number; preview?: boolean }) {
  const { now } = useClock(1000);
  const at = event.revealAt;
  if (at === null) return null;
  const left = formatCountdown(at - now);
  const when = formatInZone(at, event.timezone);
  const minutes = Math.ceil(Math.max(0, at - now) / 60_000);
  const next = revealDayTime(at, event.timezone, now, { weekdayForTomorrow: true });
  return (
    <section className="app-stack" aria-labelledby="espera" data-testid="aguardando-revelacao">
      <div className="app-stack-sm">
        <p className="eyebrow app-eyebrow">{preview ? "Prévia · como o convidado vê" : "Aguardando revelação"}</p>
        <h2 id="espera" className="titulo-tela app-h1">O filme ainda está no escuro.</h2>
        <p className="emocao app-emocao">{next.daysAhead === 1 ? `Revelamos ${next.day} às ${next.time}. A noite fica para a pista.` : "As fotos aparecem todas juntas."}</p>
      </div>
      <div className="app-card">
        <span className="eyebrow app-muted">Faltam</span>
        <span role="timer" aria-live="off" className="display" data-testid="contagem" style={{ fontVariantNumeric: "tabular-nums" }}>{left.text}</span>
        <span className="rv-sr-only" aria-live="polite">Faltam {minutes} {minutes === 1 ? "minuto" : "minutos"} para a revelação.</span>
        <span className="corpo app-muted">Revela em {when.date} às {when.time}, {zoneLabel(event.timezone).split(" (")[0]}.</span>
      </div>
      <StatGrid>
        <StatTile value={ownCount.toLocaleString("pt-BR")} label={ownCount === 1 ? "foto sua guardada" : "fotos suas guardadas"} />
        {event.everyoneSeesAll && <StatTile value={totalCount.toLocaleString("pt-BR")} label={totalCount === 1 ? "foto no álbum" : "fotos no álbum"} />}
      </StatGrid>
    </section>
  );
}
