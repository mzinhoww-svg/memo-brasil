/* Master-impressao-detalhe--sem-permissao.html (M30.p): o título vira o nome da área, nunca o do pedido. */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";

export function MasterImpressaoDetalheSemPermissao() {
  return <MasterFrame current="impressoes"><MasterStatePage area="Impressões" variant="denied" /></MasterFrame>;
}
