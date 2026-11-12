import type { CSSProperties, ReactNode } from "react";

/**
 * Esqueleto de tela inteira no quadro do desenho (`.scr` > `.safe`): ocupa o mesmo espaço da tela final para nada pular
 * quando o conteúdo chega. Usa só `.rv-skeleton` (brilho em revela-motion.css, parado com `prefers-reduced-motion`) e tokens.
 * Sem "use client": serve em `loading.tsx` (servidor) e dentro das telas cliente.
 */
export type ScreenSkeletonVariant = "feed" | "grade" | "lista" | "perfil" | "painel" | "inicio" | "camera";

function Bone({ w = "100%", h, r = "var(--radius-md)", style }: { w?: CSSProperties["width"]; h: CSSProperties["height"]; r?: string; style?: CSSProperties }) {
  return <span className="rv-skeleton" style={{ width: w, height: h, borderRadius: r, flex: "none", ...style }} />;
}

const circle = (size: number) => <Bone w={size} h={size} r="50%" />;

function Header({ back, title = "55%" }: { back?: boolean; title?: CSSProperties["width"] }) {
  return (
    <div className="row between">
      {back && circle(40)}
      <Bone w={title} h={30} />
      {back ? <span style={{ width: 40 }} /> : circle(40)}
    </div>
  );
}

function Body({ variant }: { variant: ScreenSkeletonVariant }) {
  switch (variant) {
    case "feed":
      return (
        <>
          <Header />
          <Bone w="40%" h={14} style={{ marginTop: "var(--space-3)" }} />
          {[0, 1].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
              <div className="row">{circle(32)}<Bone w="45%" h={14} /></div>
              <Bone h={0} r="var(--radius-lg)" style={{ paddingBottom: "125%" }} />
            </div>
          ))}
        </>
      );
    case "grade":
      return (
        <>
          <Header />
          <Bone w="60%" h={14} style={{ marginTop: "var(--space-3)" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
            {Array.from({ length: 12 }, (_, i) => <Bone key={i} h={0} r="var(--radius-sm)" style={{ paddingBottom: "100%" }} />)}
          </div>
        </>
      );
    case "perfil":
      return (
        <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
            {circle(72)}
            <Bone w="50%" h={24} />
            <Bone w="35%" h={14} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-6)" }}>
            {Array.from({ length: 5 }, (_, i) => <Bone key={i} h={52} />)}
          </div>
        </>
      );
    case "painel":
      return (
        <>
          <Header back title="45%" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
            {[0, 1, 2].map((i) => <Bone key={i} h={84} r="var(--radius-lg)" />)}
          </div>
          <Bone h={44} style={{ marginTop: "var(--space-4)" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
            {Array.from({ length: 8 }, (_, i) => <Bone key={i} h={76} r="var(--radius-lg)" />)}
          </div>
        </>
      );
    case "inicio":
      return (
        <>
          <Header title="60%" />
          <Bone h={360} r="var(--radius-xl)" style={{ marginTop: "var(--space-5)" }} />
          <div className="row" style={{ marginTop: "var(--space-5)" }}>
            <Bone w="48%" h={120} r="var(--radius-lg)" />
            <Bone w="48%" h={120} r="var(--radius-lg)" />
          </div>
        </>
      );
    case "camera":
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-5)" }}>
          <div className="row between" style={{ width: "100%" }}>{circle(40)}<Bone w="30%" h={20} />{circle(40)}</div>
          <Bone w="100%" h={0} r="var(--radius-xl)" style={{ paddingBottom: "100%", marginTop: "auto" }} />
          <Bone w="40%" h={14} />
          <div style={{ marginTop: "auto" }}>{circle(76)}</div>
        </div>
      );
    case "lista":
    default:
      return (
        <>
          <Header back title="50%" />
          <Bone w="70%" h={14} style={{ marginTop: "var(--space-4)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
            {Array.from({ length: 6 }, (_, i) => <Bone key={i} h={56} />)}
          </div>
        </>
      );
  }
}

/** Barra de abas parada (mesma altura de `GuestTabs`/`HostTabs`) para quando o esqueleto não sabe o código do evento. */
export function TabsSkeleton() {
  return (
    <nav className="tabs" aria-hidden="true">
      <div className="rv-tabbar">
        {[0, 1, 2].map((i) => <span key={i} className="rv-tab"><Bone w={22} h={22} r="var(--radius-sm)" /><Bone w={36} h={10} /></span>)}
      </div>
    </nav>
  );
}

export function ScreenSkeleton({ label, variant = "lista", tabs, padBottom }: {
  /** texto lido pelo leitor de tela ("Carregando o feed…") */
  label: string;
  variant?: ScreenSkeletonVariant;
  /** barra de abas no rodapé: `true` = barra parada; ou a barra real (`<HostTabs current="…" />`) */
  tabs?: boolean | ReactNode;
  /** reserva o espaço da barra de abas (as telas com abas usam `paddingBottom: 92px`) */
  padBottom?: boolean;
}) {
  const bar = tabs === true ? <TabsSkeleton /> : tabs || null;
  return (
    <div className="scr" aria-busy="true" data-skeleton={variant}>
      <span role="status" className="rv-sr-only">{label}</span>
      <div className="safe" aria-hidden="true" style={(padBottom ?? Boolean(tabs)) ? { paddingBottom: "92px" } : undefined}>
        <Body variant={variant} />
      </div>
      {bar}
    </div>
  );
}

/** Linhas de lista carregando, dentro de uma tela já montada (pedidos, convidados…): mesma altura das `rv-row`. */
export function RowsSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span role="status" className="rv-sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => <Bone key={i} h={56} />)}
    </div>
  );
}
