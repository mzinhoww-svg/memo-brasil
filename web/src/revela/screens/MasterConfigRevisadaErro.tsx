/* Master-config-revisada--erro.html (M31.e). */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";

export function MasterConfigRevisadaErro() {
  return <MasterFrame current="configuracoes"><MasterStatePage area="Configurações" variant="error" onRetry={() => undefined} /></MasterFrame>;
}
