/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { MasterStatePage } from "../master";

import { FixtureExport } from "./master-fixtures";

export function MasterEventosTesteVazio() {
  return (
    <MasterFrame current="eventos">
      <MasterStatePage area="Eventos" variant="empty" caption="263 eventos · 4 de teste" title="Nenhum evento de teste" text="Marque um evento como teste na página dele." actions={<FixtureExport />} />
    </MasterFrame>
  );
}
