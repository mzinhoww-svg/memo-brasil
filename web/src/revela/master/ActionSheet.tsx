"use client";
/* Folha de ação do Master: título, corpo, valor antigo/novo (`.diff`), campo "Motivo" de 10 a 500 caracteres com contador e aviso de auditoria,
   botão secundário e botão principal. O principal fica DESLIGADO até o motivo ter 10 caracteres (e passa a ficar desligado de novo acima de 500).
   Markup de Master-pessoas-equipe--folha-revogar.html, Master-config-revisada--folha-alterar.html e as demais folhas com motivo. */
import { useId, useState, type ReactNode } from "react";
import { REASON_MAX, REASON_MIN, reasonLength, reasonValid } from "@/lib/master/reason";
import { Ico } from "../master-kit";
import { MasterModal, ModalButtons } from "./MasterModal";

/** Estado do campo Motivo (use no handler da folha; o `ActionSheet` já o usa por dentro). */
export function useReasonField(initial = "") {
  const [reason, setReason] = useState(initial);
  const length = reasonLength(reason);
  return { reason, setReason, length, valid: reasonValid(reason), tooLong: length > REASON_MAX, trimmed: reason.trim() };
}

export interface ReasonFieldProps {
  value: string;
  onChange: (v: string) => void;
  /** Texto da esquerda abaixo do campo. */
  note?: string;
  label?: string;
  disabled?: boolean;
}

export const AUDIT_NOTE = "Fica registrado na auditoria com o seu nome.";

/** O campo "Motivo" com o contador "N/500 · mínimo 10" e o aviso de auditoria. */
export function ReasonField({ value, onChange, note = AUDIT_NOTE, label = "Motivo", disabled }: ReasonFieldProps) {
  const id = useId();
  const n = reasonLength(value);
  const bad = n > REASON_MAX;
  return (
    <>
      <p className="rv-caption" style={{ margin: "16px 0 8px" }}>{label}</p>
      <label className="rv-field rv-field--focus area" style={{ height: "92px" }}>
        <textarea aria-label={label} aria-describedby={`${id}-n`} aria-invalid={bad || undefined} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      </label>
      <div className="row between" style={{ marginTop: "6px" }}>
        <span className="rv-caption">{note}</span>
        <span id={`${id}-n`} className="rv-caption" style={bad ? { color: "var(--danger)" } : undefined}>{n}/{REASON_MAX} · mínimo {REASON_MIN}</span>
      </div>
    </>
  );
}

/** Linha de erro do servidor dentro da folha (`.errline`). */
export function ErrLine({ children }: { children: ReactNode }) {
  return <p className="errline" role="alert"><Ico n="warn" />{children}</p>;
}

export interface ActionSheetProps {
  title: string;
  body?: ReactNode;
  /** Valor de hoje e valor novo (`.diff`). `to.value` pode ser um campo. */
  diff?: { from: { label: string; value: ReactNode }; to: { label: string; value: ReactNode } };
  /** Conteúdo entre o corpo e o motivo (lista `.kv`, aviso `.mnote`…). */
  children?: ReactNode;
  confirmLabel: string;
  /** Texto do botão enquanto o servidor responde. */
  busyLabel?: string;
  cancelLabel?: string;
  /** `danger`: botão de linha em vermelho (revogar, desligar, cancelar). `primary`: botão cheio. */
  tone?: "primary" | "danger";
  /** Chamado só com motivo válido (aparado). Pode devolver uma promessa; o botão fica ocupado até ela terminar. */
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
  /** Erro do servidor, na linha vermelha acima dos botões. */
  error?: string | null;
  busy?: boolean;
  initialReason?: string;
  note?: string;
  width?: number;
  inline?: boolean;
}

export function ActionSheet({
  title, body, diff, children, confirmLabel, busyLabel, cancelLabel = "Cancelar", tone = "primary", onConfirm, onCancel, error, busy: busyProp, initialReason = "", note, width = 480, inline,
}: ActionSheetProps) {
  const f = useReasonField(initialReason);
  const [running, setRunning] = useState(false);
  const busy = busyProp ?? running;
  async function confirm() {
    if (!f.valid || busy) return;
    setRunning(true);
    try { await onConfirm(f.trimmed); } finally { setRunning(false); }
  }
  return (
    <MasterModal label={title} width={width} inline={inline} onClose={busy ? undefined : onCancel}>
      <h2 className="rv-title">{title}</h2>
      {body && <p className="rv-caption" style={{ marginTop: "6px" }}>{body}</p>}
      {diff && (
        <div className="diff">
          <div><span className="rv-caption">{diff.from.label}</span><b className="was">{diff.from.value}</b></div>
          <Ico n="arrow" />
          <div><span className="rv-caption">{diff.to.label}</span>{diff.to.value}</div>
        </div>
      )}
      {children}
      <ReasonField value={f.reason} onChange={f.setReason} note={note} disabled={busy} />
      {error && <ErrLine>{error}</ErrLine>}
      <ModalButtons>
        <button type="button" className="rv-btn rv-btn--block" style={{ flex: 1 }} onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button type="button" className={`rv-btn rv-btn--block ${tone === "danger" ? "rv-btn--line" : "rv-btn--primary"}`} style={tone === "danger" ? { flex: 1, color: "var(--danger)" } : { flex: 1 }}
          disabled={!f.valid || busy} aria-busy={busy || undefined} onClick={() => void confirm()}>
          {busy && busyLabel ? busyLabel : confirmLabel}
        </button>
      </ModalButtons>
    </MasterModal>
  );
}
