import Link from "next/link";
import { bytes, num, requireMaster, rpc, window } from "./data";
import { Metric, PageHead, StateBox } from "./ui";

interface Metrics {
  events: { created: number; active: number; ended: number; total: number };
  organizers: { active: number; total: number };
  participants: { joined: number; total: number };
  photos: { uploaded: number; total: number };
  uploads: { failed: number; inProgress: number };
  reveals: { pending: number; overdue: number };
  storage: { photosBytes: number; photosObjects: number; brandingBytes: number; brandingObjects: number };
  from: string; to: string;
}
const PERIODOS = [7, 30, 90];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const sb = await requireMaster();
  const dias = PERIODOS.includes(Number((await searchParams).dias)) ? Number((await searchParams).dias) : 30;
  const r = await rpc<Metrics>(sb, "admin_dashboard_metrics", window(dias));
  return (
    <>
      <PageHead titulo="Visão geral" texto={`Indicadores reais da plataforma; períodos de criação e envio consideram os últimos ${dias} dias.`}
        acao={<nav aria-label="Período" style={{ display: "flex", gap: 8 }}>{PERIODOS.map((d) => <Link key={d} href={`/master?dias=${d}`} className="adm-badge" aria-current={d === dias ? "true" : undefined} style={d === dias ? { background: "var(--ink)", color: "var(--bg)" } : undefined}>{d} dias</Link>)}</nav>} />
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <div className="adm-grid">
          <Metric rotulo="Eventos criados" valor={num(r.data.events.created)} nota={`${num(r.data.events.total)} no total`} />
          <Metric rotulo="Eventos ativos" valor={num(r.data.events.active)} />
          <Metric rotulo="Eventos concluídos" valor={num(r.data.events.ended)} />
          <Metric rotulo="Organizadores ativos" valor={num(r.data.organizers.active)} nota={`${num(r.data.organizers.total)} no total`} />
          <Metric rotulo="Participantes (período)" valor={num(r.data.participants.joined)} nota={`${num(r.data.participants.total)} no total`} />
          <Metric rotulo="Fotos enviadas (período)" valor={num(r.data.photos.uploaded)} nota={`${num(r.data.photos.total)} no total`} />
          <Metric rotulo="Uploads com falha" valor={num(r.data.uploads.failed)} nota={`${num(r.data.uploads.inProgress)} em andamento`} />
          <Metric rotulo="Revelações pendentes" valor={num(r.data.reveals.pending)} />
          <Metric rotulo="Revelações atrasadas" valor={num(r.data.reveals.overdue)} />
          <Metric rotulo="Storage de fotos" valor={bytes(r.data.storage.photosBytes)} nota={`${num(r.data.storage.photosObjects)} arquivos`} />
          <Metric rotulo="Storage de identidade" valor={bytes(r.data.storage.brandingBytes)} nota={`${num(r.data.storage.brandingObjects)} arquivos`} />
        </div>
      )}
    </>
  );
}
