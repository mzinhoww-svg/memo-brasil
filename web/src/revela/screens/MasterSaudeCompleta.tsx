/* Master-saude-completa.html (M27) e variantes: markup e classes da referência via master-kit; dados por props (padrão = desenho).
   Somente leitura: serviços, armazenamento (fotos, identidade visual, uploads, órfãos, crescimento por dia) e os jobs agendados com as últimas execuções. */
import type { ReactNode } from "react";
import { MasterStatePage } from "../master/MasterState";
import { MCard, MHead, MTable, MasterFrame, St, type Tone } from "../master-kit";
import type { Bar, GaugeRow, JobRow } from "@/lib/master/health";

export interface ServiceChip { key: string; label: string; tone: Tone; status: string }

export const SAUDE_AREA = "Storage e saúde";
export const SAUDE_EMPTY = { title: "Sem leituras ainda", text: "As medições aparecem depois da primeira execução dos jobs." };

const REF_CHIPS: ServiceChip[] = [
  { key: "db", label: "Banco", tone: "ok", status: "Normal" }, { key: "storage", label: "Storage", tone: "ok", status: "Normal" },
  { key: "webhook", label: "Webhook ValidaPay", tone: "ok", status: "Normal" }, { key: "reveal", label: "Fila de revelação", tone: "ok", status: "Normal" },
  { key: "email", label: "E-mail", tone: "wait", status: "Atenção" },
];
const REF_GAUGES: GaugeRow[] = [
  { key: "fotos", label: "Fotos · 97.214 arquivos", value: "412 GB de 1 TB", pct: 41 },
  { key: "identidade", label: "Identidade visual · 1.108 arquivos", value: "2,1 GB", pct: 2 },
  { key: "andamento", label: "Uploads em andamento", value: "14", pct: 7 },
  { key: "falha", label: "Uploads com falha (24 h)", value: "21", pct: 10, warn: true },
  { key: "orfaos", label: "Órfãos", value: "312 arquivos · 0,9 GB", pct: 3, warn: true },
];
const H = [17, 33, 17, 33, 50, 17, 50, 67, 33, 33, 33, 50, 83, 50, 33, 50, 67, 83, 50, 33, 33, 67, 83, 50, 50, 50, 67, 100, 67, 50];
const REF_BARS: Bar[] = H.map((height, i) => ({ height, label: i % 5 === 4 ? String(i + 1) : "", on: i === 27 }));
const ok = [false, false, false, false, false, false, false, false];
const dots = (...bad: number[]) => ok.map((_, i) => bad.includes(i));
const REF_JOBS: JobRow[] = [
  { key: "1", name: "Revelar eventos na hora", last: "hoje 08:42", tone: "ok", label: "ok", fails: 0, dots: dots() },
  { key: "2", name: "Conciliar pagamentos", last: "hoje 08:40", tone: "ok", label: "ok", fails: 0, dots: dots(3) },
  { key: "3", name: "Expirar uploads parados", last: "hoje 08:30", tone: "ok", label: "ok", fails: 0, dots: dots() },
  { key: "4", name: "Expirar identidade visual", last: "hoje 03:00", tone: "ok", label: "ok", fails: 0, dots: dots() },
  { key: "5", name: "Aplicar retenção", last: "hoje 03:10", tone: "ok", label: "ok", fails: 0, dots: dots() },
  { key: "6", name: "Limpar excluídos", last: "hoje 03:20", tone: "bad", label: "falhou", fails: 2, dots: dots(6, 7) },
  { key: "7", name: "Limpar convidados órfãos", last: "hoje 03:30", tone: "ok", label: "ok", fails: 0, dots: dots() },
  { key: "8", name: "Integridade da auditoria", last: "hoje 04:00", tone: "ok", label: "ok", fails: 0, dots: dots() },
];

export interface SaudeCompletaProps {
  caption?: string;
  chips?: ServiceChip[];
  gauges?: GaugeRow[];
  bars?: Bar[];
  growth?: string;
  jobs?: JobRow[];
  /** Avisos acima dos cartões (limites do runbook). */
  alerts?: ReactNode;
}

export function MasterSaudeCompletaView({ caption = "Situação dos serviços agora · atualizado às 08:42", chips = REF_CHIPS, gauges = REF_GAUGES, bars = REF_BARS, growth = "+38 GB", jobs = REF_JOBS, alerts }: SaudeCompletaProps = {}) {
  return (
    <>
      <MHead title={SAUDE_AREA} caption={caption} />
      {alerts}
      <div className="row" style={{ gap: "8px", marginBottom: "14px" }}>
        {chips.map((c) => <span className="chip" key={c.key}>{c.label} <St tone={c.tone}>{c.status}</St></span>)}
      </div>
      <div className="mgrid2" style={{ gridTemplateColumns: "1fr 1.6fr" }}>
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Armazenamento</h2>
          <div className="stack" style={{ marginTop: "14px", gap: "12px" }}>
            {gauges.map((g) => (
              <div className={g.warn ? "gauge gauge--warn" : "gauge"} key={g.key}>
                <div className="row between"><span>{g.label}</span><b>{g.value}</b></div>
                <i><s style={{ width: `${Math.min(100, Math.max(0, g.pct))}%` }} /></i>
              </div>
            ))}
          </div>
          <div className="mmini" style={{ marginTop: "16px" }}>
            <div className="row between"><span>Crescimento por dia (30 dias)</span><b>{growth}</b></div>
            <div className="bars">
              {bars.map((b, i) => <div key={i}><i style={{ height: `${b.height}%` }} className={b.on ? "on" : undefined} /><span>{b.label}</span></div>)}
            </div>
          </div>
        </MCard>
        <MCard style={{ paddingBottom: "8px" }}>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Jobs agendados</h2>
          <MTable cols="1.8fr 1.15fr .6fr 1.15fr .9fr" head={["Job", "Última execução", "Status", "Falhas seguidas", "Últimas 8"]} rows={jobs.map((j) => ({
            key: j.key, cells: [j.name, j.last ?? "—", <St key="s" tone={j.tone}>{j.label}</St>, String(j.fails),
              <span key="r" className="runs">{j.dots.map((bad, i) => <i key={i} className={bad ? "bad" : ""} />)}</span>],
          }))} />
        </MCard>
      </div>
    </>
  );
}

export function MasterSaudeCompleta(props: SaudeCompletaProps = {}) {
  return <MasterFrame current="saude"><MasterSaudeCompletaView {...props} /></MasterFrame>;
}

/** Estado de página inteira (M27.v, .e, .p, .c). */
export function MasterSaudeCompletaEstado({ variant, caption = "Situação dos serviços agora · atualizado às 08:42" }: { variant: "empty" | "error" | "denied" | "loading"; caption?: string }) {
  return <MasterStatePage area={SAUDE_AREA} variant={variant} caption={variant === "empty" ? caption : undefined} cols={5} rows={8} {...(variant === "empty" ? SAUDE_EMPTY : {})} />;
}
