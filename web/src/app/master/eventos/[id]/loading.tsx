import { MasterStatePage } from "@/revela/master";

/** M21 · carregando. Ainda não se sabe o nome do evento: o título é o da área. */
export default function Loading() {
  return <MasterStatePage area="Eventos" variant="loading" cols={3} />;
}
