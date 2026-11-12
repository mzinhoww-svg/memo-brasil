/* Master-impressoes--sem-permissao.html (M29.p). */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";

export function MasterImpressoesSemPermissao() {
  return <MasterFrame current="impressoes"><MasterStatePage area="Impressões" variant="denied" /></MasterFrame>;
}
