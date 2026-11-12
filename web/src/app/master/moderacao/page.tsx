import { MState } from "@/revela/master-kit";
import { MasterModeracaoView } from "@/revela/screens/MasterModeracao";
import { requireMaster, rpc } from "../data";
import { formatReasonCounts, type ReasonCounts } from "@/features/moderation/report-reasons";
import { relWhen } from "../format";
import { ModerateComment } from "./ModerateComment";
import { ModeratePhoto } from "./ModeratePhoto";
import { MasterPager } from "../MasterPager";
import { pageNumber, PAGE_SIZE } from "../pagination";

interface Queue {
  total:number;counts:{fotos:number;comentarios:number;bloqueados:number};items:unknown[];
  photos: { photoId: string; eventId: string; eventTitle: string; reports: number; hidden: boolean; reasons?: ReasonCounts }[];
  comments: { id: string; eventTitle: string; authorName: string | null; body: string | null; reports: number; hidden: boolean; hiddenBy: string | null; reasons?: ReasonCounts }[];
  blocked: { eventId: string; eventTitle: string; name: string | null; blockedAt: string }[];
}
const plural = (n: number, reasons?: ReasonCounts) => {
  const r = formatReasonCounts(reasons);
  return `${n} ${n === 1 ? "denúncia" : "denúncias"}${r ? ` · ${r}` : ""}`;
};

/** M09 · Moderação: denúncias de todos os eventos. Fotos aparecem só como metadados (o console não exibe fotografias privadas). */
export default async function Moderacao({ searchParams }: { searchParams: Promise<{ aba?: string;q?:string;p?:string }> }) {
  const sb = await requireMaster();
  const sp=await searchParams,p=pageNumber(sp.p),search=sp.q?.trim().slice(0,80)||"";
  const aba = sp.aba;
  const tab = aba === "comentarios" || aba === "bloqueados" ? aba : "fotos";
  const r = await rpc<Queue>(sb, "admin_master_list",{p_kind:tab,p_search:search||null,p_offset:(p-1)*PAGE_SIZE});
  if (r.state !== "ok") return <MState kind={r.state === "denied" ? "denied" : "error"} text={r.state === "error" ? `Não foi possível carregar: ${r.message}` : undefined} />;
  const q = {...r.data,photos:tab==="fotos"?r.data.items as Queue["photos"]:[],comments:tab==="comentarios"?r.data.items as Queue["comments"]:[],blocked:tab==="bloqueados"?r.data.items as Queue["blocked"]:[]};
  return (
    <MasterModeracaoView
      tab={tab}
      tabs={[
        { label: `Fotos ${q.counts.fotos}`, href: "/master/moderacao", on: tab === "fotos" },
        { label: `Comentários ${q.counts.comentarios}`, href: "/master/moderacao?aba=comentarios", on: tab === "comentarios" },
        { label: `Participantes bloqueados ${q.counts.bloqueados}`, href: "/master/moderacao?aba=bloqueados", on: tab === "bloqueados" },
      ]}
      pager={<MasterPager total={q.total} page={p} path="/master/moderacao" query={{aba:tab==="fotos"?undefined:tab,q:search}}/>}
      photos={q.photos.map((p) => ({ key: p.photoId, event: p.eventTitle, reports: plural(p.reports, p.reasons), reason: p.hidden ? "Já escondida" : `foto ${p.photoId.slice(0, 8)}`, actions: <ModeratePhoto id={p.photoId} event={p.eventTitle}/> }))}
      comments={q.comments.map((c) => ({
        key: c.id, event: c.eventTitle, reports: plural(c.reports, c.reasons), author: c.authorName ?? "—", body: c.body ?? "",
        status: c.hidden ? `escondido${c.hiddenBy ? ` por ${c.hiddenBy}` : ""}` : undefined, actions: <ModerateComment id={c.id} hidden={c.hidden} />,
      }))}
      blocked={q.blocked.map((b) => ({ key: `${b.eventId}-${b.blockedAt}`, event: b.eventTitle, name: b.name ?? "—", when: relWhen(b.blockedAt) }))}
    />
  );
}
