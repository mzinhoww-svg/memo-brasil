/* Peças do Master (desktop 1440×900) com o markup e as classes de design-system/revela/html/Master-*.html.
   As 15 telas de `screens/Master*.tsx` e as páginas reais de `app/master/**` usam estas mesmas peças: o desenho e o app não divergem. */
import type { CSSProperties, ReactNode } from "react";
import { MASTER_LOGO, MASTER_NAV, type MasterNavId } from "./master-icons";

const SV = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Ícones de 24 px usados no conteúdo das telas (traços do desenho). */
export const ICONS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  check: <path d="M5 12l5 5 9-10" />,
  pix: <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6 15h4" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2" /></>,
  photo: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  back: <path d="M15 18l-6-6 6-6" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  chat: <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4a8 8 0 1 1 16-4z" />,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  tag: <><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  ticket: <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  warn: <><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17v.01" /></>,
  refresh: <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  history: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />,
  dots: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
} as const;
export type IconName = keyof typeof ICONS;
export function Ico({ n, size }: { n: IconName; size?:number }) {
  return <svg {...SV} style={size?{width:size,height:size}:undefined}>{ICONS[n]}</svg>;
}

export interface MasterUser { name: string; role: string }

/** Os doze itens do desenho; rotas auxiliares usam o grupo correspondente. */
export type AppNavId = MasterNavId;


/** Rotas reais de cada item do menu (as mesmas do console). */
export const MASTER_HREF: Record<AppNavId, string> = {
  visao: "/master", eventos: "/master/eventos", pessoas: "/master/pessoas", planos: "/master/planos", pagamentos: "/master/pagamentos", cortesias: "/master/codigos",
  revelacoes: "/master/revelacoes", moderacao: "/master/moderacao", saude: "/master/saude", lgpd: "/master/lgpd", auditoria: "/master/auditoria", configuracoes: "/master/configuracoes",
};

/** Menu lateral do Master. Sem `Link` para continuar sendo servidor puro; `<a href>` navega do mesmo jeito. */
export function MasterAside({ current, links = false, user = { name: "Marcos", role: "Administrador" } }: { current?: AppNavId; links?: boolean; user?: MasterUser }) {
  const items = MASTER_NAV;
  return (
    <aside className="mside" role="navigation" aria-label="Módulos do console">
      {MASTER_LOGO}
      {items.map((m) => (
        <a key={m.id} className={m.id === current ? "mnav on" : "mnav"} href={links ? MASTER_HREF[m.id] : undefined} aria-current={m.id === current ? "page" : undefined}>
          {m.icon}
          <span>{m.label}</span>
        </a>
      ))}
      <div className="grow" />
      <div className="muser">
        <span className="avatar avatar--sm">{user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <b>{user.name}</b>
          <span>{user.role}</span>
        </div>
      </div>
    </aside>
  );
}

const ENV_LABEL: Record<string, string> = { production: "Produção", sandbox: "Sandbox", desligado: "Pagamentos desligados" };
/** Barra de cima: busca global (vai para /master/busca) e o ambiente de pagamento. */
export function MasterTop({ env = "production", q, links = false }: { env?: string; q?: string; links?: boolean }) {
  const search = (
    <label className="msearch">
      <Ico n="search" />
      <input name="q" defaultValue={q ?? ""} placeholder="Buscar evento, pessoa ou pagamento" aria-label="Buscar" maxLength={80} />
    </label>
  );
  return (
    <div className="mtop">
      {links ? <form action="/master/busca" method="get" role="search" style={{ display: "contents" }}>{search}</form> : search}
      <span className="envb" data-env={env}>
        <Ico n="lock" />
        {ENV_LABEL[env] ?? env}
      </span>
    </div>
  );
}

/** Moldura de uma tela do Master. Nas telas do desenho (`/dev/revela`) traz o menu e a barra; no app, o layout monta a moldura uma vez. */
export function MasterFrame({ current, children, links = false, user, env, q }: { current?: AppNavId; children: ReactNode; links?: boolean; user?: MasterUser; env?: string; q?: string }) {
  return (
    <div className="dsk">
      <MasterAside current={current} links={links} user={user} />
      <main className="mmain" style={links ? { overflowY: "auto" } : undefined}>
        <MasterTop env={env} q={q} links={links} />
        {children}
      </main>
      <div className="grain" />
    </div>
  );
}

export function MHead({ title, caption, children }: { title: string; caption?: string; children?: ReactNode }) {
  return (
    <div className="mhead">
      <div>
        <h1 className="rv-title-lg">{title}</h1>
        {caption && <p className="rv-caption" style={{ marginTop: "6px" }}>{caption}</p>}
      </div>
      <div className="row" style={{ gap: "8px" }}>{children}</div>
    </div>
  );
}

export function Tiles({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return (
    <div className="mtiles">
      {items.map((t) => (
        <div className="tile" key={t.label}>
          <span>{t.label}</span>
          <b>{t.value}</b>
          <small>{t.note}</small>
        </div>
      ))}
    </div>
  );
}

export type Tone = "ok" | "bad" | "wait" | "info";
export function St({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <em className={`st st--${tone}`}>{children}</em>;
}

/** Link de ação pequeno com o visual de `rv-btn--sm`. */
export function BtnLink({ href, icon, children, primary }: { href: string; icon?: IconName; children: ReactNode; primary?: boolean }) {
  return (
    <a className={`rv-btn rv-btn--sm${primary ? " rv-btn--primary" : ""}`} href={href}>
      {icon && <Ico n={icon} />}
      {children}
    </a>
  );
}

export function Chips({ items }: { items: { label: string; href: string; on?: boolean }[] }) {
  return (
    <div className="row" style={{ gap: "8px", marginBottom: "14px" }}>
      {items.map((c) => <a key={c.label} className={c.on ? "chip on" : "chip"} href={c.href}>{c.label}</a>)}
    </div>
  );
}

export function Seg({ items }: { items: { label: string; href?: string; on?: boolean }[] }) {
  return (
    <div className="seg">
      {items.map((s) => <span key={s.label} className={s.on ? "on" : ""}>{s.href?<a href={s.href} aria-current={s.on?"page":undefined}>{s.label}</a>:s.label}</span>)}
    </div>
  );
}

export interface MRow { key: string; cells: ReactNode[]; className?: string; style?: CSSProperties }
/** Tabela do Master: `cols` é o `gridTemplateColumns` do desenho; `head` o rótulo de cada coluna (vazio = coluna de ação). */
export function MTable({ cols, head, rows, empty, style }: { cols: string; head: string[]; rows: MRow[]; empty?: string; style?: CSSProperties }) {
  const g = { gridTemplateColumns: cols };
  return (
    <div className="mtable" style={style}>
      <div className="mtr mth" style={g}>{head.map((h, i) => <span key={i}>{h}</span>)}</div>
      {rows.map((r) => (
        <div className={r.className ? `mtr ${r.className}` : "mtr"} key={r.key} style={{ ...g, ...r.style }}>{r.cells.map((c, i) => <span key={i}>{c}</span>)}</div>
      ))}
      {!rows.length && <MState kind="empty" text={empty ?? "Nada por aqui ainda."} />}
    </div>
  );
}

export function MNote({ children, icon = "warn", style }: { children: ReactNode; icon?: IconName; style?: CSSProperties }) {
  return (
    <div className="mnote" style={style}>
      <Ico n={icon} />
      <span>{children}</span>
    </div>
  );
}

/** Linha de `rv-group` com título e meta (usada em Saúde, LGPD e Configurações). */
export function GroupRow({ icon, title, meta, end, children }: { icon?: IconName; title?: ReactNode; meta?: ReactNode; end?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rv-row">
      {icon && <Ico n={icon} />}
      <div className="rv-row__text">
        {title}
        {meta && <span className="rv-row__meta">{meta}</span>}
        {children}
      </div>
      {end}
    </div>
  );
}

export function Gauge({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="gauge">
      <div className="row between"><span>{label}</span><b>{value}</b></div>
      <i><s style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></i>
    </div>
  );
}

export function MCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <section className="mcard" style={style}>{children}</section>;
}

/** Estado de erro, sem permissão ou vazio dentro da moldura do Master. */
export function MState({ kind, text }: { kind: "denied" | "error" | "empty"; text?: string }) {
  const msg = text ?? (kind === "denied" ? "Sem permissão para ver estes dados." : kind === "error" ? "Não foi possível carregar agora." : "Nada por aqui ainda.");
  return <div className="mnote" role={kind === "empty" ? undefined : "alert"}><Ico n="warn" /><span>{msg}</span></div>;
}
