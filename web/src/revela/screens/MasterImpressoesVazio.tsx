/* Master-impressoes--vazio.html (M29.v): nenhum pedido. */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";
import { ExportButtonStatic, IMPRESSOES_CAPTION } from "./MasterImpressoes";

export function MasterImpressoesVazio() {
  return (
    <MasterFrame current="impressoes">
      <MasterStatePage area="Impressões" variant="empty" caption={IMPRESSOES_CAPTION} actions={<ExportButtonStatic />} title="Nenhum pedido de impressão" text="Os pedidos feitos pelos anfitriões e convidados aparecem aqui." />
    </MasterFrame>
  );
}
