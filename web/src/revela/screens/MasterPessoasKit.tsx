/* Peças comuns das cinco abas de Pessoas (M15 a M19): abas, filtros, busca, paginação e os quatro estados.
   Markup e classes de design-system/revela/master/html/Master-pessoas-*.html. Sem `live`, as peças são as do desenho (spans, sem links);
   com `live` (rota real) as abas, os filtros e a paginação viram links e a busca vira um formulário GET. Tudo serializável (sem funções). */
import type { ReactNode } from "react";
import { MasterStatePage } from "../master";
import { Ico, MHead, MTable, Seg, type MRow } from "../master-kit";
import { ABAS, PER_PAGE, type PessoasAba, type Tone } from "@/lib/master/people";

const nf = new Intl.NumberFormat("pt-BR");
export const fmt = (n: number): string => nf.format(n);

/** Contagem de cada aba (o desenho mostra "Contas 7.613"). `undefined` = ainda não conhecida: só o nome da aba. */
export type TabCounts = Partial<Record<PessoasAba, number>>;
export const REF_COUNTS: Required<TabCounts> = { contas: 7613, organizadores: 198, convidados: 7412, convites: 1284, equipe: 3 };

/** Estado da URL de uma aba: filtro (?f=) e busca (?q=). */
export interface PessoasQuery { f?: string; q?: string }
export const pessoasHref = (aba: PessoasAba, query: PessoasQuery = {}, page = 1): string => {
  const p = new URLSearchParams({ aba });
  if (query.f) p.set("f", query.f);
  if (query.q) p.set("q", query.q);
  if (page > 1) p.set("p", String(page));
  return `/master/pessoas?${p}`;
};

export function PessoasTabs({ aba, counts, live }: { aba: PessoasAba; counts?: TabCounts; live?: boolean }) {
  return (
    <div style={{ width: "820px", marginBottom: "14px" }}>
      <Seg items={ABAS.map((a) => ({ label: counts?.[a.id] === undefined ? a.label : `${a.label} ${fmt(counts[a.id]!)}`, on: a.id === aba, href: live ? pessoasHref(a.id) : undefined }))} />
    </div>
  );
}

export const STATUS_TONE_CLASS: Record<Tone, string> = { ok: "st st--ok", bad: "st st--bad", wait: "st st--wait", info: "st st--info", mute: "st st--mute" };
export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <em className={STATUS_TONE_CLASS[tone]}>{children}</em>;
}

export interface ChipItem { label: string; n: number; on?: boolean; href?: string }

/** Linha de filtros: chips (ou uma legenda) à esquerda, busca à direita. */
export function FilterBar({ chips, caption, placeholder, q, live, aba, f }: {
  chips?: ChipItem[]; caption?: string; placeholder: string; q?: string; live?: boolean; aba: PessoasAba; f?: string;
}) {
  const search = (
    <label className="msearch" style={{ width: "320px", height: "36px" }}>
      <Ico n="search" />
      <input key={q ?? ""} name={live ? "q" : undefined} defaultValue={q ?? ""} placeholder={placeholder} aria-label={placeholder} maxLength={80} />
    </label>
  );
  return (
    <div className="row between" style={{ marginBottom: "14px" }}>
      {chips ? (
        <div className="row" style={{ gap: "8px", margin: "0" }}>
          {chips.map((c) => (live && c.href
            ? <a key={c.label} className={c.on ? "chip on" : "chip"} href={c.href}>{c.label} {fmt(c.n)}</a>
            : <span key={c.label} className={c.on ? "chip on" : "chip"}>{c.label} {fmt(c.n)}</span>))}
        </div>
      ) : <span className="rv-caption">{caption}</span>}
      <div className="row" style={{ gap: "8px" }}>
        {live ? (
          <form method="get" action="/master/pessoas" role="search" style={{ display: "contents" }}>
            <input type="hidden" name="aba" value={aba} />
            {f ? <input type="hidden" name="f" value={f} /> : null}
            {search}
          </form>
        ) : search}
      </div>
    </div>
  );
}

/** Números das páginas: 1 2 3 … N (a atual e as vizinhas; reticências nos buracos). */
export function pageWindow(page: number, pages: number): (number | "…")[] {
  const set = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 2) [2, 3].forEach((n) => set.add(n));
  const list = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  list.forEach((n, i) => { if (i && n - list[i - 1] > 1) out.push("…"); out.push(n); });
  return out;
}

export function Pager({ page = 1, total, per = PER_PAGE, query, aba, live }: { page?: number; total: number; per?: number; query?: PessoasQuery; aba: PessoasAba; live?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / per));
  const from = total === 0 ? 0 : (page - 1) * per + 1;
  const to = Math.min(total, page * per);
  const link = (n: number, child: ReactNode, label?: string) => (live ? <a key={label ?? n} href={pessoasHref(aba, query, n)} aria-label={label}>{child}</a> : <span key={label ?? n}>{child}</span>);
  return (
    <div className="mpager" style={live ? { position: "static", marginTop: "16px" } : undefined}>
      <span>{`${fmt(from)}–${fmt(to)} de ${fmt(total)} · ${per} por página`}</span>
      <div>
        {page > 1 && live ? <a href={pessoasHref(aba, query, page - 1)} aria-label="Página anterior"><Ico n="back" /></a> : <Ico n="back" />}
        {pageWindow(page, pages).map((n, i) => (n === "…" ? <span key={`e${i}`}>…</span> : n === page ? <b key={n} aria-current="page">{n}</b> : link(n, n)))}
        {page < pages && live ? <a href={pessoasHref(aba, query, page + 1)} aria-label="Próxima página"><Ico n="chevron" /></a> : <Ico n="chevron" />}
      </div>
    </div>
  );
}

/** Botão "Exportar" estático do desenho; na rota real entra o botão que abre a folha (M24). */
export function ExportStatic() {
  return <button type="button" className="rv-btn rv-btn--sm"><Ico n="download" />Exportar</button>;
}
export function GrantButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return <button type="button" className="rv-btn rv-btn--sm rv-btn--primary" onClick={onClick} disabled={disabled}><Ico n="plus" />Conceder papel</button>;
}

/** Cabeçalho + abas + filtros + tabela + rodapé de uma aba com lista. */
export function PessoasList({ aba, counts, caption, live, exportAction, bar, cols, head, rows, note, pager }: {
  aba: PessoasAba; counts?: TabCounts; caption: string; live?: boolean; exportAction?: ReactNode;
  bar: ReactNode; cols: string; head: string[]; rows: MRow[]; note?: ReactNode; pager: ReactNode;
}) {
  return (
    <>
      <MHead title="Pessoas" caption={caption}>{exportAction === undefined ? <ExportStatic /> : exportAction}</MHead>
      <PessoasTabs aba={aba} counts={counts} live={live} />
      {bar}
      <MTable cols={cols} head={head} rows={rows} />
      {note}
      {pager}
    </>
  );
}

/** Textos fixos de cada aba: legenda do cabeçalho, estado vazio e colunas do esqueleto (os do desenho). */
export const ABA_TEXT: Record<PessoasAba, { caption: string; emptyTitle: string; emptyText: string; cols: number }> = {
  contas: { caption: "Todas as contas de autenticação da plataforma", emptyTitle: "Nenhuma conta neste filtro", emptyText: "Troque o filtro ou limpe a busca.", cols: 6 },
  organizadores: { caption: "Quem criou pelo menos um evento", emptyTitle: "Nenhum organizador encontrado", emptyText: "Confira a busca.", cols: 8 },
  convidados: { caption: "Participações em eventos", emptyTitle: "Nenhum convidado encontrado", emptyText: "Confira a busca ou o filtro.", cols: 5 },
  convites: { caption: "Links e QR de entrada dos eventos. O token nunca aparece aqui.", emptyTitle: "Nenhum convite encontrado", emptyText: "Confira a busca ou o filtro.", cols: 5 },
  equipe: { caption: "Quem tem papel no console", emptyTitle: "Ninguém da equipe além de você", emptyText: "Conceda um papel para dar acesso ao console.", cols: 4 },
};

/** Os quatro estados de uma aba (vazio, erro, sem permissão, carregando) com o título "Pessoas" (nome da ÁREA). */
export function PessoasStatePage({ aba, variant, counts, live, exportAction, disabledActions }: {
  aba: PessoasAba; variant: "empty" | "error" | "denied" | "loading"; counts?: TabCounts; live?: boolean; exportAction?: ReactNode; disabledActions?: boolean;
}) {
  const t = ABA_TEXT[aba];
  const actions = exportAction !== undefined ? exportAction : aba === "equipe" ? <GrantButton disabled={disabledActions} /> : <ExportStatic />;
  return (
    <MasterStatePage area="Pessoas" variant={variant} tabs={<PessoasTabs aba={aba} counts={counts} live={live} />} actions={actions}
      caption={variant === "empty" ? t.caption : undefined} title={t.emptyTitle} text={t.emptyText} cols={t.cols} />
  );
}
