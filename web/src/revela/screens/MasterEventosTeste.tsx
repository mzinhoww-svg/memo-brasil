/* Master-eventos-teste.html (M22): Eventos de teste (lista M02 com o chip "De teste", seleção e lote). Markup e classes da referência via master-kit;
   dados por props (padrão = desenho). Seleção e botões do lote chegam por `selected`, `onToggle` e `bar` (só o master vê a seleção). */
import type { ReactNode } from "react";
import { Chips, Ico, MHead, MNote, MTable, MasterFrame, St, type MRow } from "../master-kit";

export interface EventoTesteRow { key: string; title: string; host: string; plan: string; payment: string; photos: string; createdAt: string; href?: string }
export interface EventosTesteProps {
  caption?: string;
  chips?: { label: string; href: string; on?: boolean }[];
  rows?: EventoTesteRow[];
  /** Chaves das linhas marcadas. Padrão do desenho: as três primeiras. */
  selected?: ReadonlySet<string>;
  /** Com `onToggle` a caixa vira botão; sem ele é o desenho estático. `false` tira a coluna de seleção (quem não é master). */
  onToggle?: ((key: string) => void) | false;
  /** Barra do lote (".mpublish"); padrão = a do desenho com 3 selecionados. */
  bar?: ReactNode;
  exportAction?: ReactNode;
  pager?: ReactNode;
  empty?: string;
}

const REF_ROWS: EventoTesteRow[] = [
  { key: "1", title: "Teste QA · câmera noite", host: "marcos@revela.app", plan: "Grátis", payment: "—", photos: "12", createdAt: "09 nov 2026" },
  { key: "2", title: "Teste checkout Pix", host: "marcos@revela.app", plan: "Festa", payment: "sandbox", photos: "0", createdAt: "08 nov 2026" },
  { key: "3", title: "Demo comercial buffet", host: "suporte@revela.app", plan: "Grátis", payment: "—", photos: "40", createdAt: "05 nov 2026" },
  { key: "4", title: "Teste revelação e-mail", host: "marcos@revela.app", plan: "Grátis", payment: "—", photos: "6", createdAt: "02 nov 2026" },
];
// O desenho mostra 4 linhas na lista, com as três primeiras selecionadas.
export const REF_CHIPS = ["Todos", "Rolando", "Aguardando revelação", "Revelados", "Com denúncias", "Excluídos", "De teste 4"].map((label, i) => ({ label, href: "#", on: i === 6 }));

const Check = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>;

export function MasterEventosTesteBar({ count, onUnmark, onDelete, busy }: { count: number; onUnmark?: () => void; onDelete?: () => void; busy?: boolean }) {
  return (
    <div className="mpublish">
      <span><Ico n="check" /><b>{count} {count === 1 ? "selecionado" : "selecionados"}</b></span>
      <div className="row" style={{ gap: "8px" }}>
        <button type="button" className="rv-btn rv-btn--sm" onClick={onUnmark} disabled={busy}>Desmarcar teste</button>
        <button type="button" className="rv-btn rv-btn--sm" style={{ color: "var(--danger)" }} onClick={onDelete} disabled={busy}><Ico n="trash" />Excluir selecionados</button>
      </div>
    </div>
  );
}

export function MasterEventosTesteView({
  caption = "263 eventos · 4 de teste", chips = REF_CHIPS, rows = REF_ROWS, selected = new Set(["1", "2", "3"]), onToggle, bar, exportAction, pager, empty = "Nenhum evento de teste.",
}: EventosTesteProps = {}) {
  const selectable = onToggle !== false;
  const cols = selectable ? ".25fr 1.6fr 1.3fr .7fr .8fr .5fr .9fr .7fr" : "1.6fr 1.3fr .7fr .8fr .5fr .9fr .7fr";
  const mrows: MRow[] = rows.map((r) => {
    const on = selected.has(r.key);
    const box = onToggle
      ? <button key="x" type="button" role="checkbox" aria-checked={on} aria-label={`Selecionar ${r.title}`} className={on ? "cbx cbx--sm on" : "cbx cbx--sm"} style={{ border: 0, padding: 0, cursor: "pointer" }} onClick={() => onToggle(r.key)}>{on && <Check />}</button>
      : <i key="x" className={on ? "cbx cbx--sm on" : "cbx cbx--sm"}>{on && <Check />}</i>;
    return { key: r.key, cells: [...(selectable ? [box] : []), r.href ? <a key="t" href={r.href}>{r.title}</a> : r.title, r.host, r.plan, r.payment, r.photos, r.createdAt, <St key="s" tone="wait">teste</St>] };
  });
  return (
    <>
      <MHead title="Eventos" caption={caption}>
        {exportAction ?? <button className="rv-btn rv-btn--sm"><Ico n="download" />Exportar</button>}
      </MHead>
      <Chips items={chips} />
      <MTable cols={cols} head={[...(selectable ? [""] : []), "Evento", "Organizador", "Plano", "Pagamento", "Fotos", "Criado em", "Situação"]} rows={mrows} empty={empty} />
      {pager}
      <MNote icon="shield">Só master marca, desmarca e exclui. Um lote com evento real ou pago é recusado inteiro.</MNote>
      {bar === undefined ? <MasterEventosTesteBar count={selected.size} /> : bar}
    </>
  );
}

export function MasterEventosTeste(props: EventosTesteProps = {}) {
  return <MasterFrame current="eventos"><MasterEventosTesteView {...props} /></MasterFrame>;
}
