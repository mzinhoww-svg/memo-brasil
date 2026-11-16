"use client";
/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { ActionSheet } from "../master";
import { MasterEventoDetalheView } from "./MasterEventoDetalhe";

const noop = () => undefined;
export function MasterEventoDetalheFolhaExcluirTeste() {
  return (
    <MasterFrame current="eventos">
      <MasterEventoDetalheView />
      <ActionSheet inline title="Excluir este evento de teste?" body="O evento, as 12 fotos e os convites somem. Só eventos marcados como teste e sem pagamento podem ser excluídos." confirmLabel="Excluir evento" tone="danger"
        initialReason="Evento criado para validar a embalagem Noite antes do lançamento." onConfirm={noop} onCancel={noop} />
    </MasterFrame>
  );
}
