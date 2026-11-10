"use client";
/* Feed-revelou.html (24c): mesmo markup da referência; dados reais por props (padrão = desenho). */
export interface RevelouPrint { src: string; stampLeft: string; stampRight: string }
export const REVELOU_REF_PRINTS: RevelouPrint[] = [
  { src: "/revela/ref/sc-bolo.jpg", stampLeft: "'27 03 14", stampRight: "Rafa" },
  { src: "/revela/ref/sc-aliancas.jpg", stampLeft: "'27 03 14", stampRight: "Leo" },
  { src: "/revela/ref/sc-pista.jpg", stampLeft: "'27 03 14", stampRight: "você" },
];
const SLOTS = [
  { left: "10px", top: "30px", width: "140px", height: "176px", transform: "rotate(-8deg)", zIndex: "1" },
  { left: "170px", top: "10px", width: "140px", height: "176px", transform: "rotate(6deg)", zIndex: "2" },
  { left: "86px", top: "120px", width: "150px", height: "188px", transform: "rotate(-1deg)", zIndex: "3" },
] as const;

export interface FeedRevelouProps {
  /** "DOM 15 MAR · 12:00" */
  stamp?: string;
  text?: string;
  prints?: RevelouPrint[];
  onOpen?: () => void;
}

export function FeedRevelou({ stamp = "DOM 15 MAR · 12:00", text = "As 418 fotos de Ana & Leo estão prontas. 27 são suas.", prints = REVELOU_REF_PRINTS, onOpen }: FeedRevelouProps = {}) {
  return (
    <>
    <div className="scr">
      <img src="/revela/ref/obj-confetti.webp" alt="" style={{ position: "absolute", left: "-110px", top: "250px", width: "610px", opacity: ".85" }} />
      <div className="safe" style={{ textAlign: "center", alignItems: "center" }}>
        <p className="rv-stamp" style={{ marginTop: "10px" }}>{stamp}</p>
        <h1 className="rv-display" style={{ marginTop: "10px" }}>Revelou.</h1>
        <p className="rv-body muted" style={{ margin: "10px 0 0", maxWidth: "300px" }}>{text}</p>
        <div className="table" style={{ width: "330px", margin: "18px auto 10px" }}>
          {prints.slice(0, 3).map((p, i) => (
            <div key={i} className="rv-print" style={{ position: "absolute", ...SLOTS[i] }}>
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
