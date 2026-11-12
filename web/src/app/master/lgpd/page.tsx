import { MState } from "@/revela/master-kit";
import { type LgpdRow } from "@/revela/screens/MasterLgpd";
import { requireMaster, rpc } from "../data";
import { RetentionDetails } from "./RetentionDetails";
import { shortDay } from "../format";
import { MasterPager } from "../MasterPager";
import { pageNumber, PAGE_SIZE, type ListSearch } from "../pagination";

interface L { total:number;slaDays: number; items: { userId: string; requestedAt: string; processedAt: string | null; status: string; daysOpen: number | null; overdue: boolean }[] }

/** M12 · LGPD: pedidos de exclusão de conta (prazo de resposta de 15 dias) e a retenção em vigor (política 2026-10-22-v1, só leitura). */
export default async function Lgpd({searchParams}:{searchParams?:Promise<ListSearch>}) {
  const sb = await requireMaster();
  const sp=await searchParams??{},p=pageNumber(sp.p),q=sp.q?.trim().slice(0,80)||"";
  const r = await rpc<L>(sb, "admin_master_list",{p_kind:"lgpd",p_search:q||null,p_offset:(p-1)*PAGE_SIZE});
  if (r.state !== "ok") return <MState kind={r.state === "denied" ? "denied" : "error"} text={r.state === "error" ? `Não foi possível carregar: ${r.message}` : undefined} />;
  const policy = await rpc<{photosAfterEndDays:number;unrevealedAfterEndDays:number;ipHashDays:number|null;backupDays:number|null}>(sb,"admin_master_retention");
  if(policy.state!=="ok")return <MState kind={policy.state==="denied"?"denied":"error"}/>;
  const days=(n:number|null)=>n===null?"Não definido no banco":`${n} dias`;
  const sla = r.data.slaDays;
  const rows: LgpdRow[] = r.data.items.map((i) => ({
    key: `${i.userId}-${i.requestedAt}`, when: shortDay(i.requestedAt), who: `conta ${i.userId.slice(0, 8)}…`, kind: "Excluir conta",
    due: shortDay(new Date(Date.parse(i.requestedAt) + sla * 86_400_000).toISOString()),
    tone: i.processedAt ? "ok" : i.overdue ? "bad" : "wait", status: i.processedAt ? "Concluído" : i.overdue ? "Atrasado" : "Em andamento",
  }));
  return (
    <RetentionDetails rows={rows} pager={<MasterPager total={r.data.total} page={p} path="/master/lgpd" query={{q}}/>} retention={[
      {key:"1",icon:"clock",label:"Fotos depois da revelação",value:`${policy.data.photosAfterEndDays} dias após encerramento`},
      {key:"2",icon:"clock",label:"Evento que nunca revelou",value:`${policy.data.unrevealedAfterEndDays} dias após encerramento`},
      {key:"3",icon:"clock",label:"Hash de IP nos logs",value:days(policy.data.ipHashDays)},
      {key:"4",icon:"clock",label:"Backups",value:days(policy.data.backupDays)},
    ]}/>
  );
}
