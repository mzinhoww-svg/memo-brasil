import { num, requireMaster, rpc, window } from "../data";
import { PageHead, StateBox, Table } from "../ui";

interface Day { day: string; eventsCreated: number; participantsJoined: number; photosUploaded: number; uploadsFailed: number }
export default async function Analytics() {
  const sb = await requireMaster();
  const r = await rpc<{ series: Day[]; from: string; to: string }>(sb, "admin_dashboard_metrics", window(30));
  return (
    <>
      <PageHead titulo="Analytics" texto="Série diária dos últimos 30 dias, calculada no banco (fuso de Cuiabá). Sem estimativas." />
      {r.state !== "ok" ? <StateBox load={r} /> : <Table vazio="Sem atividade no período." cols={[{ k: "d", h: "Dia" }, { k: "e", h: "Eventos criados", num: true }, { k: "p", h: "Entradas", num: true }, { k: "f", h: "Fotos", num: true }, { k: "x", h: "Falhas", num: true }]}
        rows={[...r.data.series].reverse().map((d) => ({ d: new Date(d.day + "T12:00:00").toLocaleDateString("pt-BR"), e: num(d.eventsCreated), p: num(d.participantsJoined), f: num(d.photosUploaded), x: num(d.uploadsFailed) }))} />}
    </>
  );
}
