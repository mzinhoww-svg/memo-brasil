"use client";
/* Master-config-revisada--folha-alterar.html (M31.f1): tela-base esmaecida + folha "Alterar a validade do Pix". */
import { useState } from "react";
import { SettingSheet } from "../master/ConfigSheets";
import { MasterFrame } from "../master-kit";
import { MasterConfigRevisadaView } from "./MasterConfigRevisada";

export function MasterConfigRevisadaFolhaAlterar() {
  const [v, setV] = useState("30");
  return (
    <MasterFrame current="configuracoes">
      <MasterConfigRevisadaView dim />
      <SettingSheet title="Alterar a validade do Pix" body="Vale para os próximos Pix gerados. Os que já estão abertos mantêm a validade antiga." today="15 min" fieldLabel="Novo valor (5 a 1.440)"
        value={v} onValue={setV} unit="min" inputLabel="Minutos" onConfirm={() => undefined} onCancel={() => undefined} inline
        initialReason="Anfitriões relataram pouco tempo para pagar pelo app do banco." />
    </MasterFrame>
  );
}
