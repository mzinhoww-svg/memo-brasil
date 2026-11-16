import { MasterStatePage } from "@/revela/master/MasterState";

/** M31.c: carregando. */
export default function Loading() {
  return <MasterStatePage area="Configurações" variant="loading" cols={3} rows={8} />;
}
