/* Master-auditoria.html (M13): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import type { ReactNode } from "react";
import { BtnLink, Ico, MHead, MRow, MTable, MasterFrame } from "../master-kit";

export interface AuditoriaRow { key: string; when: string; who: string; action: string; target: string; detail: string }
export interface AuditoriaProps { caption?: string; rows?: AuditoriaRow[]; exportHref?: string | null;
  /** Botão de exportação real (cliente); tem precedência sobre `exportHref`. */
  exportAction?: ReactNode; filter?: ReactNode; pager?: ReactNode; empty?: string }

const REF_ROWS: AuditoriaRow[] = [
  { key: "1", when: "hoje 08:51", who: "Marcos (master)", action: "plan.price_changed", target: "Casamento", detail: "R$ 189,00 → R$ 199,00" },
  { key: "2", when: "hoje 08:42", who: "sistema", action: "entitlement.granted", target: "Ana & Leo", detail: "Casamento via Pix #RV-2041" },
  { key: "3", when: "hoje 08:30", who: "Ana Ribeiro", action: "photo.hidden", target: "Ana & Leo", detail: "foto 3f1… · 3 denúncias" },
  { key: "4", when: "hoje 07:12", who: "Marcos (master)", action: "courtesy.created", target: "BUFFET-JARDIM", detail: "Casamento · 20 usos" },
  { key: "5", when: "ontem 18:05", who: "sistema", action: "payment.needs_refund", target: "#RV-2037", detail: "segunda cobrança paga" },
  { key: "6", when: "ontem 17:40", who: "Júlia Alves", action: "participant.blocked", target: "Chá da Maria", detail: "1 convidado" },
];

export function MasterAuditoriaView({ caption = "Toda ação sensível, só inserção", rows = REF_ROWS, exportHref, exportAction, filter, pager, empty }: AuditoriaProps = {}) {
  const mrows: MRow[] = rows.map((r) => ({ key: r.key, cells: [r.when, r.who, r.action, r.target, r.detail] }));
  return (
    <>
      <MHead title="Auditoria" caption={caption}>
        {exportAction ? exportAction : exportHref === null ? null : exportHref ? <BtnLink href={exportHref} icon="download">Exportar</BtnLink> : <button className="rv-btn rv-btn--sm"><Ico n="download" />Exportar</button>}
      </MHead>
      {filter}
      <MTable cols="0.9fr 1.1fr 1.2fr 1fr 1.8fr" head={["Quando", "Quem", "Ação", "Alvo", "Detalhe"]} rows={mrows} empty={empty ?? "Nenhum registro."} />
      {pager}
    </>
  );
}

export function MasterAuditoria(props: AuditoriaProps = {}) {
  return <MasterFrame current="auditoria"><MasterAuditoriaView {...props} /></MasterFrame>;
}
