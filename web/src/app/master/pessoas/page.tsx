import { Ico, MState, St } from "@/revela/master-kit";
import { MasterPessoasView } from "@/revela/screens/MasterPessoas";
import { ExportButton } from "../ExportButton";
import { brl } from "../billing";
import { requireMaster, rpc } from "../data";
import { monthYear, nf, relWhen } from "../format";
import { pageNumber, PAGE_SIZE } from "../pagination";
interface Person { userId: string; displayName?: string; email?: string; provider?: string; eventsCount?: number; spentCents?: number; firstEventAt?: string; createdAt?: string; deletionRequested?: boolean; platformRole?: string; eventTitle?: string; name?: string; table?: string; joinedAt?: string; blocked?: boolean; isHost?: boolean }
interface People { total: number; organizersTotal: number; guestsTotal: number; teamTotal: number; items: Person[] }
const PROVIDER: Record<string,string>={google:"Google",email:"Link por e-mail",anonymous:"Convidado"};
export default async function Pessoas({ searchParams }: { searchParams: Promise<{aba?:string;q?:string;p?:string}> }) {
 const sb=await requireMaster(); const sp=await searchParams; const aba=sp.aba==='equipe'||sp.aba==='convidados'?sp.aba:'organizadores';const p=pageNumber(sp.p);const q=sp.q?.trim().slice(0,80)||null;
 const r=await rpc<People>(sb,'admin_master_people',{p_tab:aba,p_limit:PAGE_SIZE,p_offset:(p-1)*PAGE_SIZE,p_search:q});
 if(r.state!=='ok')return <MState kind={r.state==='denied'?'denied':'error'} text={r.state==='error'?`Não foi possível carregar: ${r.message}`:undefined}/>;
 const d=r.data;const href=(a:string,n=1)=>`/master/pessoas?${new URLSearchParams({aba:a,...(q?{q}:{}),...(n>1?{p:String(n)}:{})})}`;
 const tabs=[{label:`Organizadores ${nf(d.organizersTotal)}`,href:href('organizadores'),on:aba==='organizadores'},{label:`Convidados ${nf(d.guestsTotal)}`,href:href('convidados'),on:aba==='convidados'},{label:`Equipe ${nf(d.teamTotal)}`,href:href('equipe'),on:aba==='equipe'}];
 const last=Math.max(1,Math.ceil(d.total/PAGE_SIZE));const pager=last>1?<nav aria-label="Paginação" className="row" style={{gap:'12px',marginTop:'16px',alignItems:'center'}}>{p>1&&<a className="link" href={href(aba,p-1)}>← Anterior</a>}<span className="rv-caption">Página {p} de {last} · {nf(d.total)} registros</span>{p<last&&<a className="link" href={href(aba,p+1)}>Próxima →</a>}</nav>:undefined;
 const exp=<ExportButton kind="pessoas" screen={`pessoas-${aba}`} filters={{aba,q}}/>;
 if(aba==='equipe')return <MasterPessoasView tabs={tabs} pager={pager} exportAction={exp} cols="1.6fr 1.2fr 1fr" head={['E-mail','Papel','Desde']} rows={d.items.map(u=>({key:u.userId,cells:[u.email??'—',u.platformRole??'—',monthYear(u.createdAt)]}))}/>;
 if(aba==='convidados')return <MasterPessoasView tabs={tabs} pager={pager} exportAction={exp} cols="1.4fr 1.4fr .8fr 1fr .8fr" head={['Nome','Evento','Mesa','Entrou','Situação']} rows={d.items.map((u,i)=>({key:`${u.userId}-${i}`,cells:[u.name??'—',u.eventTitle??'—',u.table??'—',relWhen(u.joinedAt),<St key="state" tone={u.blocked?'bad':u.isHost?'info':'ok'}>{u.blocked?'bloqueado':u.isHost?'organizador':'ativo'}</St>]}))}/>;
 return <MasterPessoasView tabs={tabs} pager={pager} exportAction={exp} rows={d.items.map(u=>({key:u.userId,cells:[u.displayName??'—',u.email??'—',PROVIDER[u.provider??'']??'—',nf(u.eventsCount??0),brl(u.spentCents??0),monthYear(u.firstEventAt),<a key="detail" aria-label={`Ver eventos de ${u.displayName??'organizador'}`} href={`/master/eventos?q=${encodeURIComponent(u.displayName??'')}`}><Ico n="chevron"/></a>]}))}/>;
}
