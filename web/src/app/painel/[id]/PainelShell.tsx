"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { AdminNav, Breadcrumbs, Button, CountBadge, EventTheme, GoogleButton, Icon, PainelFrame, ScreenSkeleton, Skeleton, type PainelTab } from "@/components/revela";
import { PainelBodySkeleton } from "@/components/revela/PainelBodySkeleton";
import { eventStatus } from "@/domain/event";
import { LOCAL_ACTOR, can } from "@/domain/roles";
import { computeRevealStatus } from "@/domain/reveal";
import { moderationQueue } from "@/domain/photo";
import { formatDate, isUuid, useClock, useEventData } from "@/features/app/hooks";
import { copyFor } from "@/features/app/copy";
import { useApp } from "@/features/app/provider";
import { AdminProvider } from "@/features/admin/context";

export const SECTIONS = [
  { slug: "", label: "Visão geral", short: "Geral" },
  { slug: "plano", label: "Plano", short: "Plano" },
  { slug: "conteudo", label: "Conteúdo", short: "Conteúdo" },
  { slug: "convidados", label: "Convidados", short: "Convidados" },
  { slug: "momentos", label: "Momentos", short: "Momentos" },
  { slug: "qr", label: "QR Code Studio", short: "QR" },
  { slug: "aparencia", label: "Aparência", short: "Aparência" },
  { slug: "configuracoes", label: "Configurações", short: "Ajustes" },
  { slug: "downloads", label: "Downloads", short: "Downloads" },
] as const;

/**
 * Rotas já migradas para o `PainelFrame` (quadro mobile único): título único da tela e rota pai da seta de voltar.
 * "" é o painel inicial. As sub-telas dos Ajustes (Aparência, Excluir) voltam aos Ajustes; o convite A5, aos convites.
 * Plano, QR e a visão geral ainda não migraram e mantêm o comportamento anterior.
 */
export const FRAME_ROUTES: Record<string, { title: string; parent: string }> = {
  conteudo: { title: "Conteúdo", parent: "" },
  aparencia: { title: "Aparência", parent: "configuracoes" },
  configuracoes: { title: "Ajustes", parent: "" },
  convidados: { title: "Convidados", parent: "" },
  downloads: { title: "Downloads", parent: "" },
  convites: { title: "Convites e mesas", parent: "" },
  momentos: { title: "Programação", parent: "" },
  moderacao: { title: "Moderação", parent: "" },
  aviso: { title: "Novo aviso", parent: "" },
  compartilhar: { title: "Compartilhar", parent: "" },
  excluir: { title: "Excluir evento", parent: "configuracoes" },
  convite: { title: "Convite A5", parent: "convites" },
};

/** Seções que ainda não têm tela do desenho: mantêm o cabeçalho e a navegação do painel. */
const LEGACY = /^\/painel\/[^/]+\/(plano|checkout-validapay)(\/|$)/;
const SLUG = /^\/painel\/[^/]+\/([^/]+)/;

/** Abas do quadro: rótulos curtos; a atual leva `aria-current`. */
function frameTabs(base: string, path: string, pending?: number): PainelTab[] {
  return SECTIONS.map((s) => {
    const href = s.slug ? `${base}/${s.slug}` : base;
    return { href, label: s.short, current: s.slug ? path === href || path.startsWith(`${href}/`) : path === base, count: s.slug === "conteudo" ? pending : undefined };
  });
}

/** Painel do anfitrião. Só abre para quem criou o evento (neste aparelho, no modo local). */
export function PainelShell({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const { user, ready, repos, now: clock, authority, backend, canCreate, signInWithGoogle } = useApp();
  const data = useEventData({ id });
  const { now, sync } = useClock();
  const { refresh: reload } = data;
  const refresh = useCallback(async () => {
    await reload();
    sync();
  }, [reload, sync]);
  const evId = data.event?.id;
  const stored = data.event?.revealStatus;
  const computed = data.event ? computeRevealStatus(data.event, now) : undefined;
  useEffect(() => {
    if (!evId || !stored || !computed || stored === computed) return;
    void authority.tick(repos, evId, clock()).then(reload);
  }, [evId, stored, computed, repos, authority, clock, reload]);
  const pending = useMemo(() => moderationQueue(data.photos).length, [data.photos]);

  const slug = SLUG.exec(path)?.[1];
  const route = slug ? FRAME_ROUTES[slug] : undefined;
  const base = `/painel/${id}`;
  // erros, falta de permissão e "não achamos" também ficam no quadro (só o cabeçalho, sem abas)
  const status = (children: ReactNode) => <PainelFrame title="Painel do evento" backHref="/eventos" backLabel="Voltar">{children}</PainelFrame>;

  if (!ready || data.loading) {
    // as seções antigas (Plano, checkout) mantêm o menu lateral; as migradas abrem no quadro, as demais no quadro da tela
    if (LEGACY.test(path)) return <main className="app-admin"><div className="app-admin-main"><Skeleton label="Abrindo o painel…" /></div></main>;
    if (route) return <PainelFrame title={route.title} backHref={route.parent ? `${base}/${route.parent}` : base} tabs={frameTabs(base, path)}><PainelBodySkeleton variant={slug === "conteudo" ? "grade" : "lista"} /></PainelFrame>;
    return <main><ScreenSkeleton variant={path === base ? "painel" : "lista"} label="Abrindo o painel…" /></main>;
  }
  if (data.error) return status(<div className="app-screen">
    <h2 className="titulo-tela app-h1">{data.error === "forbidden" || data.error === "unauthorized" ? "Não foi possível confirmar seu acesso." : "Não deu para carregar o evento."}</h2>
    <p className="app-p app-muted">{data.error === "forbidden" || data.error === "unauthorized" ? "Confira se você está com a conta usada neste evento e tente de novo." : "Confira a conexão e tente de novo. O link do evento continua o mesmo."}</p>
    <Button block onClick={() => void refresh()}>Tentar de novo</Button>
    {(data.error === "forbidden" || data.error === "unauthorized") && backend === "supabase" && <GoogleButton block label="Entrar com a conta do evento" onClick={() => void signInWithGoogle(`/painel/${id}`)} />}
    <Button href="/eventos" variant="texto">Meus eventos</Button>
  </div>);
  if (data.access === "convite" && data.preview) return status(<div className="app-screen"><h2 className="titulo-tela app-h1">Só o anfitrião abre o painel.</h2><Button href={`/e/${data.preview.code}`} block>Entrar na festa</Button></div>);
  if (!data.event) {
    // na nuvem, sem a conta do organizador o servidor não devolve o evento: pedir o login é mais útil que "não existe"
    if (backend === "supabase" && !canCreate && isUuid(id)) {
      return status(
        <div className="app-screen">
          <h2 className="titulo-tela app-h1">Entre com a conta Google que criou este evento.</h2>
          <p className="app-p app-muted">O painel só abre para quem criou o evento.</p>
          <GoogleButton block onClick={() => void signInWithGoogle(`/painel/${id}`)} />
          <Button href="/" variant="texto">Voltar ao início</Button>
        </div>,
      );
    }
    return status(
      <div className="app-screen">
        <span aria-hidden="true" className="app-empty-icon" style={{ display: "grid", placeItems: "center", width: 72, height: 72, borderRadius: "50%", background: "var(--surface-2)" }}><Icon name="explorar" decorative size={28} /></span>
        <h2 className="titulo-tela app-h1">Não achamos este evento.</h2>
        <p className="app-p app-muted">{copyFor(backend).panelNotFoundBody}</p>
        <div className="app-stack-sm" style={{ marginTop: "auto" }}>
          <Button href="/eventos" block>Ir para meus eventos</Button>
          {backend === "supabase" && <GoogleButton block label="Entrar com outra conta" onClick={() => void signInWithGoogle("/")} />}
        </div>
      </div>,
    );
  }
  if (!can(LOCAL_ACTOR(user?.id ?? null), "event.configure", data.event)) return status(<div className="app-screen"><h2 className="titulo-tela app-h1">Só o anfitrião abre o painel.</h2><Button href={`/e/${data.event.code}`} block>Entrar na festa</Button></div>);

  const event = data.event;
  const ctx = { event, now, photos: data.photos, reactions: data.reactions, participants: data.participants, refresh };
  if (route) return <AdminProvider value={ctx}><PainelFrame title={route.title} eventName={event.title} backHref={route.parent ? `${base}/${route.parent}` : base} tabs={frameTabs(base, path, pending)}>{children}</PainelFrame></AdminProvider>;
  // Plano, o checkout, o QR e a visão geral ainda não migraram: Plano e checkout mantêm o menu lateral, os outros o quadro da tela.
  if (!LEGACY.test(path)) return <AdminProvider value={ctx}><div className="painel-scope">{children}</div></AdminProvider>;
  const state = `${formatDate(event.startAt)} · ${eventStatus(event, now) === "ativo" ? "ao vivo" : "encerrado"}`;
  const items = SECTIONS.map((s) => {
    const href = s.slug ? `${base}/${s.slug}` : base;
    return { href, label: s.label, current: s.slug ? path.startsWith(href) : path === base, count: s.slug === "conteudo" ? pending : undefined };
  });

  const section = items.find((i) => i.current);
  const crumbs = [{ label: "Meus eventos", href: "/eventos" }, section && section.href !== base ? { label: event.title, href: base } : { label: event.title }, ...(section && section.href !== base ? [{ label: section.label }] : [])];
  return (
    <AdminProvider value={ctx}>
      <EventTheme wrap={event.cameraStyle} className="app-admin app-fluid">
        <div className="app-admin-side no-print"><AdminNav eventName={event.title} eventState={state} switchHref="/eventos" items={items} /></div>
        <main className="app-admin-main">
          <nav className="app-admin-navm no-print" aria-label="Administração do evento">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className="rvl-tab" aria-current={i.current ? "page" : undefined} style={i.current ? { background: "var(--revela)", color: "var(--on-revela)", fontWeight: 700 } : undefined}>
                {i.label}
                {i.count ? <CountBadge count={i.count} /> : null}
              </Link>
            ))}
          </nav>
          <Breadcrumbs className="no-print" items={crumbs} />
          {children}
        </main>
      </EventTheme>
    </AdminProvider>
  );
}
