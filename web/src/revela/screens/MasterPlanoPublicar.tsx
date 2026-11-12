"use client";
/* Master-plano-publicar.html (M04): modal "Publicar novo preço?" com o código do autenticador (TOTP). Markup e classes da referência. */
import type { ReactNode } from "react";
import { Ico, MHead, MasterFrame, type IconName } from "../master-kit";
import { PhonePreview } from "./MasterPlanos";

export interface PublicarDiff { label: string; from: string; to: string }
export interface PublicarModalProps {
  title?: string; caption?: string;
  diffs?: PublicarDiff[];
  rows?: { icon: IconName; text: string }[];
  /** Campo de motivo exigido pelo servidor (a referência não o desenha). */
  reason?: { value: string; error?: string | null; onChange: (v: string) => void };
  code?: string; onCode?: (v: string) => void;
  /** Bloco extra (cadastro do autenticador no primeiro uso). */
  extra?: ReactNode;
  error?: string | null; busy?: boolean; cta?: string;
  onCancel?: () => void; onPublish?: () => void;
}

const REF_ROWS: { icon: IconName; text: string }[] = [
  { icon: "check", text: "31 eventos já pagos continuam iguais" },
  { icon: "pix", text: "2 Pix abertos mantêm R$ 189,00 até expirar" },
  { icon: "history", text: "Fica registrado na auditoria com seu nome" },
];

export function PublicarModal({
  title = "Publicar novo preço?", caption = "Entra no paywall e no checkout ValidaPay assim que você confirmar.", diffs = [{ label: "Casamento", from: "R$ 189,00", to: "R$ 199,00" }],
  rows = REF_ROWS, reason, code = "719", onCode, extra, error, busy, cta = "Publicar R$ 199", onCancel, onPublish,
}: PublicarModalProps = {}) {
  const digits = code.padEnd(6, " ").slice(0, 6).split("");
  const next = Math.min(code.length, 5);
  return (
    <div className="mmodal" role="dialog" aria-modal="true" aria-label={title} style={onPublish ? { position: "fixed", left: "248px" } : undefined}>
      <div className="mmodal-card">
        <h2 className="rv-title">{title}</h2>
        <p className="rv-caption" style={{ marginTop: "6px" }}>{caption}</p>
        {diffs.map((d) => (
          <div className="diff" key={d.label}>
            <div><span className="rv-caption">{d.label}</span><b className="was">{d.from}</b></div>
            <Ico n="arrow" />
            <div><span className="rv-caption">Novo preço</span><b>{d.to}</b></div>
          </div>
        ))}
        <div className="rv-group">
          {rows.map((r) => (
            <div className="rv-row" key={r.text}>
              <Ico n={r.icon} />
              <div className="rv-row__text">{r.text}</div>
            </div>
          ))}
        </div>
        {reason && (
          <label className="rv-field" style={{ marginTop: "14px" }}>
            <input value={reason.value} onChange={(e) => reason.onChange(e.target.value)} placeholder="Motivo (obrigatório, 10 a 500 caracteres)" aria-label="Motivo" maxLength={500} />
          </label>
        )}
        {reason?.error && <p className="rv-caption" role="alert" style={{ color: "var(--danger)", marginTop: "6px" }}>{reason.error}</p>}
        {extra}
        <p className="rv-caption" style={{ margin: "18px 0 8px" }}>Código do app autenticador</p>
        <div className="otp" style={{ position: "relative" }}>
          {digits.map((d, i) => <span key={i} className={i === next ? "on" : ""}>{d === " " ? " " : d}</span>)}
          {onCode && (
            <input aria-label="Código do autenticador" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
              onChange={(e) => onCode(e.target.value.replace(/\D/g, "").slice(0, 6))} style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "text" }} />
          )}
        </div>
        {error && <p className="rv-caption" role="alert" style={{ color: "var(--danger)", marginTop: "10px" }}>{error}</p>}
        <div className="row" style={{ gap: "8px", marginTop: "20px" }}>
          <button className="rv-btn rv-btn--block" style={{ flex: "1" }} type="button" onClick={onCancel}>Cancelar</button>
          <button className="rv-btn rv-btn--block rv-btn--primary" style={{ flex: "1" }} type="button" disabled={busy} onClick={onPublish}>{busy ? "Publicando…" : cta}</button>
        </div>
      </div>
    </div>
  );
}

/** Tela do desenho: o quadro de planos esmaecido por baixo do modal. */
export function MasterPlanoPublicar() {
  return (
    <MasterFrame current="planos">
      <MHead title="Planos e preços" caption="Altere o valor direto na tabela. A prévia mostra o paywall como o anfitrião vai ver." />
      <div className="mgrid-plans" style={{ opacity: ".3" }}>
        <section className="mcard" style={{ height: "520px" }} />
        <aside><PhonePreview /></aside>
      </div>
      <PublicarModal />
    </MasterFrame>
  );
}
