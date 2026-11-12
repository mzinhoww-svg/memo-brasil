/* Master-impressao-detalhe--erro.html (M30.e). */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";
import { DETALHE_FIXTURE } from "./MasterImpressaoDetalhe";

export function MasterImpressaoDetalheErro() {
  return <MasterFrame current="impressoes"><MasterStatePage area={`Pedido ${DETALHE_FIXTURE.code}`} variant="error" onRetry={() => undefined} /></MasterFrame>;
}
