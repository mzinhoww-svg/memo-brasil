"use client";
/* Master-impressao-detalhe--folha-cancelar.html (M30.f2): tela-base esmaecida + folha "Cancelar o pedido IMP-7K2Q?" com motivo. */
import { PrintCancelSheet } from "../master/PrintOrderSheets";
import { MasterFrame } from "../master-kit";
import { DETALHE_FIXTURE, MasterImpressaoDetalheView } from "./MasterImpressaoDetalhe";

export function MasterImpressaoDetalheFolhaCancelar() {
  return (
    <MasterFrame current="impressoes">
      <MasterImpressaoDetalheView dim />
      <PrintCancelSheet code={DETALHE_FIXTURE.code} initialReason="Anfitriã pediu o cancelamento por telefone; vai refazer com outras fotos." onConfirm={() => undefined} onCancel={() => undefined} inline />
    </MasterFrame>
  );
}
