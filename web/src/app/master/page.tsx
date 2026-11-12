import { Suspense } from "react";
import { MasterStatePage } from "@/revela/master";
import { VisaoGeralConteudo, type Search } from "./VisaoGeral";

/** M20 · Visão geral. Enquanto os dados carregam, o esqueleto da M20-c (5 colunas). */
export default function VisaoGeral({ searchParams }: { searchParams: Search }) {
  return <Suspense fallback={<MasterStatePage area="Visão geral" variant="loading" cols={5} />}><VisaoGeralConteudo searchParams={searchParams} /></Suspense>;
}
