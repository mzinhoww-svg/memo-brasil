"use client";
/* Peças repetidas das telas do painel (17…26): o mesmo markup/classes da referência, escrito uma vez. */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { reduced } from "@/lib/motion/revela-motion";

export const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function BackButton({ onBack, label = "Voltar", close = false }: { onBack?: () => void; label?: string; close?: boolean }) {
  return (
    <button type="button" className="rv-icon-btn rv-press" aria-label={label} onClick={onBack}>
      <svg {...svgProps}>{close ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M15 18l-6-6 6-6" />}</svg>
    </button>
  );
}

export function Chevron() {
  return (
    <span className="rv-row__end">
      <svg {...svgProps}><path d="M9 6l6 6-6 6" /></svg>
    </span>
  );
}

/** Rodapé comum de toda tela do desenho (indicador de início e granulado). */
export function ScreenFoot() {
  return (
    <>
      <div className="home-ind" />
      <div className="grain" />
    </>
  );
}

/** Linha tocável do `rv-group`: o markup é o do desenho (div.rv-row), com papel de botão quando tem ação. */
export function RowAction({ className = "rv-row", onClick, children, label, role = "button", checked }: { className?: string; onClick?: () => void; children: ReactNode; label?: string; role?: "button" | "switch"; checked?: boolean }) {
  if (!onClick) return <div className={className}>{children}</div>;
  const key = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } };
  return <div className={className} role={role} aria-checked={role === "switch" ? checked : undefined} tabIndex={0} aria-label={label} onClick={onClick} onKeyDown={key} style={{ cursor: "pointer" }}>{children}</div>;
}

/** Aviso curto sobre a tela (copiado, salvo, falhou). `flash(texto)` mostra por 3 s; o nó vai em qualquer lugar da tela. */
export function useFlash(): [ReactNode, (text: string) => void] {
  const [text, setText] = useState<string | undefined>();
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flash = useCallback((t: string) => {
    setText(t);
    setLeaving(false);
    clearTimeout(timer.current);
    // 3 s no ar; depois `rv-toast-out` (200 ms) e o nó sai
    timer.current = setTimeout(() => {
      setLeaving(true);
      timer.current = setTimeout(() => setText(undefined), reduced() ? 0 : 200);
    }, 3000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = text ? (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(28px + env(safe-area-inset-bottom))", zIndex: 70, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div role="status" aria-live="polite" className={leaving ? "rv-toast-out" : "rv-toast-in"} style={{ maxWidth: 340, padding: "12px 18px", borderRadius: "var(--radius-md)", background: "var(--surface-3)", color: "var(--ink)", font: "500 14px/20px var(--font-sans)", boxShadow: "var(--shadow-sheet)", textAlign: "center" }}>{text}</div>
    </div>
  ) : null;
  return [node, flash];
}

/** Matriz do QR (nível M) → traçado único de módulos escuros, em unidades de módulo. */
export function qrPath(modules: boolean[][]): string {
  const out: string[] = [];
  modules.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) { c++; continue; }
      let end = c;
      while (end + 1 < row.length && row[end + 1]) end++;
      out.push(`M${c + 2} ${r + 2}h${end - c + 1}v1h-${end - c + 1}z`);
      c = end + 1;
    }
  });
  return out.join("");
}

/** QR do evento como vetor: o do desenho (fixture) ou o real, com 2 módulos de margem branca, como na referência. */
export function QrSvg({ size, modules }: { size: number; modules?: boolean[][] }) {
  const n = modules ? modules.length + 4 : 33;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} role="img" aria-label="QR code do evento">
      <rect width={n} height={n} fill="var(--white-1)" />
      <path fill="var(--on-paper)" d={modules ? qrPath(modules) : QR_FIXTURE_D} />
    </svg>
  );
}

const QR_FIXTURE_D = "M2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM8 2h1v1h-1zM11 2h1v1h-1zM12 2h1v1h-1zM13 2h1v1h-1zM14 2h1v1h-1zM15 2h1v1h-1zM16 2h1v1h-1zM17 2h1v1h-1zM20 2h1v1h-1zM24 2h1v1h-1zM25 2h1v1h-1zM26 2h1v1h-1zM27 2h1v1h-1zM28 2h1v1h-1zM29 2h1v1h-1zM30 2h1v1h-1zM2 3h1v1h-1zM8 3h1v1h-1zM12 3h1v1h-1zM13 3h1v1h-1zM19 3h1v1h-1zM21 3h1v1h-1zM24 3h1v1h-1zM30 3h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM8 4h1v1h-1zM10 4h1v1h-1zM12 4h1v1h-1zM16 4h1v1h-1zM17 4h1v1h-1zM18 4h1v1h-1zM19 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM26 4h1v1h-1zM27 4h1v1h-1zM28 4h1v1h-1zM30 4h1v1h-1zM2 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM11 5h1v1h-1zM13 5h1v1h-1zM14 5h1v1h-1zM15 5h1v1h-1zM17 5h1v1h-1zM18 5h1v1h-1zM20 5h1v1h-1zM22 5h1v1h-1zM24 5h1v1h-1zM26 5h1v1h-1zM27 5h1v1h-1zM28 5h1v1h-1zM30 5h1v1h-1zM2 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM17 6h1v1h-1zM18 6h1v1h-1zM19 6h1v1h-1zM20 6h1v1h-1zM24 6h1v1h-1zM26 6h1v1h-1zM27 6h1v1h-1zM28 6h1v1h-1zM30 6h1v1h-1zM2 7h1v1h-1zM8 7h1v1h-1zM10 7h1v1h-1zM11 7h1v1h-1zM12 7h1v1h-1zM13 7h1v1h-1zM14 7h1v1h-1zM17 7h1v1h-1zM19 7h1v1h-1zM21 7h1v1h-1zM24 7h1v1h-1zM30 7h1v1h-1zM2 8h1v1h-1zM3 8h1v1h-1zM4 8h1v1h-1zM5 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM12 8h1v1h-1zM14 8h1v1h-1zM16 8h1v1h-1zM18 8h1v1h-1zM20 8h1v1h-1zM22 8h1v1h-1zM24 8h1v1h-1zM25 8h1v1h-1zM26 8h1v1h-1zM27 8h1v1h-1zM28 8h1v1h-1zM29 8h1v1h-1zM30 8h1v1h-1zM11 9h1v1h-1zM13 9h1v1h-1zM19 9h1v1h-1zM20 9h1v1h-1zM22 9h1v1h-1zM3 10h1v1h-1zM6 10h1v1h-1zM8 10h1v1h-1zM10 10h1v1h-1zM15 10h1v1h-1zM20 10h1v1h-1zM21 10h1v1h-1zM22 10h1v1h-1zM23 10h1v1h-1zM25 10h1v1h-1zM26 10h1v1h-1zM28 10h1v1h-1zM2 11h1v1h-1zM6 11h1v1h-1zM9 11h1v1h-1zM14 11h1v1h-1zM16 11h1v1h-1zM20 11h1v1h-1zM24 11h1v1h-1zM25 11h1v1h-1zM26 11h1v1h-1zM27 11h1v1h-1zM28 11h1v1h-1zM29 11h1v1h-1zM30 11h1v1h-1zM2 12h1v1h-1zM4 12h1v1h-1zM5 12h1v1h-1zM7 12h1v1h-1zM8 12h1v1h-1zM9 12h1v1h-1zM10 12h1v1h-1zM14 12h1v1h-1zM17 12h1v1h-1zM19 12h1v1h-1zM20 12h1v1h-1zM23 12h1v1h-1zM30 12h1v1h-1zM5 13h1v1h-1zM7 13h1v1h-1zM10 13h1v1h-1zM11 13h1v1h-1zM12 13h1v1h-1zM14 13h1v1h-1zM16 13h1v1h-1zM17 13h1v1h-1zM19 13h1v1h-1zM20 13h1v1h-1zM22 13h1v1h-1zM23 13h1v1h-1zM25 13h1v1h-1zM29 13h1v1h-1zM30 13h1v1h-1zM2 14h1v1h-1zM4 14h1v1h-1zM8 14h1v1h-1zM11 14h1v1h-1zM12 14h1v1h-1zM13 14h1v1h-1zM18 14h1v1h-1zM19 14h1v1h-1zM22 14h1v1h-1zM25 14h1v1h-1zM27 14h1v1h-1zM30 14h1v1h-1zM7 15h1v1h-1zM9 15h1v1h-1zM11 15h1v1h-1zM12 15h1v1h-1zM13 15h1v1h-1zM16 15h1v1h-1zM20 15h1v1h-1zM24 15h1v1h-1zM26 15h1v1h-1zM28 15h1v1h-1zM29 15h1v1h-1zM30 15h1v1h-1zM3 16h1v1h-1zM7 16h1v1h-1zM8 16h1v1h-1zM9 16h1v1h-1zM11 16h1v1h-1zM14 16h1v1h-1zM15 16h1v1h-1zM17 16h1v1h-1zM19 16h1v1h-1zM26 16h1v1h-1zM30 16h1v1h-1zM2 17h1v1h-1zM4 17h1v1h-1zM7 17h1v1h-1zM9 17h1v1h-1zM12 17h1v1h-1zM13 17h1v1h-1zM14 17h1v1h-1zM16 17h1v1h-1zM19 17h1v1h-1zM21 17h1v1h-1zM23 17h1v1h-1zM25 17h1v1h-1zM27 17h1v1h-1zM29 17h1v1h-1zM30 17h1v1h-1zM2 18h1v1h-1zM7 18h1v1h-1zM8 18h1v1h-1zM13 18h1v1h-1zM14 18h1v1h-1zM17 18h1v1h-1zM20 18h1v1h-1zM21 18h1v1h-1zM22 18h1v1h-1zM23 18h1v1h-1zM2 19h1v1h-1zM5 19h1v1h-1zM6 19h1v1h-1zM7 19h1v1h-1zM9 19h1v1h-1zM10 19h1v1h-1zM11 19h1v1h-1zM16 19h1v1h-1zM18 19h1v1h-1zM19 19h1v1h-1zM20 19h1v1h-1zM24 19h1v1h-1zM25 19h1v1h-1zM26 19h1v1h-1zM30 19h1v1h-1zM4 20h1v1h-1zM5 20h1v1h-1zM8 20h1v1h-1zM12 20h1v1h-1zM14 20h1v1h-1zM16 20h1v1h-1zM18 20h1v1h-1zM19 20h1v1h-1zM20 20h1v1h-1zM22 20h1v1h-1zM26 20h1v1h-1zM27 20h1v1h-1zM28 20h1v1h-1zM30 20h1v1h-1zM5 21h1v1h-1zM6 21h1v1h-1zM7 21h1v1h-1zM11 21h1v1h-1zM14 21h1v1h-1zM19 21h1v1h-1zM22 21h1v1h-1zM26 21h1v1h-1zM27 21h1v1h-1zM29 21h1v1h-1zM30 21h1v1h-1zM2 22h1v1h-1zM3 22h1v1h-1zM6 22h1v1h-1zM7 22h1v1h-1zM8 22h1v1h-1zM9 22h1v1h-1zM10 22h1v1h-1zM11 22h1v1h-1zM12 22h1v1h-1zM14 22h1v1h-1zM17 22h1v1h-1zM19 22h1v1h-1zM22 22h1v1h-1zM23 22h1v1h-1zM24 22h1v1h-1zM25 22h1v1h-1zM26 22h1v1h-1zM27 22h1v1h-1zM29 22h1v1h-1zM30 22h1v1h-1zM10 23h1v1h-1zM12 23h1v1h-1zM14 23h1v1h-1zM15 23h1v1h-1zM17 23h1v1h-1zM18 23h1v1h-1zM19 23h1v1h-1zM20 23h1v1h-1zM22 23h1v1h-1zM26 23h1v1h-1zM28 23h1v1h-1zM29 23h1v1h-1zM30 23h1v1h-1zM2 24h1v1h-1zM3 24h1v1h-1zM4 24h1v1h-1zM5 24h1v1h-1zM6 24h1v1h-1zM7 24h1v1h-1zM8 24h1v1h-1zM11 24h1v1h-1zM12 24h1v1h-1zM14 24h1v1h-1zM15 24h1v1h-1zM17 24h1v1h-1zM18 24h1v1h-1zM20 24h1v1h-1zM21 24h1v1h-1zM22 24h1v1h-1zM24 24h1v1h-1zM26 24h1v1h-1zM30 24h1v1h-1zM2 25h1v1h-1zM8 25h1v1h-1zM13 25h1v1h-1zM14 25h1v1h-1zM21 25h1v1h-1zM22 25h1v1h-1zM26 25h1v1h-1zM27 25h1v1h-1zM30 25h1v1h-1zM2 26h1v1h-1zM4 26h1v1h-1zM5 26h1v1h-1zM6 26h1v1h-1zM8 26h1v1h-1zM10 26h1v1h-1zM11 26h1v1h-1zM12 26h1v1h-1zM13 26h1v1h-1zM15 26h1v1h-1zM17 26h1v1h-1zM18 26h1v1h-1zM21 26h1v1h-1zM22 26h1v1h-1zM23 26h1v1h-1zM24 26h1v1h-1zM25 26h1v1h-1zM26 26h1v1h-1zM2 27h1v1h-1zM4 27h1v1h-1zM5 27h1v1h-1zM6 27h1v1h-1zM8 27h1v1h-1zM14 27h1v1h-1zM15 27h1v1h-1zM16 27h1v1h-1zM20 27h1v1h-1zM25 27h1v1h-1zM28 27h1v1h-1zM29 27h1v1h-1zM2 28h1v1h-1zM4 28h1v1h-1zM5 28h1v1h-1zM6 28h1v1h-1zM8 28h1v1h-1zM11 28h1v1h-1zM12 28h1v1h-1zM13 28h1v1h-1zM15 28h1v1h-1zM16 28h1v1h-1zM17 28h1v1h-1zM19 28h1v1h-1zM21 28h1v1h-1zM22 28h1v1h-1zM23 28h1v1h-1zM27 28h1v1h-1zM29 28h1v1h-1zM30 28h1v1h-1zM2 29h1v1h-1zM8 29h1v1h-1zM10 29h1v1h-1zM11 29h1v1h-1zM12 29h1v1h-1zM13 29h1v1h-1zM15 29h1v1h-1zM16 29h1v1h-1zM17 29h1v1h-1zM18 29h1v1h-1zM19 29h1v1h-1zM20 29h1v1h-1zM22 29h1v1h-1zM23 29h1v1h-1zM24 29h1v1h-1zM25 29h1v1h-1zM29 29h1v1h-1zM30 29h1v1h-1zM2 30h1v1h-1zM3 30h1v1h-1zM4 30h1v1h-1zM5 30h1v1h-1zM6 30h1v1h-1zM7 30h1v1h-1zM8 30h1v1h-1zM12 30h1v1h-1zM13 30h1v1h-1zM16 30h1v1h-1zM19 30h1v1h-1zM20 30h1v1h-1zM21 30h1v1h-1zM22 30h1v1h-1zM23 30h1v1h-1zM26 30h1v1h-1zM27 30h1v1h-1zM29 30h1v1h-1z";
