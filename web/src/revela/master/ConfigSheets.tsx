"use client";
/* Folhas das Configurações (M31.f1 alterar valor, M31.f2 ligar/desligar chave): Master-config-revisada--folha-alterar.html e --folha-chave.html.
   Toda alteração mostra o valor de hoje, o novo e o motivo (10 a 500); o servidor valida de novo e grava a auditoria. */
import type { ReactNode } from "react";
import { ActionSheet } from "./ActionSheet";

export interface SettingSheetProps {
  title: string;
  body: ReactNode;
  /** Valor de hoje, como a tela o mostra ("15 min"). */
  today: ReactNode;
  /** Rótulo do campo novo ("Novo valor (5 a 1.440)"). */
  fieldLabel: string;
  value: string;
  onValue: (v: string) => void;
  /** Unidade ao lado do campo ("min", "%"); sem unidade, o campo vira texto livre. */
  unit?: string;
  inputLabel: string;
  /** Erro de validação do valor novo (mostrado na linha vermelha); o servidor confere de novo. */
  invalid?: string | null;
  error?: string | null;
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
  initialReason?: string;
  inline?: boolean;
}

export function SettingSheet({ title, body, today, fieldLabel, value, onValue, unit, inputLabel, invalid, error, onConfirm, onCancel, initialReason, inline }: SettingSheetProps) {
  return (
    <ActionSheet title={title} body={body} confirmLabel="Salvar" busyLabel="Salvando…" error={invalid ?? error} onConfirm={async (r) => { if (!invalid) await onConfirm(r); }} onCancel={onCancel}
      initialReason={initialReason} inline={inline}
      diff={{
        from: { label: "Hoje", value: today },
        to: {
          label: fieldLabel,
          value: (
            <label className="mfield mfield--on" style={{ maxWidth: unit ? "120px" : "260px" }}>
              <input value={value} onChange={(e) => onValue(e.target.value)} aria-label={inputLabel} aria-invalid={invalid ? true : undefined} data-autofocus />
              {unit && <i>{unit}</i>}
            </label>
          ),
        },
      }} />
  );
}

export interface FlagSheetProps {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  /** `danger` ao desligar (botão de linha vermelho), `primary` ao ligar. */
  tone: "primary" | "danger";
  error?: string | null;
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
  initialReason?: string;
  inline?: boolean;
}

export function FlagSheet({ title, body, confirmLabel, busyLabel = "Salvando…", tone, error, onConfirm, onCancel, initialReason, inline }: FlagSheetProps) {
  return <ActionSheet title={title} body={body} confirmLabel={confirmLabel} busyLabel={busyLabel} tone={tone} error={error} onConfirm={onConfirm} onCancel={onCancel} initialReason={initialReason} inline={inline} />;
}
