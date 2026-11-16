"use client";
/* Anfitriao-ajustes.html (17): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { Chevron, RowAction, ScreenFoot, ScreenHeader, svgProps } from "../painel-ui";

export interface AjustesProps {
  name?: string;
  cam?: string;
  plan?: string;
  closes?: string;
  reveals?: string;
  film?: string;
  poses?: string;
  feedOn?: boolean;
  /** Mostra "Encerrar o filme agora" (some depois que o evento terminou). */
  canEnd?: boolean;
  onClose?: () => void;
  onMore?: () => void;
  onWrap?: () => void;
  onName?: () => void;
  onPlan?: () => void;
  onCloses?: () => void;
  onReveals?: () => void;
  onFilm?: () => void;
  onPoses?: () => void;
  onFeed?: () => void;
  onEnd?: () => void;
}

export const AJUSTES_REF: Required<AjustesProps> = {
  name: "Ana & Leo", cam: "/revela/ref/cam-casamento.webp", plan: "Casamento · até 250 convidados", closes: "sáb, 14 mar, 23:59", reveals: "dom, 15 mar, 12:00", film: "35mm", poses: "27 por pessoa", feedOn: true, canEnd: true,
  onClose: () => undefined, onMore: () => undefined, onWrap: () => undefined, onName: () => undefined, onPlan: () => undefined, onCloses: () => undefined, onReveals: () => undefined, onFilm: () => undefined, onPoses: () => undefined, onFeed: () => undefined, onEnd: () => undefined,
};

export function AnfitriaoAjustes({ name = AJUSTES_REF.name, cam = AJUSTES_REF.cam, plan = AJUSTES_REF.plan, closes = AJUSTES_REF.closes, reveals = AJUSTES_REF.reveals, film = AJUSTES_REF.film, poses = AJUSTES_REF.poses, feedOn = AJUSTES_REF.feedOn, canEnd = AJUSTES_REF.canEnd, onClose, onMore, onWrap, onName, onPlan, onCloses, onReveals, onFilm, onPoses, onFeed, onEnd }: AjustesProps = {}) {
  return (
    <>
    <div className="scr sheet-scr">
      <div className="sheet-full" style={{ "paddingTop": "16px", "overflowY": "auto" }}>
        <ScreenHeader onBack={onClose} backLabel="Fechar" close title={name} action={(
          <button type="button" className="rv-icon-btn" aria-label="Mais" onClick={onMore}>
            <svg {...svgProps}>
              <circle cx="5" cy="12" r="1.2" />
              <circle cx="12" cy="12" r="1.2" />
              <circle cx="19" cy="12" r="1.2" />
            </svg>
          </button>
        )} />
        <div className="row" style={{ "gap": "12px", "margin": "14px 0 6px" }}>
          <img src={cam} alt="" style={{ "width": "150px" }} />
          <div className="stack" style={{ "flex": "1", "gap": "8px" }}>
            <button type="button" className="rv-btn rv-btn--sm" onClick={onWrap}>
              <svg {...svgProps}>
                <path d="M9.5 14.5L3 21M14 4l6 6-7 7-6-6z" />
              </svg>
              {" Trocar embalagem"}
            </button>
            <button type="button" className="rv-btn rv-btn--sm" onClick={onName}>
              <svg {...svgProps}>
                <path d="M4 20h4L19 9l-4-4L4 16z" />
              </svg>
              {" Editar nome"}
            </button>
          </div>
        </div>
        <div className="rv-group">
          <RowAction onClick={onPlan}>
            <svg {...svgProps}>
              <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
            </svg>
            <div className="rv-row__text">
              <span className="rv-row__meta">
                Plano
              </span>
              {plan}
            </div>
            <Chevron />
          </RowAction>
          <RowAction onClick={onCloses}>
            <svg {...svgProps}>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            <div className="rv-row__text">
              <span className="rv-row__meta">
                Fecha
              </span>
              {closes}
            </div>
            <Chevron />
          </RowAction>
          <RowAction onClick={onReveals}>
            <svg {...svgProps}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <div className="rv-row__text">
              <span className="rv-row__meta">
                Revela
              </span>
              {reveals}
            </div>
            <Chevron />
          </RowAction>
          <RowAction onClick={onFilm}>
            <svg {...svgProps}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
            </svg>
            <div className="rv-row__text">
              <span className="rv-row__meta">
                Filme
              </span>
              {film}
            </div>
            <Chevron />
          </RowAction>
          <RowAction onClick={onPoses}>
            <svg {...svgProps}>
              <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <div className="rv-row__text">
              <span className="rv-row__meta">
                Poses
              </span>
              {poses}
            </div>
            <Chevron />
          </RowAction>
          <RowAction onClick={onFeed} role="switch" checked={feedOn} label="Feed com curtidas e comentários">
            <svg {...svgProps}>
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <div className="rv-row__text">
              Feed com curtidas e comentários
            </div>
            <span className="rv-caption" aria-hidden="true">{feedOn ? "Ligado" : "Desligado"}</span>
            <span aria-hidden="true" className={feedOn ? "rv-toggle rv-toggle--on" : "rv-toggle"} />
          </RowAction>
        </div>
        <div className="grow" />
        {canEnd && (
          <button type="button" className="rv-btn rv-btn--block rv-btn--line" style={{ "color": "var(--danger)" }} onClick={onEnd}>
            Encerrar o filme agora
          </button>
        )}
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}
