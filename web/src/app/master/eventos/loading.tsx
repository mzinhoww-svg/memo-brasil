import { MasterStatePage } from "@/revela/master";

/** Eventos · carregando (as 8 colunas da lista). */
export default function Loading() {
  return <MasterStatePage area="Eventos" variant="loading" cols={8} />;
}
