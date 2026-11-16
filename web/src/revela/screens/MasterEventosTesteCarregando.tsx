/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { MasterStatePage } from "../master";

import { FixtureExport } from "./master-fixtures";

export function MasterEventosTesteCarregando() {
  return (
    <MasterFrame current="eventos">
      <MasterStatePage area="Eventos" variant="loading" cols={7} actions={<FixtureExport />} />
    </MasterFrame>
  );
}
