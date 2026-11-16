/* Master-config-revisada--sem-permissao.html (M31.p). */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";

export function MasterConfigRevisadaSemPermissao() {
  return <MasterFrame current="configuracoes"><MasterStatePage area="Configurações" variant="denied" /></MasterFrame>;
}
