"use client";
/* Convidado-consentimento.html (20d): "Antes de fotografar", sobre o visor escurecido. As duas caixas são as duas
   confirmações do app (Termos de Uso e Política de Privacidade), cada uma junto da frase do desenho. */
import Link from "next/link";
import { useEffect, useRef } from "react";
import { CameraFrame, type CameraFrameProps } from "./CameraFrame";

export interface ConvidadoConsentimentoProps extends Omit<CameraFrameProps, "overlay" | "dim"> {
  /** [Termos de Uso, Política de Privacidade] */
  checked?: [boolean, boolean];
  onCheck?: (index: 0 | 1, value: boolean) => void;
  error?: string;
  onLater?: () => void;
  onAccept?: () => void;
}

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
);

export function ConvidadoConsentimento({ checked = [true, true], onCheck, error, onLater, onAccept, left = 27, ...frame }: ConvidadoConsentimentoProps = {}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); }, []);
  const rows = [
    <>Depois da revelação, minhas fotos aparecem no feed do evento, com meu nome. Li e aceito os Termos de Uso.</>,
    <>Os anfitriões podem esconder ou apagar qualquer foto ou comentário. Li a Política de Privacidade.</>,
  ];
  return (
    <CameraFrame
      left={left}
      {...frame}
      dim
      overlay={
        <div className="notice-wrap" style={{ top: "120px" }}>
          <div className="rv-notice" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="consent-titulo">
            <div className="rv-notice__body">
              <h3 id="consent-titulo">Antes de fotografar</h3>
              {rows.map((text, i) => (
                <label key={i} className="consent">
                  <input type="checkbox" checked={checked[i]} onChange={(e) => onCheck?.(i as 0 | 1, e.target.checked)} />
                  <i className={`cbx${checked[i] ? " on" : ""}`}>{CHECK}</i>
                  <span>{text}</span>
                </label>
              ))}
              <p style={{ fontSize: "13px" }}>
                {"Leia os "}
                <Link href="/termos" className="link" target="_blank" rel="noopener">Termos</Link>
                {" e a "}
                <Link href="/privacidade" className="link" target="_blank" rel="noopener">Privacidade</Link>
                . Você pode apagar seus dados quando quiser.
              </p>
              {error && <p className="rv-field-erro" role="alert">{error}</p>}
            </div>
            <div className="rv-notice__actions">
              <button type="button" onClick={onLater}>Agora não</button>
              <button type="button" className="go" onClick={onAccept}>Aceitar</button>
            </div>
          </div>
        </div>
      }
    />
  );
}
