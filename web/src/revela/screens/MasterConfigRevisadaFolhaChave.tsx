"use client";
/* Master-config-revisada--folha-chave.html (M31.f2): tela-base esmaecida + folha "Desligar o checkout?". */
import { FlagSheet } from "../master/ConfigSheets";
import { MasterFrame } from "../master-kit";
import { MasterConfigRevisadaView } from "./MasterConfigRevisada";

export function MasterConfigRevisadaFolhaChave() {
  return (
    <MasterFrame current="configuracoes">
      <MasterConfigRevisadaView dim />
      <FlagSheet title="Desligar o checkout?" body="Ninguém consegue pagar planos enquanto estiver desligado. Eventos já pagos não mudam." confirmLabel="Desligar checkout" tone="danger"
        onConfirm={() => undefined} onCancel={() => undefined} inline initialReason="Instabilidade na ValidaPay; religar depois da confirmação do suporte deles." />
    </MasterFrame>
  );
}
