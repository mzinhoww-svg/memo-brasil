"use client";
/* Feed-reacoes.html (24f): mesmo markup da referência; dados reais por props (padrão = desenho). */
const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export interface ReacaoItem { id: string; label: string; count: number; on?: boolean }
export const REACOES_REF: ReacaoItem[] = [
  { id: "amei", label: "Amei", count: 41, on: true },
  { id: "esse-momento", label: "Esse momento", count: 22 },
  { id: "risada", label: "Rachei", count: 9 },
  { id: "uau", label: "Uau", count: 14 },
];

export interface FeedReacoesProps {
  /** "12 de 418" */
  position?: string;
  imageSrc?: string;
  stampLeft?: string;
  stampRight?: string;
  avatar?: string;
  author?: string;
  /** "pose 19 de 27 · Primeira dança" */
  meta?: string;
  reactions?: ReacaoItem[];
  onClose?: () => void;
  onMore?: () => void;
  onReact?: (id: string) => void;
  onComment?: () => void;
  onDownload?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function FeedReacoes({ position = "12 de 418", imageSrc = "/revela/ref/sc-aliancas.jpg", stampLeft = "'27 03 14 · 22:41", stampRight = "por Leo", avatar = "L", author = "Leo", meta = "pose 19 de 27 · Primeira dança", reactions = REACOES_REF, onClose, onMore, onReact, onComment, onDownload, onPrev, onNext }: FeedReacoesProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ background: "var(--k-070606)" }}>
        <div className="row between">
          <button type="button" className="rv-icon-btn" aria-label="Fechar" onClick={onClose}>
            <svg {...svg}>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
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
          <div className="rv-print" style={{ width: "330px", height: "420px", transform: "rotate(-1.5deg)", zIndex: "1" }}>
            <img src={imageSrc} alt="Foto de convidado" />
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
        <div className="reacbar">
          {reactions.map((r) => (
            <button key={r.id} type="button" className={r.on ? "on" : ""} aria-pressed={onReact ? Boolean(r.on) : undefined} onClick={onReact && (() => onReact(r.id))}>
              <b>{r.label}</b>
              <small>{r.count}</small>
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: "10px", marginTop: "12px" }}>
          <span className="avatar avatar--sm">{avatar}</span>
          <div style={{ flex: "1" }}>
            <b style={{ fontWeight: "600" }}>{author}</b>
            <div className="rv-caption">{meta}</div>
          </div>
          <button type="button" className="rv-icon-btn" aria-label="Comentar" onClick={onComment}>
            <svg {...svg}>
              <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4a8 8 0 1 1 16-4z" />
            </svg>
          </button>
          <button type="button" className="rv-icon-btn" aria-label="Baixar" onClick={onDownload}>
            <svg {...svg}>
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
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
