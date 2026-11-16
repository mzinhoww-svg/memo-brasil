"use client";
/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { ReconcileSheet } from "../master";
import { MasterPagamentosView } from "./MasterPagamentos";

const noop = () => undefined;
export function MasterPagamentosFolhaConciliarEspera() {
  return (
    <MasterFrame current="pagamentos">
      <MasterPagamentosView />
      <ReconcileSheet inline state={{ step: "wait", remaining: 42, last: "hoje 08:51, por marcos@revela.app" }} onSubmitCode={noop} onClose={noop} />
    </MasterFrame>
  );
}
