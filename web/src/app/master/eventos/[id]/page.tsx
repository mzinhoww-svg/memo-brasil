import { Suspense } from "react";
import { MasterStatePage } from "@/revela/master";
import { EventoConteudo } from "./EventoConteudo";

/** M21 · detalhe do evento; enquanto carrega, o esqueleto da M21-c (o nome do evento ainda não se sabe: título "Eventos"). */
export default function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<MasterStatePage area="Eventos" variant="loading" cols={3} />}><EventoConteudo params={params} /></Suspense>;
}
