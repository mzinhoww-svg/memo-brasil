"use client";
/* Miolo da tela Pagamento-trocar-plano.html (plano atual, medidores, aviso, "Aumentar para", cartões, nota de pagamento e erro), sem `.scr`,
   sem cabeçalho e sem o botão. Fragmento: dentro de `.scr > .safe` (PagamentoTrocarPlano) ou do quadro do painel (PlanPicker). Editado à mão. */
import type { ReactNode } from "react";
import { PlanCards } from "../PlanCards";
import { PLANS_REF, type PlanView } from "./CameraPublicar";

export interface Gauge { label: string; text: string; pct: number; warn?: boolean }
export interface PlanoConteudoProps {
  current?: string; gauges?: Gauge[]; warning?: string | null; plans?: PlanView[]; selected?: string; payNote?: string; error?: string;
  onSelect?: (code: string) => void;
  /** Depois do erro, no fim do miolo (ex.: o botão, na tela inteira do desenho). */
  children?: ReactNode;
}

export function PlanoConteudo({
  current = "Festa · R$ 29", gauges = [{ label: "Convidados", text: "28 de 30", pct: 93, warn: true }, { label: "Poses por pessoa", text: "24 de 24", pct: 100 }],
  warning = 'Faltam 2 lugares. Quem chegar depois vê "câmera lotada".', plans = PLANS_REF, selected = "celebracao", payNote = "Pix ou cartão, sem sair do app", error, onSelect, children,
}: PlanoConteudoProps = {}) {
  return (
    <>
      <div className="hero-ev" style={{ marginTop: "14px" }}>
        <div className="row between">
          <span className="rv-caption">Plano atual</span>
          <span className="badge">{current}</span>
        </div>
        <div style={{ marginTop: "14px" }} className="stack">
          {gauges.map((g) => (
            <div key={g.label} className={`gauge${g.warn ? " gauge--warn" : ""}`}>
              <div className="row between">
                <span>{g.label}</span>
                <b>{g.text}</b>
              </div>
              <i>
                <s style={{ width: `${g.pct}%` }} />
              </i>
            </div>
          ))}
        </div>
        {warning && <p className="rv-caption" style={{ marginTop: "12px", color: "var(--carimbo)" }}>{warning}</p>}
      </div>
      <h2 className="rv-group-h">Aumentar para</h2>
      <PlanCards plans={plans} selected={selected} onSelect={onSelect} />
      <div className="grow" />
      <div className="paynote">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
        </svg>
        <span>{payNote}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span>ValidaPay</span>
      </div>
      {error && <p className="rv-caption center plano-erro-nativo" role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      {children}
    </>
  );
}
