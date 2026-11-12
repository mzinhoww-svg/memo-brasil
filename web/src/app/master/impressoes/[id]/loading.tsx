import { MasterStatePage } from "@/revela/master/MasterState";
import { DetalheActions } from "@/revela/screens/MasterImpressaoDetalhe";

/** M30.c: carregando. */
export default function Loading() {
  return <MasterStatePage area="Impressões" variant="loading" cols={3} rows={8} actions={<DetalheActions back={{ href: "/master/impressoes" }} onCancel={null} advance={null} />} />;
}
