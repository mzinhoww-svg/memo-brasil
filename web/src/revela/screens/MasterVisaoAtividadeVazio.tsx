/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { MasterStatePage } from "../master";
import { FixtureExport } from "./master-fixtures";

export function MasterVisaoAtividadeVazio() {
  return (
    <MasterFrame current="visao">
      <MasterStatePage area="Visão geral" variant="empty" caption="Novembro de 2026 · atualizado às 08:42" title="Sem atividade neste período" text="Nenhum evento, entrada ou foto nos dias escolhidos." actions={<FixtureExport />} />
    </MasterFrame>
  );
}
