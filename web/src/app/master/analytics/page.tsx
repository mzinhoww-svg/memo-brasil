import { redirect } from "next/navigation";
import { requireMaster } from "../data";
/** Compatibilidade: acesso e parâmetros válidos são preservados no destino do desenho. */
export default async function PaginaAntiga({searchParams}: {searchParams:Promise<{q?:string;p?:string}>}) {
 await requireMaster();
 await searchParams;
 const target=new URL("/master","https://local.invalid");
 redirect(target.pathname+target.search);
}
