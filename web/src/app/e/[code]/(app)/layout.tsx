"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TabBar, EventTheme, Button, Icon } from "@/components/memoriesmt";
import { useApp } from "@/features/app/provider";
import { useClock, useEventData, useOnline } from "@/features/app/hooks";
import { GuestProvider } from "@/features/events/guest-context";
import { normalizeShareCode } from "@/domain/share-code";
import { notificationPlan } from "@/domain/notifications";
import { computeRevealStatus } from "@/domain/reveal";
import { reconcileReveal } from "@/features/events/service";
import { RevealTransition } from "@/features/reveal/RevealTransition";

/** Área do convidado: guarda de acesso, tema do evento e barra de navegação com "Postar daqui". */
export default function GuestLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ code: string }>();
  const code = normalizeShareCode(params.code ?? "") ?? "";
  const path = usePathname();
  const router = useRouter();
  const { ready, user, scheduler, now: clock, repos } = useApp();
  const data = useEventData({ code });
  const { now, sync } = useClock();
  const { refresh: reload } = data;
  const refresh = useCallback(async () => {
    await reload();
    sync();
  }, [reload, sync]);
  const online = useOnline();
  const participant = data.participants.find((p) => p.userId === user?.id);
  const isHost = Boolean(data.event && user && data.event.hostId === user.id);

  useEffect(() => {
    if (ready && !data.loading && data.event && (!user || (!participant && !isHost))) router.replace(`/e/${code}`);
  }, [ready, data.loading, data.event, user, participant, isHost, router, code]);

  const ev = data.event;
  const status = ev ? computeRevealStatus(ev, now) : "desativada";

  // "Chegou a hora": se a pessoa estava com o app aberto e o estado virou de pendente para revelada, mostra a revelação.
  const [prevStatus, setPrevStatus] = useState(status);
  const [celebrate, setCelebrate] = useState(false);
  const [developed, setDeveloped] = useState(false);
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (prevStatus === "pendente" && status === "revelada") {
      setCelebrate(true);
      setDeveloped(true);
    }
  }

  // O timer só acorda a interface no horário; a verdade é sempre now >= revealAt (vale com o app fechado, offline e ao reabrir).
  const revealAtMs = ev?.revealEnabled ? ev.revealAt : null;
  useEffect(() => {
    if (revealAtMs === null || status !== "pendente") return;
    const ms = revealAtMs - clock();
    if (ms <= 0 || ms > 2 ** 31 - 1) return;
    const t = setTimeout(sync, ms + 30);
    return () => clearTimeout(t);
  }, [revealAtMs, status, clock, sync]);

  // Espelha reveal_status no armazenamento (idempotente). No backend isto é uma tarefa agendada.
  const evId = ev?.id;
  const stored = ev?.revealStatus;
  useEffect(() => {
    if (!evId || stored === undefined || stored === status) return;
    void reconcileReveal(repos, evId, clock()).then(reload);
  }, [evId, stored, status, repos, clock, reload]);
  useEffect(() => {
    if (!ev || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    scheduler.schedule(ev.id, notificationPlan(ev, clock()));
    return () => scheduler.cancel(ev.id);
  }, [ev, scheduler, clock]);

  // aquece as rotas do evento: com o service worker ativo, ficam disponíveis mesmo sem sinal na festa
  const evCode = ev?.code;
  useEffect(() => {
    if (!evCode || !navigator.onLine) return;
    const key = `mm-aquecido-${evCode}`;
    try {
      if (sessionStorage.getItem(key)) return; // uma vez por sessão: não repete a cada página
      sessionStorage.setItem(key, "1");
    } catch {
      /* sem sessionStorage: aquece mesmo assim */
    }
    const id = setTimeout(() => {
      for (const r of ["agora", "explorar", "voce", "postar"]) void fetch(`/e/${evCode}/${r}`, { credentials: "same-origin" }).catch(() => undefined);
    }, 4000); // depois da primeira pintura, para não competir com a página
    return () => clearTimeout(id);
  }, [evCode]);

  const ctx = useMemo(() => (data.event && user ? { event: data.event, user, participant, isHost, viewer: { id: user.id, host: isHost }, now, photos: data.photos, reactions: data.reactions, participants: data.participants, refresh, revealStatus: status, developed } : null), [data, user, participant, isHost, now, refresh, status, developed]);

  if (!ready || data.loading) return <main className="app-col"><p className="app-screen app-muted">Carregando a festa…</p></main>;
  if (!data.event) {
    return (
      <main className="app-col app-fluid">
        <div className="app-screen">
          <h1 className="titulo-tela app-h1">Código não confere.</h1>
          <p className="app-p app-muted">Confira no card da mesa. Esta versão só abre festas criadas neste aparelho.</p>
          <Button href="/entrar" variant="primario" block>Tentar outro código</Button>
        </div>
      </main>
    );
  }
  if (!ctx) return <main className="app-col"><p className="app-screen app-muted">Entrando na festa…</p></main>;

  const base = `/e/${code}`;
  const onPost = path.endsWith("/postar") || path.includes("/editar/");
  return (
    <GuestProvider value={ctx}>
      <EventTheme palette={data.event.palette} font={data.event.eventFont} className="app-col app-col--card app-fluid">
        {celebrate && <RevealTransition title={data.event.title} onClose={() => setCelebrate(false)} />}
        {!online && (
          <div className="app-banner" role="status" style={{ margin: "var(--space-4)" }}>
            <Icon name="sem-sinal" label="Sem sinal" />
            <span>Sem sinal agora. Suas {data.photos.filter((p) => p.authorId === user?.id).length} fotos estão guardadas.</span>
          </div>
        )}
        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</main>
        {!onPost && (
          <div className="app-fixed-bottom">
            <TabBar
              cta={{ href: `${base}/postar`, label: "Postar daqui" }}
              items={[
                { href: `${base}/agora`, label: "Agora", icon: "agora", current: path.endsWith("/agora") },
                { href: `${base}/explorar`, label: "Explorar", icon: "explorar", current: path.endsWith("/explorar") },
                { href: `${base}/voce`, label: "Você", icon: "voce", current: path.endsWith("/voce") },
              ]}
            />
          </div>
        )}
      </EventTheme>
    </GuestProvider>
  );
}
