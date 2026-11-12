"use client";
/* Feed-revelou.html (24c): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { useEffect, useRef, useState } from "react";
import { revealMoment } from "@/lib/motion/revela-motion";
import { useMomentOnce } from "@/lib/motion/use-moments";

export interface RevelouPrint { src: string; stampLeft: string; stampRight: string }
export const REVELOU_REF_PRINTS: RevelouPrint[] = [
  { src: "/revela/ref/sc-bolo.jpg", stampLeft: "'27 03 14", stampRight: "Rafa" },
  { src: "/revela/ref/sc-aliancas.jpg", stampLeft: "'27 03 14", stampRight: "Leo" },
  { src: "/revela/ref/sc-pista.jpg", stampLeft: "'27 03 14", stampRight: "você" },
];
const SLOTS = [
  { left: "10px", top: "30px", width: "140px", height: "176px", transform: "rotate(-8deg)", "--rv-rot": "-8deg", zIndex: "1" },
  { left: "170px", top: "10px", width: "140px", height: "176px", transform: "rotate(6deg)", "--rv-rot": "6deg", zIndex: "2" },
  { left: "86px", top: "120px", width: "150px", height: "188px", transform: "rotate(-1deg)", "--rv-rot": "-1deg", zIndex: "3" },
] as const;

export interface FeedRevelouProps {
  /** "DOM 15 MAR · 12:00" */
  stamp?: string;
  text?: string;
  prints?: RevelouPrint[];
  /** quantas fotos ainda vão chegar (as reais carregam depois da tela): o momento espera por elas */
  expected?: number;
  onOpen?: () => void;
}

export function FeedRevelou({ stamp = "DOM 15 MAR · 12:00", text = "As 418 fotos de Ana & Leo estão prontas. 27 são suas.", prints = REVELOU_REF_PRINTS, expected, onOpen }: FeedRevelouProps = {}) {
  const title = useRef<HTMLHeadingElement>(null);
  const table = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  // as fotos reais chegam depois da tela: espera por elas (ou, sem foto nenhuma, um instante) para soltar o momento uma vez
  const [waited, setWaited] = useState(false);
  const [started, setStarted] = useState(false); // até começar, título e fotos ficam apagados (o kit os traz de volta)
  useEffect(() => { const t = setTimeout(() => setWaited(true), 900); return () => clearTimeout(t); }, []);
  useMomentOnce((prints.length > 0 && prints.length >= Math.min(3, expected ?? 1)) || waited, () => {
    setStarted(true);
    if (!title.current || !canvas.current) return;
    void revealMoment({ title: title.current, prints: table.current?.querySelectorAll<HTMLElement>(".rv-print") ?? [], canvas: canvas.current, flash: flash.current ?? undefined });
  });
  return (
    <>
    <div className="scr">
      <canvas ref={canvas} className="rvm-fx" aria-hidden="true" data-testid="confete" />
      <div ref={flash} className="rvm-flash" aria-hidden="true" />
      <div className="safe" style={{ textAlign: "center", alignItems: "center" }}>
        <p className="rv-stamp" style={{ marginTop: "10px" }}>{stamp}</p>
        <h1 ref={title} className="rv-display" style={{ marginTop: "10px", opacity: started ? undefined : 0 }}>Revelou.</h1>
        <p className="rv-body muted" style={{ margin: "10px 0 0", maxWidth: "300px" }}>{text}</p>
        <div ref={table} className="table" style={{ width: "330px", margin: "18px auto 10px", opacity: started ? undefined : 0 }}>
          {prints.slice(0, 3).map((p, i) => (
            <div key={i} className="rv-print" style={{ position: "absolute", ...SLOTS[i] } as React.CSSProperties}>
              <img src={p.src} alt="Foto de convidado" />
              <div className="rv-print__cap">
                <span>{p.stampLeft}</span>
                <span>{p.stampRight}</span>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onOpen}>
          Abrir o feed
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
