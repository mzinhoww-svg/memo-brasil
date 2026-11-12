/* Master-auditoria-filtros.html (M28) e variantes: markup e classes da referência via master-kit; dados por props (padrão = desenho).
   Filtros por categoria (participante, consentimento, revelação, admin, pagamento) e por evento; linha com data, ator, ação, alvo e resumo do motivo. */
import type { ReactNode } from "react";
import { MasterStatePage } from "../master/MasterState";
import { Ico, MHead, MTable, MasterFrame } from "../master-kit";
import { AUDIT_CATEGORIES, type AuditCategory, type AuditRowText } from "@/lib/master/audit";

export const AUDIT_CAPTION = "Toda ação sensível, só inserção";
export const AUDIT_EMPTY = { title: "Nenhum registro neste filtro", text: "Troque a categoria ou o evento." };
export const AUDIT_ALL_EVENTS = "Todos os eventos";

const REF_ROWS: AuditRowText[] = [
  { key: "1", when: "hoje 08:51", who: "marcos@revela.app", action: "Preço de plano alterado", target: "Casamento", reason: "Reajuste aprovado para a temporada 2027" },
  { key: "2", when: "hoje 08:51", who: "marcos@revela.app", action: "Conciliação manual", target: "Pagamentos", reason: "—" },
  { key: "3", when: "hoje 07:12", who: "marcos@revela.app", action: "Cortesia criada", target: "BUFFET-JARDIM", reason: "Parceria com o buffet Jardim" },
  { key: "4", when: "ontem 18:20", who: "marcos@revela.app", action: "Estorno pedido", target: "#RV-2037", reason: "Pix pago em duplicidade" },
  { key: "5", when: "10 set 14:22", who: "marcos@revela.app", action: "Papel concedido", target: "suporte@revela.app", reason: "Entrada no time de atendimento" },
  { key: "6", when: "08 nov 16:40", who: "marcos@revela.app", action: "Exportação", target: "Pagamentos · 74 linhas", reason: "—" },
  { key: "7", when: "05 nov 11:02", who: "marcos@revela.app", action: "Evento marcado como teste", target: "Teste checkout Pix", reason: "Homologação do checkout" },
];
const REF_EXPORT = <button className="rv-btn rv-btn--sm"><Ico n="download" />Exportar</button>;
const REF_FIELD = (
  <label className="mfield" style={{ maxWidth: "260px", width: "260px" }}>
    <i>Evento</i><input defaultValue={AUDIT_ALL_EVENTS} aria-label="Filtrar por evento" /><Ico n="chevron" />
  </label>
);

export interface PagerProps {
  range: string;
  /** Páginas da barra (números e reticências), a atual em `page`. */
  pages: (number | "…")[];
  page: number;
  prevHref?: string | null;
  nextHref?: string | null;
  hrefOf?: (n: number) => string;
  /** No app a barra acompanha a tabela; no desenho ela fica fixa no rodapé da tela. */
  flow?: boolean;
}
const Chevron = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
export function AuditPager({ range, pages, page, prevHref, nextHref, hrefOf, flow }: PagerProps) {
  const arrow = (d: string, href: string | null | undefined, label: string) => (href ? <a href={href} aria-label={label} style={{ color: "inherit" }}><Chevron d={d} /></a> : <Chevron d={d} />);
  return (
    <div className="mpager" style={flow ? { position: "static", marginTop: "16px" } : undefined}>
      <span>{range}</span>
      <div>
        {arrow("M15 18l-6-6 6-6", prevHref, "Página anterior")}
        {pages.map((n, i) => (n === "…" ? <span key={`g${i}`}>…</span> : n === page ? <b key={n}>{n}</b> : hrefOf ? <a key={n} href={hrefOf(n)} style={{ color: "inherit" }}>{n}</a> : <span key={n}>{n}</span>))}
        {arrow("M9 6l6 6-6 6", nextHref, "Próxima página")}
      </div>
    </div>
  );
}
const REF_PAGER: PagerProps = { range: "1–25 de 1.932 · 25 por página", pages: [1, 2, 3, "…", 78], page: 1 };

export interface AuditoriaFiltrosProps {
  caption?: string;
  exportAction?: ReactNode;
  cat?: AuditCategory;
  /** Link de cada categoria (sem links, as categorias são só texto, como no desenho). */
  catHref?: (c: AuditCategory) => string;
  eventField?: ReactNode;
  rows?: AuditRowText[];
  pager?: PagerProps | null;
}

/** Chips de categoria + filtro de evento. */
export function AuditFilters({ cat = "admin", catHref, eventField = REF_FIELD }: Pick<AuditoriaFiltrosProps, "cat" | "catHref" | "eventField">) {
  return (
    <div className="row between" style={{ marginBottom: "14px" }}>
      <div className="row" style={{ gap: "8px", margin: 0 }}>
        {AUDIT_CATEGORIES.map((c) => (catHref
          ? <a key={c.id} className={c.id === cat ? "chip on" : "chip"} href={catHref(c.id)}>{c.label}</a>
          : <span key={c.id} className={c.id === cat ? "chip on" : "chip"}>{c.label}</span>))}
      </div>
      <div className="row" style={{ gap: "8px" }}>{eventField}</div>
    </div>
  );
}

export function MasterAuditoriaFiltrosView({ caption = AUDIT_CAPTION, exportAction = REF_EXPORT, cat = "admin", catHref, eventField, rows = REF_ROWS, pager = REF_PAGER }: AuditoriaFiltrosProps = {}) {
  return (
    <>
      <MHead title="Auditoria" caption={caption}>{exportAction}</MHead>
      <AuditFilters cat={cat} catHref={catHref} eventField={eventField} />
      <MTable cols=".8fr 1.2fr 1.3fr 1.2fr 2fr" head={["Quando", "Ator", "Ação", "Alvo", "Motivo"]} rows={rows.map((r) => ({ key: r.key, cells: [r.when, r.who, r.action, r.target, r.reason] }))} />
      {pager && <AuditPager {...pager} />}
    </>
  );
}

export function MasterAuditoriaFiltros(props: AuditoriaFiltrosProps = {}) {
  return <MasterFrame current="auditoria"><MasterAuditoriaFiltrosView {...props} /></MasterFrame>;
}

/** Estado de página inteira (M28.v, .e, .p, .c). No app o vazio mantém os filtros (`filters`) para a pessoa trocar a categoria ou o evento. */
export function MasterAuditoriaFiltrosEstado({ variant, exportAction = REF_EXPORT, filters }: { variant: "empty" | "error" | "denied" | "loading"; exportAction?: ReactNode; filters?: ReactNode }) {
  return <MasterStatePage area="Auditoria" variant={variant} caption={variant === "empty" ? AUDIT_CAPTION : undefined} actions={exportAction} tabs={variant === "empty" ? filters : undefined} cols={5} rows={8} {...(variant === "empty" ? AUDIT_EMPTY : {})} />;
}
