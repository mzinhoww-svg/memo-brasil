"use client";
/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { ReconcileSheet } from "../master";
import { MasterPagamentosView } from "./MasterPagamentos";

const noop = () => undefined;
export function MasterPagamentosFolhaConciliarCodigo() {
  return (
    <MasterFrame current="pagamentos">
      <MasterPagamentosView />
      <ReconcileSheet inline state={{ step: "code" }} initialCode="305" onSubmitCode={noop} onClose={noop} />
    </MasterFrame>
  );
}
