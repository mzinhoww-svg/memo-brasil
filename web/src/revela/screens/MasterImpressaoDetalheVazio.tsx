/* Master-impressao-detalhe--vazio.html (M30.v): pedido não encontrado. O desenho mantém o título do pedido e os botões do cabeçalho. */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";
import { DETALHE_FIXTURE, DetalheActions } from "./MasterImpressaoDetalhe";

export function MasterImpressaoDetalheVazio() {
  return (
    <MasterFrame current="impressoes">
      <MasterStatePage area={`Pedido ${DETALHE_FIXTURE.code}`} variant="empty" caption={DETALHE_FIXTURE.caption} actions={<DetalheActions />} title="Pedido não encontrado" text="Volte para a lista de pedidos." />
    </MasterFrame>
  );
}
