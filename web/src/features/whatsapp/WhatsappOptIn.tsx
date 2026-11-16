"use client";

import { Button } from "@/components/memoriesmt";
import { WA_COPY } from "./copy";
import { useWhatsappOptIn } from "./useWhatsappOptIn";

export type WhatsappVariant = "cartao" | "compacta" | "passo";

/**
 * Botão "Receber avisos no WhatsApp". Some sozinho quando o recurso está desligado, fora do modo nuvem, para quem não é participante
 * e depois da revelação, a menos que já esteja ativado (o cartão continua mostrando "Ativado ✓" com a instrução de SAIR).
 */
export function WhatsappOptIn({ eventId, variant, revealed = false, onContinue, onSkip }: {
  eventId: string; variant: WhatsappVariant; revealed?: boolean; onContinue?: () => void; onSkip?: () => void;
}) {
  const { live, status, phase, error, fallbackLink, optin, start } = useWhatsappOptIn(eventId);
  if (!live || !status || !status.enabled || !status.eligible) return null;
  if (revealed && !optin) return null; // pós-evento fica fora do primeiro corte: nada de pedir opt-in depois da revelação

  const busy = phase === "opening";
  const waiting = phase === "waiting" && !optin;

  const stateBlock = optin ? (
    <div className="app-stack-sm" data-testid="wa-ativado">
      <p className="app-p" role="status"><strong>{WA_COPY.active}</strong></p>
      <p className="app-p app-muted meta">{WA_COPY.howToStop}</p>
    </div>
  ) : waiting ? (
    <div className="app-stack-sm" data-testid="wa-aguardando">
      <p className="app-p" role="status"><strong>{WA_COPY.waiting}</strong></p>
      <p className="app-p app-muted meta">{WA_COPY.waitingHelp}</p>
      {fallbackLink && <a className="mm-btn mm-btn--secundario mm-btn--bloco" href={fallbackLink} target="_blank" rel="noopener noreferrer"><span>{WA_COPY.fallbackLink}</span></a>}
      <Button variant="texto" onClick={() => void start()} disabled={busy}>{WA_COPY.reopen}</Button>
    </div>
  ) : (
    <div className="app-stack-sm">
      <Button variant={variant === "compacta" ? "secundario" : "primario"} small={variant === "compacta"} block={variant !== "compacta"} onClick={() => void start()} disabled={busy}>
        {busy ? "Abrindo o WhatsApp…" : WA_COPY.button}
      </Button>
      {error && <p className="mm-field-erro" role="alert">{error}</p>}
    </div>
  );

  if (variant === "compacta") {
    if (optin) return null; // lembrete: some assim que ativa
    return (
      <div className="app-stack-sm" data-testid="wa-compacta">
        <p className="app-p app-muted meta">{WA_COPY.pitchShort}</p>
        {stateBlock}
        <p className="app-p app-muted meta">{WA_COPY.privacy}</p>
      </div>
    );
  }

  if (variant === "passo") {
    return (
      <div className="app-stack" data-testid="wa-passo">
        <h1 className="titulo-tela app-h1">{WA_COPY.stepTitle}</h1>
        <p className="corpo app-p">{WA_COPY.pitch}</p>
        {stateBlock}
        <p className="app-p app-muted meta">{WA_COPY.privacy}</p>
        {optin
          ? <Button block onClick={onContinue}>{WA_COPY.next}</Button>
          : <Button variant="texto" onClick={onSkip ?? onContinue}>{WA_COPY.skip}</Button>}
      </div>
    );
  }

  return (
    <div className="app-card app-stack-sm" data-testid="wa-cartao">
      {!optin && <p className="app-p">{WA_COPY.pitch}</p>}
      {stateBlock}
      <p className="app-p app-muted meta">{WA_COPY.privacy}</p>
    </div>
  );
}
