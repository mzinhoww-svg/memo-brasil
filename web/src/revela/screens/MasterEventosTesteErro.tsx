/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { MasterStatePage } from "../master";

export function MasterEventosTesteErro() {
  return (
    <MasterFrame current="eventos">
      <MasterStatePage area="Eventos" variant="error" />
    </MasterFrame>
  );
}
