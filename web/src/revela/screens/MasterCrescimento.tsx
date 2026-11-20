/* GF-01 — funil agregado exclusivamente para Master, por coorte de criação de eventos. */
import { MCard, MHead, MNote, MTable, Seg, Tiles, type MRow } from "../master-kit";
import {
  COHORT_PERIODS, formatGrowthCount as nf, formatGrowthMoney as brl, formatGrowthRate as rate,
  type CohortPeriod, type GrowthCohort,
} from "@/features/growth/cohort";

export function MasterCrescimentoView({ stats, period }: { stats: GrowthCohort; period: CohortPeriod }) {
  const t = stats.totals;
  const rows: MRow[] = [...stats.series].reverse().map((s) => ({
    key: s.day,
    cells: [
      new Date(`${s.day}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" }),
      nf(s.created), nf(s.activated), nf(s.checkoutEvents), nf(s.paidEvents),
    ],
  }));
  return (
    <>
      <MHead title="Funil de crescimento" caption="Jornada real por coorte de criação de eventos · somente Master">
        <Seg items={COHORT_PERIODS.map((d) => ({
          label: `${d} dias`, href: `/master/pagamentos/crescimento?dias=${d}`, on: d === period,
        }))} />
      </MHead>
      <Tiles items={[
        { label: "Eventos criados", value: nf(t.created), note: "não teste e não excluídos" },
        { label: "Eventos ativados", value: nf(t.activated), note: `${rate(t.activated, t.created)} dos criados · convidado + foto válida` },
        { label: "Checkout iniciado", value: nf(t.checkoutEvents), note: `${rate(t.checkoutEvents, t.created)} dos criados` },
        { label: "Eventos com pagamento", value: nf(t.paidEvents), note: `${rate(t.paidEvents, t.checkoutEvents)} dos que iniciaram checkout` },
        { label: "Pedidos atualmente pagos", value: brl(t.paidCents), note: `${nf(t.paidOrders)} pedidos em produção · bruto` },
      ]} />
      <div className="mgrid2" style={{ marginTop: "14px" }}>
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Etapas da ativação</h2>
          <p className="rv-caption" style={{ marginTop: "8px" }}>Eventos criados entre os dias selecionados. A atividade posterior é observada até agora.</p>
          <MTable cols="2fr 1fr" head={["Marco", "Eventos"]} rows={[
            { key: "created", cells: ["Criados", nf(t.created)] },
            { key: "withGuests", cells: ["Com convidado", nf(t.withGuests)] },
            { key: "withPhotos", cells: ["Com foto pronta", nf(t.withPhotos)] },
            { key: "activated", cells: ["Com convidado e foto", nf(t.activated)] },
            { key: "checkout", cells: ["Com checkout de produção", nf(t.checkoutEvents)] },
            { key: "paid", cells: ["Com pedido pago", nf(t.paidEvents)] },
          ]} />
        </MCard>
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Monetização e exceções</h2>
          <p className="rv-caption" style={{ marginTop: "8px" }}>Pagamento aprovado precisa estar no banco com status pago e data de liquidação registrada.</p>
          <MTable cols="2fr 1fr" head={["Indicador", "Quantidade"]} rows={[
            { key: "paidOrders", cells: ["Pedidos atualmente pagos", nf(t.paidOrders)] },
            { key: "courtesy", cells: ["Eventos com cortesia ativa", nf(t.courtesyEvents)] },
            { key: "reversed", cells: ["Pedidos estornados ou em disputa", nf(t.reversedOrDisputedOrders)] },
          ]} />
          <p className="rv-caption" style={{ marginTop: "12px" }}>Cortesias podem coexistir com pagamentos. Pedidos estornados ou em disputa não entram nos valores atualmente pagos. O total monetário não representa receita líquida contábil e não desconta estornos parciais.</p>
        </MCard>
      </div>
      <MCard style={{ marginTop: "14px" }}>
        <h2 className="rv-title" style={{ fontSize: "18px" }}>Coortes por dia de criação</h2>
        <p className="rv-caption" style={{ margin: "8px 0 12px" }}>Todos os números desta tabela se referem aos mesmos eventos criados naquele dia; não são ações ocorridas necessariamente no mesmo dia.</p>
        <MTable cols="1.1fr 1fr 1fr 1fr 1fr" head={["Criação", "Criados", "Ativados", "Checkout", "Pagos"]} rows={rows} empty="Nenhuma coorte no período." />
      </MCard>
      <MNote style={{ marginTop: "14px" }}>
        Visitas e origens UTM estão no painel <a href="/master/acessos">Acessos</a> e não são vinculadas a estas coortes.
        Sem uma atribuição consentida e verificável, não é correto calcular receita por campanha, CAC ou ROAS a partir de cliques anônimos.
        Eventos de teste, hosts de teste e pedidos sandbox ficam fora dos indicadores.
      </MNote>
      <p className="rv-caption" style={{ marginTop: "14px" }}>
        Período: {period} dias corridos, no fuso America/Cuiaba. Consulta agregada gerada em {new Date(stats.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" })}. Nenhum dado de convidados ou biometria é exposto.
      </p>
    </>
  );
}
