import { redirect } from "next/navigation";
import { requireMaster } from "../data";
import { pageNumber } from "../pagination";
/** Compatibilidade: acesso e parâmetros válidos são preservados no destino do desenho. */
export default async function PaginaAntiga({searchParams}: {searchParams:Promise<{q?:string;p?:string}>}) {
 await requireMaster();
 const sp=await searchParams??{};
 const target=new URL("/master/pessoas?aba=organizadores","https://local.invalid");
 const q=typeof sp.q==="string"?sp.q.trim().slice(0,80):""; const p=pageNumber(sp.p);
 if(q)target.searchParams.set("q",q);if(p>1)target.searchParams.set("p",String(p));
 redirect(target.pathname+target.search);
}
