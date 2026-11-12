"use client";
/* Gerado de design-system/revela/html/Convidado-minhas.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
import Link from "next/link";
import { GuestTabs } from "../GuestTabs";

export interface MinhasProps {
  code?: string;
  /** quantas poses restam (`null` = rolo livre) */
  left?: number | null;
  /** total do rolo (`null` = livre) */
  total?: number | null;
  /** poses tiradas, em ordem: horário "hh:mm" de cada uma */
  taken?: string[];
  onPickRoll?: () => void;
}
const DEFAULT_TAKEN = ["21:04", "21:10", "21:32", "22:01", "22:40", "22:41", "23:15", "23:30", "23:58"];

export function ConvidadoMinhas({ code, left = 18, total = 27, taken = DEFAULT_TAKEN, onPickRoll }: MinhasProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "paddingBottom": "92px" }}>
        <div className="row between">
          <h1 className="rv-title-lg" style={{ "fontSize": "30px" }}>
            Minhas poses
          </h1>
          <div className="rv-counter">
            <b>{left === null ? "∞" : String(left).padStart(2, "0")}</b>
            <span>
              restantes
            </span>
          </div>
        </div>
        <p className="rv-caption" style={{ "marginTop": "6px" }}>
          {total === null ? `${taken.length} tiradas` : `${taken.length} de ${total} tiradas`}. Elas viram foto na revelação.
        </p>
        <div className="rollgrid rv-rise" style={{ "--i": 1 } as React.CSSProperties}>
          {taken.map((t, i) => (
            <div key={i} className="rv-print rv-print--back">
              <div className="rv-print__cap">
                <span>{`pose ${String(i + 1).padStart(2, "0")}`}</span>
                <span>{t}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="grow" />
        <button type="button" className="rv-btn rv-btn--block" onClick={onPickRoll}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 16l-5-5-9 9" />
          </svg>
          Enviar do rolo da câmera
        </button>
      </div>
      <GuestTabs code={code} current="minhas" />
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
