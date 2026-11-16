/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { MasterStatePage } from "../master";
import { EventoDetalheRefActions } from "./MasterEventoDetalhe";

export function MasterEventoDetalheCarregando() {
  return (
    <MasterFrame current="eventos">
      <MasterStatePage area="Ana & Leo" variant="loading" cols={3} actions={<EventoDetalheRefActions />} />
    </MasterFrame>
  );
}
