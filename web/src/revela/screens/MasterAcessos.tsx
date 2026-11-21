/* Acessos (Master): visitas, páginas, origem do tráfego, aparelhos e países. Somente leitura; dados da RPC admin_access_stats. */
import { MCard, MHead, MTable, Seg, Tiles } from "../master-kit";
import { MasterStatePage } from "../master/MasterState";
import { PERIODS, PERIOD_LABEL, countryName, mediumLabel, perVisit, seriesBars, share, type AccessStats, type OriginConversion, type Period } from "@/lib/master/access-stats";

export const ACESSOS_AREA = "Acessos";
const nf = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100).replace(/\s/g, " ");

/** Eventos criados no período por origem de quem criou (primeiro toque): quantos receberam convidado e quantos pagaram. */
export function ConversaoPorOrigem({ data }: { data: OriginConversion }) {
  return (
    <>
      <TabelaConversao title="Conversão por origem" caption="Eventos criados no período, pela origem da primeira visita de quem criou. Sem equipe e sem testes." rows={data.rows} />
      {data.rowsLast && <TabelaConversao title="Conversão pela última origem" caption="Os mesmos eventos, pela origem da última visita antes de criar (quem conheceu por um canal e voltou por outro)." rows={data.rowsLast} />}
    </>
  );
}

function TabelaConversao({ title, caption, rows }: { title: string; caption: string; rows: OriginConversion["rows"] }) {
  const data = { rows };
  return (
    <MCard style={{ marginTop: "14px", paddingBottom: "8px" }}>
      <h2 className="rv-title" style={{ fontSize: "18px" }}>{title}</h2>
      <p className="rv-caption">{caption}</p>
      <MTable cols="1.3fr .9fr 1.1fr .6fr .8fr .6fr .8fr" head={["Origem", "Tipo", "Campanha", "Eventos", "Com convidado", "Pagos", "Receita"]}
        empty="Nenhum evento criado no período."
        rows={data.rows.map((r) => ({ key: `${r.source}|${r.medium}|${r.campaign ?? ""}`,
          cells: [r.source, r.medium === "—" ? "—" : mediumLabel(r.medium), r.campaign ?? "—", nf(r.events), `${nf(r.activated)} · ${share(r.activated, r.events)}`, `${nf(r.paid)} · ${share(r.paid, r.events)}`, brl(r.revenueCents)] }))} />
    </MCard>
  );
}

export function MasterAcessosView({ stats, period, conversion }: { stats: AccessStats; period: Period; conversion?: OriginConversion | null }) {
  const { totals } = stats;
  const bars = seriesBars(stats.series);
  const entriesTotal = stats.sources.reduce((n, s) => n + s.entries, 0);
  const devTotal = stats.devices.reduce((n, d) => n + d.visitors, 0);
  const ctyTotal = stats.countries.reduce((n, c) => n + c.visitors, 0);
  return (
    <>
      <MHead title={ACESSOS_AREA} caption="Quem chegou ao Revela e de onde veio · sem cookies e sem guardar IP">
        <Seg items={PERIODS.map((p) => ({ label: PERIOD_LABEL[p], href: `/master/acessos?dias=${p}`, on: p === period }))} />
      </MHead>
      <Tiles items={[
        { label: "Visitantes", value: nf(totals.visitors), note: period === 1 ? "pessoas distintas hoje" : "distintas por dia, somadas" },
        { label: "Visualizações", value: nf(totals.views), note: "páginas abertas" },
        { label: "Visitas", value: nf(totals.entries), note: "chegadas ao site" },
        { label: "Páginas por visitante", value: perVisit(totals.views, totals.visitors), note: "média no período" },
      ]} />
      <div className="mgrid2" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Visitantes por dia</h2>
          <div className="mmini" style={{ marginTop: "12px" }}>
            <div className="row between"><span>Últimos {Math.min(period, 90)} {Math.min(period, 90) === 1 ? "dia" : "dias"}</span><b>{nf(totals.visitors)}</b></div>
            <div className="bars" role="img" aria-label={`Visitantes por dia nos últimos ${period} dias`}>
              {bars.map((b, i) => <div key={i} title={b.title}><i style={{ height: `${b.height}%` }} className={b.on ? "on" : undefined} /><span>{b.label}</span></div>)}
            </div>
          </div>
        </MCard>
        <MCard style={{ paddingBottom: "8px" }}>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Aparelhos</h2>
          <MTable cols="1.4fr .8fr .6fr" head={["Aparelho", "Visitantes", "%"]} empty="Sem visitas no período."
            rows={stats.devices.map((d) => ({ key: d.device, cells: [d.device[0].toUpperCase() + d.device.slice(1), nf(d.visitors), share(d.visitors, devTotal)] }))} />
        </MCard>
      </div>
      <div className="mgrid2" style={{ marginTop: "14px" }}>
        <MCard style={{ paddingBottom: "8px" }}>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>De onde vêm as visitas</h2>
          <MTable cols="1.5fr 1fr .7fr .6fr" head={["Origem", "Tipo", "Visitas", "%"]} empty="Sem visitas no período."
            rows={stats.sources.map((s) => ({ key: `${s.source}|${s.medium}`, cells: [s.source, mediumLabel(s.medium), nf(s.entries), share(s.entries, entriesTotal)] }))} />
        </MCard>
        <MCard style={{ paddingBottom: "8px" }}>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Sites que enviaram gente</h2>
          <MTable cols="2fr .7fr" head={["Site", "Visitas"]} empty="Nenhum site de origem ainda."
            rows={stats.referrers.map((r) => ({ key: r.host, cells: [r.host, nf(r.entries)] }))} />
        </MCard>
      </div>
      <div className="mgrid2" style={{ marginTop: "14px" }}>
        <MCard style={{ paddingBottom: "8px" }}>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Páginas mais vistas</h2>
          <MTable cols="2fr .7fr .8fr" head={["Página", "Vistas", "Visitantes"]} empty="Sem páginas medidas ainda."
            rows={stats.pages.map((p) => ({ key: p.path, cells: [<code key="c">{p.path}</code>, nf(p.views), nf(p.visitors)] }))} />
        </MCard>
        <MCard style={{ paddingBottom: "8px" }}>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Países</h2>
          <MTable cols="1.6fr .8fr .6fr" head={["País", "Visitantes", "%"]} empty="Sem visitas no período."
            rows={stats.countries.map((c) => ({ key: c.country, cells: [countryName(c.country), nf(c.visitors), share(c.visitors, ctyTotal)] }))} />
        </MCard>
      </div>
      {stats.campaigns.length > 0 && (
        <MCard style={{ marginTop: "14px", paddingBottom: "8px" }}>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Campanhas (UTM)</h2>
          <MTable cols="1.6fr 1.2fr .7fr" head={["Campanha", "Origem", "Visitas"]}
            rows={stats.campaigns.map((c) => ({ key: `${c.campaign}|${c.source}`, cells: [c.campaign, c.source, nf(c.entries)] }))} />
        </MCard>
      )}
      {conversion && <ConversaoPorOrigem data={conversion} />}
      <p className="rv-caption" style={{ marginTop: "14px" }}>
        “Visitantes” são pessoas distintas por dia, somadas no período: sem cookies, o mesmo aparelho em dias diferentes conta de novo. Robôs e quem ativou “Não rastrear” ficam de fora.
      </p>
    </>
  );
}

export function MasterAcessosEstado({ variant }: { variant: "empty" | "error" | "denied" | "loading" }) {
  return <MasterStatePage area={ACESSOS_AREA} variant={variant} cols={4} rows={6} {...(variant === "empty" ? { title: "Ainda sem visitas medidas", text: "A medição começou agora: os números aparecem conforme as pessoas abrem o site." } : {})} />;
}
