/* Master-pagamentos.html (M05): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import type { ReactNode } from "react";
import { Ico, MHead, MRow, MTable, MasterFrame, St, Tiles, type Tone } from "../master-kit";

export interface PagamentoRow { key: string; when: string; order: string; event: string; plan: string; method: string; amount: string; tone: Tone; status: string; href?: string }
export interface PagamentosProps {
  caption?: string;
  tiles?: { label: string; value: string; note?: string }[];
  chips?: { label: string; href: string; on?: boolean }[];
  rows?: PagamentoRow[];
  /** Botões do cabeçalho (o desenho traz "Conciliar agora" e "Exportar"; o app só mostra o que existe). */
  actions?: ReactNode;
  /** Avisos acima da tabela (divergências). */
  alerts?: ReactNode;
  empty?: string;
  pager?: ReactNode;
}

const REF_ROWS: PagamentoRow[] = [
  { key: "1", when: "hoje 08:42", order: "#RV-2041", event: "Ana & Leo", plan: "Casamento", method: "Pix", amount: "R$ 189,00", tone: "ok", status: "Pago" },
  { key: "2", when: "hoje 08:10", order: "#RV-2040", event: "30 anos do Rafa", plan: "Festa", method: "Cartão •4417", amount: "R$ 29,00", tone: "bad", status: "Recusado" },
  { key: "3", when: "ontem 21:55", order: "#RV-2039", event: "Formatura Medicina", plan: "Grande", method: "Pix", amount: "R$ 349,00", tone: "wait", status: "Pendente" },
  { key: "4", when: "ontem 19:20", order: "#RV-2038", event: "Chá da Maria", plan: "Celebração", method: "Cartão •0091", amount: "R$ 89,00", tone: "ok", status: "Pago" },
  { key: "5", when: "ontem 18:02", order: "#RV-2037", event: "Bodas de prata", plan: "Casamento", method: "Pix", amount: "R$ 189,00", tone: "bad", status: "Estornar" },
  { key: "6", when: "07 nov 15:41", order: "#RV-2036", event: "Aniversário Theo", plan: "Festa", method: "Pix", amount: "R$ 29,00", tone: "info", status: "Estornado" },
];
const REF_CHIPS = ["Todos", "Pix", "Cartão", "Pendentes", "Recusados", "Estornos"].map((label, i) => ({ label, href: "#", on: i === 0 }));

export function MasterPagamentosView({
  caption = "Cobranças da ValidaPay, conciliadas com os pedidos do Revela",
  tiles = [
    { label: "Pago no mês", value: "R$ 12.430", note: "71 pedidos" },
    { label: "Pendentes", value: "R$ 727", note: "3 Pix aguardando" },
    { label: "Recusados", value: "9", note: "cartão sem confirmação" },
    { label: "Para estornar", value: "1", note: "pago em duplicidade" },
  ],
  chips = REF_CHIPS, rows = REF_ROWS, actions, alerts, empty, pager,
}: PagamentosProps = {}) {
  const mrows: MRow[] = rows.map((r) => ({
    key: r.key,
    cells: [r.when, r.href ? <a key="o" href={r.href}>{r.order}</a> : r.order, r.event, r.plan, r.method, r.amount, <St key="s" tone={r.tone}>{r.status}</St>, r.href ? <a key="c" href={r.href} aria-label={`Abrir pedido ${r.order}`}><Ico n="chevron" /></a> : <Ico key="c" n="chevron" />],
  }));
  return (
    <>
      <MHead title="Pagamentos" caption={caption}>
        {actions ?? (
          <>
            <button className="rv-btn rv-btn--sm"><Ico n="refresh" />Conciliar agora</button>
            <button className="rv-btn rv-btn--sm"><Ico n="download" />Exportar</button>
          </>
        )}
      </MHead>
      <Tiles items={tiles} />
      <div className="row" style={{ gap: "8px", margin: "4px 0 14px" }}>
        {chips.map((c) => <a key={c.label} className={c.on ? "chip on" : "chip"} href={c.href}>{c.label}</a>)}
      </div>
      {alerts}
      <MTable cols="0.9fr 0.8fr 1.3fr 0.9fr 0.9fr 0.8fr 0.8fr 0.2fr" head={["Quando", "Pedido", "Evento", "Plano", "Método", "Valor", "Situação", ""]} rows={mrows} empty={empty ?? "Nenhum pedido neste filtro."} />
      {pager}
    </>
  );
}

export function MasterPagamentos(props: PagamentosProps = {}) {
  return <MasterFrame current="pagamentos"><MasterPagamentosView {...props} /></MasterFrame>;
}

