"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { eventStatus } from "@/domain/event";
import { moderationQueue } from "@/domain/photo";
import { CATEGORY_LABEL } from "@/domain/options";
import { useAdmin } from "@/features/admin/context";
import { useModerationComments } from "@/features/admin/comments";
import { revealStamp } from "@/features/admin/panel-format";
import { usePlanInfo } from "@/features/admin/PlanInfo";
import { capacityState } from "@/features/billing/capacity";
import { useApp } from "@/features/app/provider";
import { plural } from "@/lib/plural";
import { PainelResumo } from "@/revela/screens/PainelResumo";

const nf = (n: number) => n.toLocaleString("pt-BR");

/** Resumo do evento (17d): números, lotação e atalhos para cada parte do painel. */
export default function VisaoGeral() {
  const router = useRouter();
  const { repos } = useApp();
  const { event, now, photos, participants } = useAdmin();
  const info = usePlanInfo(event.id, event.version);
  const { comments } = useModerationComments(event.id);
  const [invites, setInvites] = useState(0);
  useEffect(() => {
    let live = true;
    void repos.invitations.listByEvent(event.id).then((l) => { if (live) setInvites(l.length); }, () => undefined);
    return () => { live = false; };
  }, [repos, event.id]);

  const live = photos.filter((p) => p.status !== "removida");
  const guests = participants.filter((p) => p.userId !== event.hostId).length;
  const lastHour = live.filter((p) => p.createdAt >= now - 3_600_000).length;
  const reports = moderationQueue(live).filter((p) => p.status === "visivel").length + comments.filter((c) => !c.hidden && c.reports > 0).length;
  const cap = capacityState(guests, event.capacity, info.settings?.capacityGracePct ?? 0);
  const near = info.loaded && cap.near && event.capacity !== null;
  const base = `/painel/${event.id}`;
  const links = 1 + event.tables + invites;
  const moments = event.moments.length;
  const notice = event.notice && (!event.notice.expiresAt || event.notice.expiresAt > now);

  return (
    <PainelResumo
      name={event.title}
      live={eventStatus(event, now) === "ativo"}
      stamp={revealStamp(event, now)}
      tiles={{
        guests: nf(guests), guestsOf: event.capacity === null ? "sem limite" : `de ${nf(event.capacity)}`,
        photos: nf(live.length), photosNote: lastHour > 0 ? `+${nf(lastHour)} na última hora` : "nenhuma na última hora",
        reports: nf(reports), reportsNote: reports > 0 ? "para revisar" : "nada a revisar",
      }}
      gauge={{ label: "Lugares usados", text: event.capacity === null ? nf(guests) : `${nf(guests)} de ${nf(event.capacity)}`, pct: event.capacity ? Math.min(100, Math.round((guests / event.capacity) * 100)) : 0, warn: near }}
      cards={[
        { sub: `${nf(guests)} ${plural(guests, "entrou", "entraram")}`, href: `${base}/convidados` },
        { sub: `${nf(links)} ${plural(links, "link", "links")}`, href: `${base}/convites` },
        { sub: `${nf(moments)} ${plural(moments, "momento", "momentos")}`, href: `${base}/momentos` },
        { sub: notice ? "1 ativo" : "nenhum", href: `${base}/aviso` },
        { sub: `${nf(reports)} ${plural(reports, "denúncia", "denúncias")}`, href: `${base}/moderacao` },
        { sub: "ZIP e CSV", href: `${base}/downloads` },
        { sub: CATEGORY_LABEL[event.category], href: `${base}/aparencia` },
        { sub: near ? "Lotação chegando" : (info.current?.name ?? "Grátis"), href: `${base}/plano` },
      ]}
      settingsHref={`${base}/configuracoes`}
      onBack={() => router.push("/eventos")}
    />
  );
}
