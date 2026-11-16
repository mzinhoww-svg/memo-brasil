/* Master-impressoes--erro.html (M29.e). */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";

export function MasterImpressoesErro() {
  return <MasterFrame current="impressoes"><MasterStatePage area="Impressões" variant="error" onRetry={() => undefined} /></MasterFrame>;
}
