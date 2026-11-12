/* Master-impressoes.html (M29): pedidos de impressão. A tela do desenho (fixture) e a do app usam a mesma `MasterImpressoesView`;
   no app, `page.tsx` passa os pedidos reais, os links dos chips e da paginação e o campo de busca (GET). */
import type { ReactNode } from "react";
import { STATUS_LABEL, STATUS_TONE, type PrintStatus } from "@/lib/master/print-orders";
import { MasterState } from "../master/MasterState";
import { Ico, MasterFrame, MHead } from "../master-kit";

export interface ImpressaoRow { id: string; code: string; event: string; who: string; product: string; qty: number; photos: string; status: PrintStatus; created: string; href?: string }
export interface ImpressoesChip { label: string; on?: boolean; href?: string }

export interface MasterImpressoesViewProps {
  caption?: string;
  /** Botão Exportar do cabeçalho (no app abre a folha M24). */
  exportButton?: ReactNode;
  chips?: ImpressoesChip[];
  /** Campo de busca: no app é um formulário GET (`action`), com os filtros ativos em `hidden`. */
  search?: { value?: string; action?: string; hidden?: Record<string, string> };
  rows?: ImpressaoRow[];
  rangeText?: string;
  pager?: { prev?: string; next?: string; page: number };
  /** No app a paginação entra no fluxo da página (no desenho ela fica fixa no rodapé da tela de 900 px). */
  inFlow?: boolean;
  /** Linha(s) vazia(s) quando os filtros não acham nada. */
  emptyFilter?: boolean;
}

const COLS = ".8fr 1.3fr 1.4fr .6fr .4fr .5fr .8fr .9fr .2fr";
export const IMPRESSOES_ROWS: ImpressaoRow[] = [
  { id: "1", code: "IMP-7K2Q", event: "Ana & Leo", who: "Ana Ribeiro · anfitriã", product: "Álbum", qty: 1, photos: "48", status: "solicitado", created: "hoje 08:12" },
  { id: "2", code: "IMP-3F9D", event: "Ana & Leo", who: "Bia Moraes · convidada", product: "Caixa", qty: 2, photos: "12", status: "em_producao", created: "ontem 19:40" },
  { id: "3", code: "IMP-9A1C", event: "Formatura Medicina UFMT", who: "Comissão 2026 · anfitrião", product: "Álbum", qty: 5, photos: "todas", status: "enviado", created: "08 nov 10:02" },
  { id: "4", code: "IMP-5T8M", event: "Chá da Maria", who: "Júlia Alves · anfitriã", product: "Caixa", qty: 1, photos: "30", status: "entregue", created: "02 nov 15:31" },
  { id: "5", code: "IMP-2B6X", event: "30 anos do Rafa", who: "Rafael Lima · anfitrião", product: "Álbum", qty: 1, photos: "60", status: "cancelado", created: "01 nov 09:18" },
  { id: "6", code: "IMP-8H4J", event: "Happy hour time Produto", who: "Lu Prado · anfitriã", product: "Caixa", qty: 3, photos: "24", status: "entregue", created: "28 out 14:05" },
];
export const IMPRESSOES_CHIPS: ImpressoesChip[] = [
  { label: "Todos 14", on: true }, { label: "Solicitado 4" }, { label: "Em produção 3" }, { label: "Enviado 2" }, { label: "Entregue 4" }, { label: "Cancelado 1" },
];
export const IMPRESSOES_CAPTION = "Pedidos de álbum e de caixa de fotos";

export function ExportButtonStatic() {
  return <button type="button" className="rv-btn rv-btn--sm"><Ico n="download" />Exportar</button>;
}

export function MasterImpressoesView({
  caption = IMPRESSOES_CAPTION, exportButton = <ExportButtonStatic />, chips = IMPRESSOES_CHIPS, search = {}, rows = IMPRESSOES_ROWS,
  rangeText = "1–14 de 14 · 25 por página", pager = { page: 1 }, inFlow, emptyFilter,
}: MasterImpressoesViewProps) {
  const g = { gridTemplateColumns: COLS };
  return (
    <>
      <MHead title="Impressões" caption={caption}>{exportButton}</MHead>
      <div className="row between" style={{ marginBottom: "14px" }}>
        <div className="row" style={{ gap: "8px", margin: "0" }}>
          {chips.map((c) => (c.href ? <a key={c.label} className={c.on ? "chip on" : "chip"} href={c.href}>{c.label}</a> : <span key={c.label} className={c.on ? "chip on" : "chip"}>{c.label}</span>))}
        </div>
        {(() => {
          const field = (
            <label className="msearch" style={{ width: "320px", height: "36px" }}>
              <Ico n="search" />
              <input name="q" defaultValue={search.value ?? ""} placeholder="Buscar por pedido, evento ou pessoa" aria-label="Buscar por pedido, evento ou pessoa" maxLength={80} />
            </label>
          );
          // no app o campo é um formulário GET (Enter busca); no desenho é só o campo
          return search.action
            ? <form className="row" style={{ gap: "8px" }} role="search" method="get" action={search.action}>{Object.entries(search.hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}{field}</form>
            : <div className="row" style={{ gap: "8px" }}>{field}</div>;
        })()}
      </div>
      {emptyFilter ? <MasterState variant="empty" title="Nenhum pedido neste filtro" text="Troque o filtro ou limpe a busca." /> : (
        <div className="mtable">
          <div className="mtr mth" style={g}>
            <span>Pedido</span><span>Evento</span><span>Quem pediu</span><span>Produto</span><span>Qtd.</span><span>Fotos</span><span>Status</span><span>Criado em</span><span />
          </div>
          {rows.map((r) => {
            const cells = (
              <>
                <span><code>{r.code}</code></span><span>{r.event}</span><span>{r.who}</span><span>{r.product}</span><span>{r.qty}</span><span>{r.photos}</span>
                <span><em className={`st st--${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</em></span><span>{r.created}</span><span><Ico n="chevron" /></span>
              </>
            );
            return r.href
              ? <a key={r.id} className="mtr" style={{ ...g, color: "inherit", textDecoration: "none" }} href={r.href} aria-label={`Abrir o pedido ${r.code}`}>{cells}</a>
              : <div key={r.id} className="mtr" style={g}>{cells}</div>;
          })}
        </div>
      )}
      <div className="mpager" style={inFlow ? { position: "static", marginTop: "16px" } : undefined}>
        <span>{rangeText}</span>
        <div>
          {pager.prev ? <a href={pager.prev} aria-label="Página anterior"><Ico n="back" /></a> : <Ico n="back" />}
          <b>{pager.page}</b>
          {pager.next ? <a href={pager.next} aria-label="Próxima página"><Ico n="chevron" /></a> : <Ico n="chevron" />}
        </div>
      </div>
    </>
  );
}

/** A tela do desenho (fixture), com a moldura do Master. */
export function MasterImpressoes() {
  return <MasterFrame current="impressoes"><MasterImpressoesView /></MasterFrame>;
}
