import { MasterStatePage } from "@/revela/master";

/** Pagamentos · carregando (as 8 colunas da lista). */
export default function Loading() {
  return <MasterStatePage area="Pagamentos" variant="loading" cols={8} />;
}
