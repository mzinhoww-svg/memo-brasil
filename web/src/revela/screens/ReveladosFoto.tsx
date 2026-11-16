"use client";
/* Revelados-foto.html (19): mesmo markup da referência; dados reais por props (padrão = desenho). */
import Link from "next/link";

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export interface ReveladosFotoProps {
  /** "12 de 418" */
  position?: string;
  imageSrc?: string;
  /** primeira vez que a foto abre: ela sai do banho do laboratório (rv-develop) */
  develop?: boolean;
  stampLeft?: string;
  stampRight?: string;
  avatar?: string;
  author?: string;
  /** "pose 19 de 27" */
  meta?: string;
  /** a estrela do desenho marca a foto como destaque (Escolha dos noivos) */
  highlighted?: boolean;
  closeHref?: string;
  onMore?: () => void;
  onStar?: () => void;
  onDownload?: () => void;
  downloadLabel?: string;
  onShare?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function ReveladosFoto({ position = "12 de 418", imageSrc = "/revela/ref/sc-aliancas.jpg", develop = false, stampLeft = "'27 03 14 · 22:41", stampRight = "por Leo", avatar = "L", author = "Leo", meta = "pose 19 de 27", highlighted = false, closeHref, onMore, onStar, onDownload, downloadLabel = "Baixar", onShare, onPrev, onNext }: ReveladosFotoProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ background: "var(--k-070606)" }}>
        <div className="row between">
          <Link href={closeHref ?? "#"} className="rv-icon-btn" aria-label="Fechar">
            <svg {...svg}>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
          <span className="rv-caption">{position}</span>
          <button type="button" className="rv-icon-btn" aria-label="Mais" onClick={onMore}>
            <svg {...svg}>
              <circle cx="5" cy="12" r="1.2" />
              <circle cx="12" cy="12" r="1.2" />
              <circle cx="19" cy="12" r="1.2" />
            </svg>
          </button>
        </div>
        <div className="grow" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="rv-print" style={{ width: "330px", height: "430px", transform: "rotate(-1.5deg)", zIndex: "1" }}>
            <img src={imageSrc} alt="Foto de convidado" className={develop ? "rv-develop" : undefined} />
            <div className="rv-print__cap">
              <span>{stampLeft}</span>
              <span>{stampRight}</span>
            </div>
          </div>
        </div>
        {(onPrev || onNext) && (
          <div className="row between" style={{ margin: "0 0 8px" }}>
            <button type="button" className="rv-icon-btn" aria-label="Foto anterior" onClick={onPrev} disabled={!onPrev}>
              <svg {...svg}><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button type="button" className="rv-icon-btn" aria-label="Próxima foto" onClick={onNext} disabled={!onNext}>
              <svg {...svg}><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        )}
        <div className="row" style={{ gap: "10px", marginBottom: "6px" }}>
          <span className="avatar avatar--sm">{avatar}</span>
          <div style={{ flex: "1" }}>
            <b style={{ fontWeight: "600" }}>{author}</b>
            <div className="rv-caption">{meta}</div>
          </div>
          <button type="button" className="rv-icon-btn" aria-label={onStar ? "Destacar" : "Curtir"} aria-pressed={onStar ? highlighted : undefined} onClick={onStar} style={highlighted ? { color: "var(--revela-text)" } : undefined}>
            <svg {...svg} fill={highlighted ? "currentColor" : "none"}>
              <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z" />
            </svg>
          </button>
          <button type="button" className="rv-icon-btn" aria-label={downloadLabel} onClick={onDownload}>
            <svg {...svg}>
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
          </button>
          <button type="button" className="rv-icon-btn" aria-label="Compartilhar" onClick={onShare}>
            <svg {...svg}>
              <path d="M12 3v13M7 8l5-5 5 5" />
              <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
