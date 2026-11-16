"use client";
/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { ReconcileSheet } from "../master";
import { MasterPagamentosView } from "./MasterPagamentos";

const noop = () => undefined;
export function MasterPagamentosFolhaConciliarResultado() {
  return (
    <MasterFrame current="pagamentos">
      <MasterPagamentosView />
      <ReconcileSheet inline state={{ step: "result", nextIn: 57, result: { confirmed: 12, failed: 1, unchanged: 58, at: "hoje 08:51", tookSeconds: 4, failures: [{ label: "#RV-2039 · Formatura Medicina", message: "A ValidaPay não respondeu a tempo. Tente de novo em 1 min." }] } }} onSubmitCode={noop} onClose={noop} />
    </MasterFrame>
  );
}
