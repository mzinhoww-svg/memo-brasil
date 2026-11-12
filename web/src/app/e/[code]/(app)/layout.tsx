"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { EventTheme, Button, Icon } from "@/components/revela";
import { ConvidadoCarregando } from "@/revela/screens/ConvidadoCarregando";
import { useApp } from "@/features/app/provider";
import { useClock, useEventData, useOnline } from "@/features/app/hooks";
import { usePresence } from "@/lib/motion/use-motion";
import { GuestProvider } from "@/features/events/guest-context";
import { devToolsEnabled } from "@/lib/dev-tools";
import { RollPickerProvider } from "@/features/photos/roll-picker";
import { normalizeShareCode } from "@/domain/share-code";
import { notificationPlan } from "@/domain/notifications";
import { computeRevealStatus } from "@/domain/reveal";
import { expirePending } from "@/features/photos/service";
import { RevealTransition } from "@/features/reveal/RevealTransition";
import { copyFor } from "@/features/app/copy";
import { backendMode } from "@/lib/supabase/env";

/** Área do convidado: guarda de acesso, tema do evento e barra de navegação com "Postar daqui". */
export default function GuestLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ code: string }>();
  const code = normalizeShareCode(params.code ?? "") ?? "";
  const path = usePathname();
  const router = useRouter();
  const { ready, user, scheduler, now: clock, repos, authority, signOut, canSwitchIdentity } = useApp();
  const data = useEventData({ code });
  const { now, sync } = useClock();
  const { refresh: reload } = data;
  const refresh = useCallback(async () => {
    await reload();
    sync();
  }, [reload, sync]);
  const online = useOnline();
  const offline = usePresence(!online);
  const participant = data.participants.find((p) => p.userId === user?.id);
  const isHost = Boolean(data.event && user && data.event.hostId === user.id);

  useEffect(() => {
    if (ready && !data.loading && !data.error && data.access === "convite") router.replace(`/e/${code}`);
  }, [ready, data.loading, data.error, data.access, router, code]);

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
    void authority.tick(repos, evId, clock()).then(reload);
  }, [evId, stored, status, repos, authority, clock, reload]);
  useEffect(() => {
    if (!ev || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    scheduler.schedule(ev.id, notificationPlan(ev, clock()));
    return () => scheduler.cancel(ev.id);
  }, [ev, scheduler, clock]);

  // envios que ficaram pela metade (aba fechada) deixam de ocupar o rolo depois de 1 h
  useEffect(() => {
    if (evId) void expirePending(repos, evId, clock(), 60 * 60_000);
  }, [evId, repos, clock]);

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

  const ctx = useMemo(() => (data.event && user ? { event: data.event, user, participant, isHost, viewer: { id: user.id, host: isHost }, now, photos: data.photos, reactions: data.reactions, participants: data.participants, counts: data.counts, refresh, revealStatus: status, developed } : null), [data, user, participant, isHost, now, refresh, status, developed]);

  if (!ready || data.loading) return <main role="status" aria-label="Carregando a festa"><ConvidadoCarregando name={null} /></main>;
  if (data.error) return <main className="app-col app-fluid"><div className="app-screen">
    <h1 className="titulo-tela app-h1">{data.error === "forbidden" || data.error === "unauthorized" ? "Não foi possível confirmar seu acesso." : "Não deu para carregar o evento."}</h1>
    <p className="app-p app-muted">{data.error === "forbidden" || data.error === "unauthorized" ? "Confira se você está com a conta usada neste evento e tente de novo." : "Confira a conexão e tente de novo. O link do evento continua o mesmo."}</p>
    <Button block onClick={() => void refresh()}>Tentar de novo</Button>
    {(data.error === "forbidden" || data.error === "unauthorized") && <Button href={`/e/${code}`} variant="texto">Voltar ao convite</Button>}
  </div></main>;
  if (data.access === "convite") return <main role="status" aria-label="Carregando a festa"><ConvidadoCarregando name={null} /></main>;
  if (!data.event) {
    router.replace(`/entrar?erro=${encodeURIComponent(code)}`); // 20h: o código não abre nenhuma festa
    return <main role="status" aria-label="Carregando a festa"><ConvidadoCarregando name={null} /></main>;
  }
  if (!ctx) return <main role="status" aria-label="Carregando a festa"><ConvidadoCarregando name={null} /></main>;

  const base = `/e/${code}`;
  return (
    <GuestProvider value={ctx}>
      <EventTheme wrap={data.event.cameraStyle}>
        {celebrate && <RevealTransition title={data.event.title} onClose={() => setCelebrate(false)} />}
        {offline.mounted && (
          <div className={`app-banner ${offline.leaving ? "rv-toast-out" : "rv-toast-in"}`} role="status" style={{ position: "fixed", top: "var(--space-4)", left: "var(--space-4)", right: "var(--space-4)", zIndex: 80 }}>
            <Icon name="sem-sinal" label="Sem sinal" />
            <span>Sem sinal agora. {data.counts.mine === 1 ? "Sua foto está guardada." : `Suas ${data.counts.mine} fotos estão guardadas.`}</span>
          </div>
        )}
        <RollPickerProvider code={code}><main>{children}</main></RollPickerProvider>
        {devToolsEnabled() && canSwitchIdentity && (
          // só no build de homologação (nunca em produção): trocar de pessoa neste aparelho para testar a festa com mais de um convidado
          <button type="button" aria-label="Entrar como outra pessoa" style={{ position: "fixed", top: 0, left: 0, width: 32, height: 32, opacity: 0, zIndex: 9999 }} onClick={async () => { await signOut(); router.push(`/e/${code}`); }} />
        )}
      </EventTheme>
    </GuestProvider>
  );
}
