"use client";

import { Button } from "@/components/revela";
import { WA_COPY } from "./copy";
import { useWhatsappOptIn } from "./useWhatsappOptIn";

export type WhatsappVariant = "linha" | "compacta" | "passo";

const chat = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" />
  </svg>
);

/**
 * "Receber avisos no WhatsApp" no design Revela. Some sozinho quando o recurso está desligado, fora do modo nuvem, para quem não é
 * participante e depois da revelação, a menos que já esteja ativado (a linha continua mostrando "Ativado ✓" e como sair com SAIR).
 * Variantes: `linha` (grupo "Avisos" de Você), `compacta` (lembrete em telas de espera) e `passo` (etapa opcional da entrada).
 */
export function WhatsappOptIn({ eventId, variant, revealed = false, onContinue, onSkip }: {
  eventId: string; variant: WhatsappVariant; revealed?: boolean; onContinue?: () => void; onSkip?: () => void;
}) {
  const { live, status, phase, error, fallbackLink, optin, start } = useWhatsappOptIn(eventId);
  if (!live || !status || !status.enabled || !status.eligible) return null;
  if (revealed && !optin) return null; // pós-evento fica fora do primeiro corte: nada de pedir opt-in depois da revelação

  const busy = phase === "opening";
  const waiting = phase === "waiting" && !optin;
  const errorLine = error && <p className="rv-field-erro" role="alert">{error}</p>;
  const waitingBlock = (
    <div className="stack" data-testid="wa-aguardando">
      <p className="rv-body" role="status"><b>{WA_COPY.waiting}</b></p>
      <p className="rv-caption">{WA_COPY.waitingHelp}</p>
      {fallbackLink && <a className="rv-btn rv-btn--block" href={fallbackLink} target="_blank" rel="noopener noreferrer">{WA_COPY.fallbackLink}</a>}
      <Button variant="texto" onClick={() => void start()} disabled={busy}>{WA_COPY.reopen}</Button>
    </div>
  );
  const activeBlock = (
    <div className="stack" data-testid="wa-ativado">
      <p className="rv-body" role="status"><b>{WA_COPY.active}</b></p>
      <p className="rv-caption">{WA_COPY.howToStop}</p>
    </div>
  );

  if (variant === "linha") {
    if (waiting) return <div className="rv-row" style={{ alignItems: "flex-start" }}>{chat}<div className="rv-row__text" style={{ width: "100%" }}>{waitingBlock}</div></div>;
    if (optin) return <div className="rv-row" style={{ alignItems: "flex-start" }}>{chat}<div className="rv-row__text">{activeBlock}</div></div>;
    return (
      <>
        <div className="rv-row" role="button" tabIndex={0} aria-label={WA_COPY.button} aria-disabled={busy} data-testid="wa-linha"
          onClick={() => void start()} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); void start(); } }}>
          {chat}
          <div className="rv-row__text" aria-hidden="true">
            {busy ? "Abrindo o WhatsApp…" : WA_COPY.button}
            <span className="rv-row__meta">{WA_COPY.privacy}</span>
          </div>
        </div>
        {errorLine}
      </>
    );
  }

  const action = optin ? activeBlock : waiting ? waitingBlock : (
    <div className="stack">
      <Button variant={variant === "compacta" ? "secundario" : "primario"} small={variant === "compacta"} block onClick={() => void start()} disabled={busy}>
        {busy ? "Abrindo o WhatsApp…" : WA_COPY.button}
      </Button>
      {errorLine}
    </div>
  );

  if (variant === "compacta") {
    if (optin) return null; // lembrete: some assim que ativa
    return (
      <div className="stack" data-testid="wa-compacta" style={{ marginTop: 14 }}>
        <p className="rv-caption">{WA_COPY.pitchShort}</p>
        {action}
        <p className="rv-caption">{WA_COPY.privacy}</p>
      </div>
    );
  }

  return (
    <div className="stack" data-testid="wa-passo">
      <h1 className="rv-title-lg" style={{ fontSize: 28 }}>{WA_COPY.stepTitle}</h1>
      <p className="rv-body muted">{WA_COPY.pitch}</p>
      {action}
      <p className="rv-caption">{WA_COPY.privacy}</p>
      {optin
        ? <Button block onClick={onContinue}>{WA_COPY.next}</Button>
        : <Button variant="texto" onClick={onSkip ?? onContinue}>{WA_COPY.skip}</Button>}
    </div>
  );
}
