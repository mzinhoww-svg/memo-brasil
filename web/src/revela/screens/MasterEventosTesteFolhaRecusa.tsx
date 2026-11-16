"use client";
/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";

import { MasterEventosTesteView } from "./MasterEventosTeste";
import { RefusalSheet } from "./MasterEventosFolhas";

const noop = () => undefined;
export function MasterEventosTesteFolhaRecusa() {
  return (
    <MasterFrame current="eventos">
      <MasterEventosTesteView />
      <RefusalSheet inline title="Lote recusado" body="Nada foi excluído. Tire estes eventos da seleção e tente de novo." closeLabel="Voltar para a lista" onClose={noop}
        items={[{ key: "1", title: "Ana & Leo", reason: "Não é evento de teste" }, { key: "2", title: "Teste checkout Pix", reason: "Tem pagamento confirmado em produção" }]} />
    </MasterFrame>
  );
}
