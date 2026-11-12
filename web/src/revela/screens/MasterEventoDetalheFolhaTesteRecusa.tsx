"use client";
/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";

import { MasterEventoDetalheView } from "./MasterEventoDetalhe";
import { RefusalSheet } from "./MasterEventosFolhas";

const noop = () => undefined;
export function MasterEventoDetalheFolhaTesteRecusa() {
  return (
    <MasterFrame current="eventos">
      <MasterEventoDetalheView />
      <RefusalSheet inline title="Não dá para marcar como teste" body="Só eventos sem pagamento podem virar teste." error="Este evento tem pagamento confirmado (Pix #RV-2041)." closeLabel="Entendi" onClose={noop} />
    </MasterFrame>
  );
}
