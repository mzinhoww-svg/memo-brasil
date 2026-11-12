"use client";
/* Folhas de recusa do Master para eventos de teste: M21-f1r (Master-evento-detalhe--folha-teste-recusa.html) e M22-f2 (Master-eventos-teste--folha-recusa.html).
   Um botão só, sem campo de motivo: o servidor já recusou e nada foi alterado. */
import type { ReactNode } from "react";
import { Ico } from "../master-kit";
import { MasterModal, ModalButtons } from "../master/MasterModal";

export interface RefusalSheetProps {
  title: string;
  body: ReactNode;
  /** Uma frase vermelha (M21-f1r). */
  error?: ReactNode;
  /** Um evento por linha, com o motivo da recusa (M22-f2). */
  items?: { key: string; title: string; reason: string }[];
  closeLabel: string;
  onClose: () => void;
  inline?: boolean;
}

export function RefusalSheet({ title, body, error, items, closeLabel, onClose, inline }: RefusalSheetProps) {
  return (
    <MasterModal label={title} inline={inline} onClose={onClose}>
      <h2 className="rv-title">{title}</h2>
      <p className="rv-caption" style={{ marginTop: "6px" }}>{body}</p>
      {error && <p className="errline" role="alert"><Ico n="warn" />{error}</p>}
      {items && (
        <div className="rv-group" style={{ marginTop: "16px" }}>
          {items.map((i) => (
            <div className="rv-row" key={i.key}>
              <Ico n="warn" />
              <div className="rv-row__text">{i.title}<span className="rv-row__meta">{i.reason}</span></div>
            </div>
          ))}
        </div>
      )}
      <ModalButtons>
        <button type="button" className="rv-btn rv-btn--block" style={{ flex: 1 }} data-autofocus onClick={onClose}>{closeLabel}</button>
      </ModalButtons>
    </MasterModal>
  );
}
