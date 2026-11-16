"use client";
/* Painel-excluir.html (17j): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { BackButton, ScreenFoot, svgProps, useEmbedded } from "../painel-ui";

export interface PainelExcluirProps {
  name?: string;
  photos?: number;
  /** Texto digitado; o botão só vale quando for igual ao nome. */
  value?: string;
  enabled?: boolean;
  /** Mostra "Encerrar o filme sem excluir" (some depois que o evento terminou). */
  canEnd?: boolean;
  busy?: boolean;
  error?: string;
  onValue?: (value: string) => void;
  onDelete?: () => void;
  onEnd?: () => void;
  onBack?: () => void;
}

export function PainelExcluir({ name = "Ana & Leo", photos = 418, value = "Ana & Le", enabled = false, canEnd = true, busy = false, error, onValue, onDelete, onEnd, onBack }: PainelExcluirProps = {}) {
  const embedded = useEmbedded();
  const Title = embedded ? "h2" : "h1";
  return (
    <>
    <div className="scr sheet-scr">
      {!embedded && (
        <div className="safe" style={{ "opacity": ".35" }}>
          <div className="row between">
            <BackButton onBack={onBack} />
            <span className="rv-title" style={{ "fontSize": "18px" }}>
              Ajustes
            </span>
            <span style={{ "width": "44px" }} />
          </div>
        </div>
      )}
      <div className="sheet-full" style={{ "top": "auto", "height": "540px" }}>
        <div className="rv-sheet__grab" />
        <div className="bankico" style={{ "background": "var(--k-3a1414)", "color": "var(--danger)" }}>
          <svg {...svgProps}>
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </div>
        <Title className="rv-title" style={{ "marginTop": "14px" }}>
          {`Excluir ${name}?`}
        </Title>
        <p className="rv-caption" style={{ "marginTop": "6px" }}>
          {`As ${photos} ${photos === 1 ? "foto" : "fotos"}, os comentários e a lista de convidados somem para todo mundo. Não dá para desfazer. Baixe o ZIP antes.`}
        </p>
        <p className="rv-caption" style={{ "margin": "18px 0 8px" }}>
          Digite o nome do evento para confirmar
        </p>
        <label className="rv-field rv-field--focus">
          <input value={onValue ? value : undefined} defaultValue={onValue ? undefined : value} onChange={onValue ? (e) => onValue(e.target.value) : undefined} aria-label="Nome do evento" autoComplete="off" />
        </label>
        {error && <p className="rv-caption" role="alert" style={{ "color": "var(--danger)", "marginTop": "8px" }}>{error}</p>}
        <div className="grow" />
        <div className="stack">
          <button type="button" className="rv-btn rv-btn--block rv-btn--line" aria-disabled={!enabled || busy ? true : undefined} onClick={enabled && !busy ? onDelete : undefined} style={{ "color": "var(--danger)" }}>
            {busy ? "Excluindo…" : "Excluir para sempre"}
          </button>
          {canEnd && (
            <button type="button" className="rv-btn rv-btn--block" onClick={onEnd}>
              Encerrar o filme sem excluir
            </button>
          )}
        </div>
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}
