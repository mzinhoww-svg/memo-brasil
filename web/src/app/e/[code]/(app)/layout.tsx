"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { TabBar, EventTheme, Button, Icon } from "@/components/memoriesmt";
import { useApp } from "@/features/app/provider";
import { useClock, useEventData, useOnline } from "@/features/app/hooks";
import { GuestProvider } from "@/features/events/guest-context";
import { normalizeShareCode } from "@/domain/share-code";

/** Área do convidado: guarda de acesso, tema do evento e barra de navegação com "Postar daqui". */
export default function GuestLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ code: string }>();
  const code = normalizeShareCode(params.code ?? "") ?? "";
  const path = usePathname();
  const router = useRouter();
  const { ready, user } = useApp();
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

  const ctx = useMemo(() => (data.event && user ? { event: data.event, user, participant, isHost, viewer: { id: user.id, host: isHost }, now, photos: data.photos, reactions: data.reactions, participants: data.participants, refresh } : null), [data, user, participant, isHost, now, refresh]);

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
  const onPost = path.endsWith("/postar");
  return (
    <GuestProvider value={ctx}>
      <EventTheme palette={data.event.palette} font={data.event.eventFont} className="app-col app-col--card app-fluid">
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
