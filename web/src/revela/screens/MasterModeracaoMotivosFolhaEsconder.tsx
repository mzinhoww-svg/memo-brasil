"use client";
/* Master-moderacao-motivos--folha-esconder.html (M26.f1): folha "Esconder esta foto?" sobre a tela-base esmaecida (`.mdim`). */
import { ActionSheet } from "../master/ActionSheet";
import { MHead, MNote, MTable, MasterFrame, St } from "../master-kit";
import { Chips, COLS_FOTO, MOD_CAPTION, MOD_NOTE_FOTOS, ModTabs, REF_EXPORT, REF_FOTOS } from "./MasterModeracaoMotivos";

export function MasterModeracaoMotivosFolhaEsconder() {
  return (
    <MasterFrame current="moderacao">
      <MHead title="Moderação" caption={MOD_CAPTION}>{REF_EXPORT}</MHead>
      <div className="mdim">
        <ModTabs tab="fotos" />
        <MTable cols={COLS_FOTO} head={["Foto", "Evento", "Denúncias", "Motivos", "Situação", ""]} rows={REF_FOTOS.map((p) => ({
          key: p.key, cells: [<code key="c">{p.id}</code>, p.event, String(p.reports), <Chips key="m" items={p.chips} />, <St key="s" tone={p.hidden ? "bad" : "wait"}>{p.hidden ? "escondida" : "visível"}</St>, p.actions],
        }))} />
        <MNote icon="lock">{MOD_NOTE_FOTOS}</MNote>
      </div>
      <ActionSheet inline title="Esconder esta foto?" body="foto 3f1a… · Chá da Maria · 3 denúncias. Ela sai do feed para todos os convidados." confirmLabel="Esconder foto"
        initialReason="Três denúncias, duas por conteúdo impróprio. Escondida até a anfitriã decidir." onConfirm={() => undefined} onCancel={() => undefined} />
    </MasterFrame>
  );
}
