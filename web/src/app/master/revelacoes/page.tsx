import { MState } from "@/revela/master-kit";
import { MasterRevelacoesView, type RevelacaoRow } from "@/revela/screens/MasterRevelacoes";
import { requireMaster, rpc } from "../data";
import { nf, nowMs, relWhen } from "../format";
import { RevealNow } from "./RevealNow";
import { RetryEmails } from "./RetryEmails";
import { MasterPager } from "../MasterPager";
import { pageNumber, PAGE_SIZE, type ListSearch } from "../pagination";

interface Rev { id: string; title: string; revealAt: string | null; revealedAt: string | null; photos: number; emailOptIns: number; emailsSent: number; emailsFailed: number; emailsQueued: number }

/** M08 · Revelações: a fila do relógio do servidor, com o aviso por e-mail de cada evento (só números). */
export default async function Revelacoes({searchParams}:{searchParams?:Promise<ListSearch>}) {
  const sb = await requireMaster();
  const sp=await searchParams??{},p=pageNumber(sp.p),q=sp.q?.trim().slice(0,80)||"";
  const r = await rpc<{ items: Rev[];total:number }>(sb, "admin_master_list", { p_kind:"revelacoes",p_search:q||null,p_offset:(p-1)*PAGE_SIZE });
  if (r.state !== "ok") return <MState kind={r.state === "denied" ? "denied" : "error"} text={r.state === "error" ? `Não foi possível carregar: ${r.message}` : undefined} />;
  const notices=await rpc<Record<string,{enrolled:number;shown:number}>>(sb,"admin_master_native_notice_counts",{p_events:r.data.items.map(e=>e.id)});
  const now = nowMs();
  const rows: RevelacaoRow[] = r.data.items.map((e) => {
    const done = e.revealedAt != null;
    const late = !done && e.revealAt != null && Date.parse(e.revealAt) < now;
    const email = done
      ? `${nf(e.emailsSent)} enviados${e.emailsFailed ? ` · ${nf(e.emailsFailed)} ${e.emailsFailed === 1 ? "falhou" : "falharam"}` : ""}${e.emailsQueued ? ` · ${nf(e.emailsQueued)} na fila` : ""}`
      : `${nf(e.emailOptIns)} ${e.emailOptIns === 1 ? "e-mail" : "e-mails"}`;
    return {
      key: e.id, when: relWhen(done ? e.revealedAt : e.revealAt), event: e.title, photos: nf(e.photos),
      phone: notices.state==="ok"&&notices.data[e.id]?(done?notices.data[e.id].shown>0?`${nf(notices.data[e.id].shown)} enviados`:"—":`${nf(notices.data[e.id].enrolled)} inscritos`):"—", email, tone: done ? "ok" : late ? "bad" : "wait", status: done ? "Revelado" : late ? "Atrasada" : "Na fila",
      action: done ? e.emailsFailed > 0 ? <RetryEmails event={{id:e.id,title:e.title}}/> : undefined : <RevealNow event={{ id: e.id, title: e.title }} />,
    };
  });
  return <MasterRevelacoesView rows={rows} pager={<MasterPager total={r.data.total} page={p} path="/master/revelacoes" query={{q}}/>}/>;
}
