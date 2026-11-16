"use client";
/* Tela de comparação de design-system/revela/master/html: composição do componente real + estado/folha (dados do desenho). */
import { MasterFrame } from "../master-kit";
import { ActionSheet } from "../master";
import { MasterEventosTesteView } from "./MasterEventosTeste";

const noop = () => undefined;
export function MasterEventosTesteFolhaExcluirLote() {
  return (
    <MasterFrame current="eventos">
      <MasterEventosTesteView />
      <ActionSheet inline title="Excluir 3 eventos de teste?" body="Os eventos, as 52 fotos e os convites somem." confirmLabel="Excluir 3 eventos" tone="danger"
        initialReason="Limpeza dos eventos usados na homologação de novembro." onConfirm={noop} onCancel={noop}>
        <div className="rv-group" style={{ marginTop: "16px" }}>
          {["Teste QA · câmera noite", "Teste checkout Pix", "Demo comercial buffet"].map((t) => <div className="rv-row" key={t}><div className="rv-row__text">{t}</div></div>)}
        </div>
      </ActionSheet>
    </MasterFrame>
  );
}
