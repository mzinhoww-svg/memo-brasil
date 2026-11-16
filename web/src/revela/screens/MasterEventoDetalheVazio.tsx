/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { MasterStatePage } from "../master";
import { EventoDetalheRefActions } from "./MasterEventoDetalhe";

export function MasterEventoDetalheVazio() {
  return (
    <MasterFrame current="eventos">
      <MasterStatePage area="Ana & Leo" variant="empty" caption="Casamento · Ana Ribeiro · sáb, 14 mar 2027 16:30 → dom 02:00" title="Evento não encontrado" text="Ele pode ter sido excluído. Volte para a lista de eventos." actions={<EventoDetalheRefActions />} />
    </MasterFrame>
  );
}
