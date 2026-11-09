"use client";

import { useEffect, useState } from "react";
import { LiveIndicator, Notice, Progress, StatGrid, StatTile, Button, Skeleton } from "@/components/revela";
import { endAt } from "@/domain/event";
import { computeRevealStatus, formatInZone, zoneLabel } from "@/domain/reveal";
import { eventStats, type EventStats } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { formatDate, formatTime } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { plural } from "@/lib/plural";
import { CapacityBanner, PlanSummaryCard, PreEventChecklist, usePlanInfo } from "@/features/admin/PlanInfo";
import { capacityState } from "@/features/billing/capacity";

export default function VisaoGeral() {
  const { repos } = useApp();
  const { event, now, photos, reactions, participants } = useAdmin();
  const [stats, setStats] = useState<EventStats | undefined>();
  const info = usePlanInfo(event.id, event.version);
  useEffect(() => void eventStats(repos, event, now).then(setStats), [repos, event, now, photos, reactions, participants]);
  if (!stats) return <Skeleton label="Carregando a visão geral…" />;
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
        <StatTile value={nf(stats.photos)} label={plural(stats.photos, "foto", "fotos")} />
        <StatTile value={nf(stats.guests)} label={plural(stats.guests, "convidado entrou", "convidados entraram")} />
        <StatTile value={nf(stats.reactions)} label={plural(stats.reactions, "reação", "reações")} />
        <StatTile value={event.capacity === null ? nf(stats.guests) : `${nf(stats.guests)} de ${nf(event.capacity)}`} label="vagas usadas" />
      </StatGrid>
      {(() => {
        const cap = capacityState(stats.guests, event.capacity, info.settings?.capacityGracePct ?? 0);
        return info.loaded && cap.near && event.capacity !== null && cap.limit !== null
          ? <CapacityBanner guests={stats.guests} capacity={event.capacity} limit={cap.limit} planHref={`/painel/${event.id}/plano`} />
          : null;
      })()}
      {info.loaded && info.current && (
        <PlanSummaryCard planName={info.current.name} guests={stats.guests} capacity={event.capacity} planHref={`/painel/${event.id}/plano`} canUpgrade={info.plans.some((p, i) => i > info.plans.findIndex((x) => x.code === info.current?.code))} />
      )}
      <PreEventChecklist eventId={event.id} eventCode={event.code} hasPhoto={stats.photos > 0} order={info.order} />
      <section className="app-card" aria-labelledby="rv" data-testid="resumo-revelacao">
        <h2 id="rv" className="titulo-card app-h1">Revelação</h2>
        {(() => {
          const st = computeRevealStatus(event, now);
          const at = event.revealAt !== null ? formatInZone(event.revealAt, event.timezone) : undefined;
          return st === "desativada" ? <p className="app-p">Desligada. As fotos aparecem na hora.</p> : st === "revelada" ? <p className="app-p">Revelada em {at?.date} às {at?.time}. Todos veem as fotos.</p> : <p className="app-p">Pendente. Revela em {at?.date} às {at?.time}, {zoneLabel(event.timezone).split(" (")[0]}.</p>;
        })()}
        <Button variant="pequeno" href={`/painel/${event.id}/configuracoes`}>Configurar revelação</Button>
      </section>
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
