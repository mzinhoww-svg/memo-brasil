/* Master-impressao-detalhe--carregando.html (M30.c): 8 linhas × 3 colunas de esqueleto, com os botões do cabeçalho. */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";
import { DETALHE_FIXTURE, DetalheActions } from "./MasterImpressaoDetalhe";

export function MasterImpressaoDetalheCarregando() {
  return <MasterFrame current="impressoes"><MasterStatePage area={`Pedido ${DETALHE_FIXTURE.code}`} variant="loading" cols={3} rows={8} actions={<DetalheActions />} /></MasterFrame>;
}
