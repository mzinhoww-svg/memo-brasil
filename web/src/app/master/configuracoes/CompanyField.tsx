"use client";

import { useActionState, useId, useState } from "react";
import { Field } from "@/components/memoriesmt";
import { reasonError, REASON_MAX } from "../billing";
import { Pill } from "../kit/Pill";
import { saveCompanySetting, type SaveState } from "./actions";
import { validateSetting, type CompanyKey } from "./validate";
import styles from "./page.module.css";

/** Linha de um campo do cadastro: valor atual (ou "falta preencher") e edição com motivo obrigatório. */
export function CompanyField({ k, label, help, inputMode, current, canEdit }: { k: CompanyKey; label: string; help: string; inputMode: "text" | "email" | "tel"; current: string | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveCompanySetting, { status: "idle" });
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current ?? "");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const rid = useId();

  // fecha o formulário depois de salvar (a página é revalidada pela action); ajuste durante a renderização, sem efeito
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "ok") { setOpen(false); setReason(""); setTried(false); }
  }

  const vCheck = validateSetting(k, value);
  const vErr = tried && !vCheck.ok ? vCheck.error : state.status === "error" && state.field === "value" ? state.message : null;
  const rErr = tried ? reasonError(reason) : state.status === "error" && state.field === "reason" ? state.message : null;
  const missing = !current;

  return (
    <li className={missing ? `${styles.field} ${styles.missing}` : styles.field}>
      <div className={styles.fieldHead}>
        <div>
          <span className={styles.fieldLabel}>{label}</span>
          <span className={styles.fieldValue}>{current ?? "Não preenchido"}</span>
        </div>
        <div className={styles.fieldActions}>
          <Pill tone={missing ? "warn" : "ok"}>{missing ? "falta" : "ok"}</Pill>
          {canEdit && !open && <button type="button" className="adm-btn" onClick={() => { setOpen(true); setValue(current ?? ""); setTried(false); }} aria-label={`${missing ? "Preencher" : "Editar"} ${label}`}>{missing ? "Preencher" : "Editar"}</button>}
        </div>
      </div>
      {state.status === "ok" && !open && <p className={styles.ok} role="status">{state.message}</p>}
      {open && (
        <form action={action} className={styles.form} noValidate
          onSubmit={(e) => { setTried(true); if (!validateSetting(k, value).ok || reasonError(reason)) e.preventDefault(); }}>
          <input type="hidden" name="key" value={k} />
          <Field label={label} name="value" inputMode={inputMode} type={inputMode === "email" ? "email" : "text"} autoComplete="off"
            value={value} onChange={(e) => setValue(e.target.value)} error={vErr ?? undefined} help={help} />
          <div className="mm-field">
            <label className="mm-field-label" htmlFor={rid}>Motivo da alteração (obrigatório)</label>
            <textarea id={rid} name="reason" className="mm-field-input adm-textarea" rows={3} maxLength={REASON_MAX + 50} value={reason}
              aria-invalid={rErr ? true : undefined} aria-describedby={rErr ? `${rid}-erro` : undefined} onChange={(e) => setReason(e.target.value)} />
            {rErr && <span id={`${rid}-erro`} className="mm-field-erro">{rErr}</span>}
          </div>
          {state.status === "error" && !state.field && <p className="mm-field-erro" role="alert">{state.message}</p>}
          <div className={styles.fieldActions}>
            <button type="submit" className="adm-btn" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
            <button type="button" className="adm-btn" onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </li>
  );
}
