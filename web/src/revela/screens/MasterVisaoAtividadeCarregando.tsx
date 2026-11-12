/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { MasterStatePage } from "../master";
import { FixtureExport } from "./master-fixtures";

export function MasterVisaoAtividadeCarregando() {
  return (
    <MasterFrame current="visao">
      <MasterStatePage area="Visão geral" variant="loading" cols={5} actions={<FixtureExport />} />
    </MasterFrame>
  );
}
