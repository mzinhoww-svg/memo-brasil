"use client";
/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { ActionSheet } from "../master";
import { MasterEventoDetalheView } from "./MasterEventoDetalhe";

const noop = () => undefined;
export function MasterEventoDetalheFolhaTeste() {
  return (
    <MasterFrame current="eventos">
      <MasterEventoDetalheView />
      <ActionSheet inline title="Marcar como evento de teste?" body="Eventos de teste saem das métricas e podem ser excluídos em lote. Evento pago não pode ser marcado." confirmLabel="Marcar como teste"
        initialReason="Evento criado pela equipe para validar a embalagem Noite." onConfirm={noop} onCancel={noop} />
    </MasterFrame>
  );
}
