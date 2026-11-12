"use client";
/* Master-impressao-detalhe--folha-avancar.html (M30.f1): tela-base esmaecida + folha "Marcar como em produção?". */
import { PrintAdvanceSheet } from "../master/PrintOrderSheets";
import { MasterFrame } from "../master-kit";
import { DETALHE_FIXTURE, MasterImpressaoDetalheView } from "./MasterImpressaoDetalhe";

export function MasterImpressaoDetalheFolhaAvancar() {
  return (
    <MasterFrame current="impressoes">
      <MasterImpressaoDetalheView dim />
      <PrintAdvanceSheet code={DETALHE_FIXTURE.code} from="solicitado" to="em_producao" onConfirm={() => undefined} onCancel={() => undefined} inline />
    </MasterFrame>
  );
}
