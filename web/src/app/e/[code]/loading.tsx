import { ConvidadoCarregando } from "@/revela/screens/ConvidadoCarregando";

/** 20g · Carregando a festa (tela do desenho) enquanto o convite ou a área do convidado chegam. */
export default function Loading() {
  return <main role="status" aria-label="Carregando a festa"><ConvidadoCarregando name={null} /></main>;
}
