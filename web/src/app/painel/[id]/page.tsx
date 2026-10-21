"use client";

import { useEffect, useState } from "react";
import { LiveIndicator, Notice, Progress, StatGrid, StatTile, Button } from "@/components/memoriesmt";
import { endAt } from "@/domain/event";
import { eventStats, type EventStats } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { formatDate, formatTime } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";

export default function VisaoGeral() {
  const { repos } = useApp();
  const { event, now, photos, reactions, participants } = useAdmin();
  const [stats, setStats] = useState<EventStats | undefined>();
  useEffect(() => void eventStats(repos, event, now).then(setStats), [repos, event, now, photos, reactions, participants]);
  if (!stats) return null;
  const max = Math.max(1, ...stats.byMoment.map((m) => m.count));
  const live = stats.status === "ativo";
  const nf = (n: number) => n.toLocaleString("pt-BR");
  return (
    <>
      <div className="app-stack-sm">
        {live ? <LiveIndicator label={formatTime(now)} /> : <span className="eyebrow app-muted">Encerrado em {formatDate(endAt(event))}</span>}
        <h1 className="titulo-pagina app-h1">Seu {event.category === "casamento" ? "casamento" : "evento"} por todos os ângulos.</h1>
      </div>
      <StatGrid>
        <StatTile value={nf(stats.photos)} label="fotos" />
        <StatTile value={nf(stats.guests)} label="convidados entraram" />
        <StatTile value={nf(stats.reactions)} label="reações" />
        <StatTile value={event.capacity === null ? nf(stats.guests) : `${nf(stats.guests)} de ${nf(event.capacity)}`} label="vagas usadas" />
      </StatGrid>
      {event.notice && <Notice text={event.notice.text} />}
      <section className="app-stack-sm" aria-labelledby="mom">
        <h2 id="mom" className="titulo-card app-h1">Momentos</h2>
        {stats.byMoment.length === 0 ? <p className="app-p app-muted">Ainda sem fotos. Os momentos aparecem quando os convidados postarem.</p> : stats.byMoment.map((m) => <Progress key={m.moment} variant="evento" label={m.moment} status={nf(m.count)} value={(m.count / max) * 100} />)}
      </section>
      <div className="app-row">
        <Button variant="pequeno" href={`/e/${event.code}/agora`}>Ver no Agora</Button>
        {stats.pending > 0 && <Button variant="pequeno" href={`/painel/${event.id}/conteudo`}>{`Moderar ${stats.pending}`}</Button>}
      </div>
    </>
  );
}
