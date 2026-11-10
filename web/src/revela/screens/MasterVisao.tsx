/* Master-visao.html (M01): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import { BtnLink, MCard, MHead, MRow, MTable, MasterFrame, St, Tiles, type Tone } from "../master-kit";

export interface PayRow { key: string; when: string; event: string; plan: string; method: string; amount: string; tone: Tone; status: string; href?: string }
export interface VisaoProps {
  caption?: string;
  tiles?: { label: string; value: string; note?: string }[];
  /** Barras do gráfico de receita por dia (altura em %, rótulo a cada 5 dias, `on` = maior dia). */
  bars?: { pct: number; label?: string; on?: boolean }[];
  days?: 7 | 30;
  periodHref?: (d: 7 | 30) => string;
  plans?: { name: string; count: number; pct: number }[];
  payments?: PayRow[];
  allHref?: string;
  /** `null` esconde o botão (o app não exporta); `undefined` mantém o do desenho. */
  exportHref?: string | null;
  /** Aviso quando algum dado não carregou. */
  notice?: React.ReactNode;
}

const REF_BARS = [17, 28, 11, 33, 44, 22, 50, 67, 39, 28, 33, 56, 78, 50, 33, 44, 61, 83, 50, 39, 33, 67, 89, 56, 44, 50, 72, 100, 61, 50].map((pct, i) => ({ pct, label: (i + 1) % 5 === 0 ? String(i + 1) : undefined, on: pct === 100 }));
const REF_PAYMENTS: PayRow[] = [
  { key: "1", when: "hoje 08:42", event: "Ana & Leo", plan: "Casamento", method: "Pix", amount: "R$ 189,00", tone: "ok", status: "Pago" },
  { key: "2", when: "hoje 08:10", event: "30 anos do Rafa", plan: "Festa", method: "Cartão", amount: "R$ 29,00", tone: "bad", status: "Recusado" },
  { key: "3", when: "ontem 21:55", event: "Formatura Medicina", plan: "Grande", method: "Pix", amount: "R$ 349,00", tone: "wait", status: "Pendente" },
];

export function MasterVisaoView({
  caption = "Novembro de 2026 · atualizado às 08:42",
  tiles = [
    { label: "Receita do mês", value: "R$ 12.430", note: "+18% sobre outubro" },
    { label: "Eventos ativos", value: "41", note: "6 revelam hoje" },
    { label: "Fotos hoje", value: "8.912", note: "pico às 22:40" },
    { label: "Pedidos pendentes", value: "3", note: "Pix aguardando" },
  ],
  bars = REF_BARS, days = 30, periodHref, plans = [
    { name: "Grátis", count: 214, pct: 100 }, { name: "Festa", count: 38, pct: 18 }, { name: "Celebração", count: 22, pct: 10 }, { name: "Casamento", count: 31, pct: 14 }, { name: "Grande", count: 4, pct: 2 },
  ], payments = REF_PAYMENTS, allHref, exportHref, notice,
}: VisaoProps = {}) {
  const cols = "1fr 1.4fr 1fr 0.8fr 0.8fr 0.8fr";
  const rows: MRow[] = payments.map((p) => ({ key: p.key, cells: [p.when, p.event, p.plan, p.method, p.amount, <St key="s" tone={p.tone}>{p.status}</St>] }));
  const seg = (d: 7 | 30) => (periodHref ? <a key={d} className={days === d ? "on" : ""} href={periodHref(d)}>{d} dias</a> : <span key={d} className={days === d ? "on" : ""}>{d} dias</span>);
  return (
    <>
      <MHead title="Visão geral" caption={caption}>
        {exportHref === null ? null : exportHref ? <BtnLink href={exportHref} icon="download">Exportar</BtnLink> : <button className="rv-btn rv-btn--sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>Exportar</button>}
      </MHead>
      {notice}
      <Tiles items={tiles} />
      <div className="mgrid2">
        <MCard>
          <div className="row between">
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Receita por dia</h2>
            <div className="seg">{seg(7)}{seg(30)}</div>
          </div>
          <div className="bars">
            {bars.map((b, i) => (
              <div key={i}>
                <i style={{ height: `${b.pct}%` }} className={b.on ? "on" : undefined} />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </MCard>
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Vendas por plano</h2>
          <div className="stack" style={{ marginTop: "16px" }}>
            {plans.map((p) => (
              <div className="hbar" key={p.name}>
                <div className="row between"><span>{p.name}</span><b>{p.count}</b></div>
                <i><s style={{ width: `${p.pct}%` }} /></i>
              </div>
            ))}
          </div>
        </MCard>
      </div>
      <MCard style={{ marginTop: "16px" }}>
        <div className="row between">
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Últimos pagamentos</h2>
          <a className="link" href={allHref}>Ver todos</a>
        </div>
        <MTable cols={cols} head={["Quando", "Evento", "Plano", "Método", "Valor", "Situação"]} rows={rows} empty="Nenhum pagamento ainda." />
      </MCard>
    </>
  );
}

export function MasterVisao(props: VisaoProps = {}) {
  return <MasterFrame current="visao"><MasterVisaoView {...props} /></MasterFrame>;
}
