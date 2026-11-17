"use client";

import { Button } from "@/components/revela";
import { WA_COPY } from "./copy";
import { useWhatsappOptIn } from "./useWhatsappOptIn";

export type WhatsappVariant = "linha" | "compacta" | "passo";

/** Logotipo oficial do WhatsApp (glifo sem alteração de desenho), na cor da marca ou herdando a cor do botão. */
export function WhatsappLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

/**
 * "Avisar no WhatsApp" no design Revela. Some sozinho quando o recurso está desligado, fora do modo nuvem, para quem não é participante e
 * depois da revelação, a menos que já esteja ativado. O link wa.me é pré-gerado: o toque é um <a href target=_blank> que abre o WhatsApp
 * na hora (sem aba em branco). Enquanto o link não está pronto, o botão mostra "Preparando o WhatsApp…".
 * Variantes: `linha` (grupo "Avisos" de Você), `compacta` (lembrete em telas de espera) e `passo` (etapa opcional da entrada).
 */
export function WhatsappOptIn({ eventId, variant, revealed = false, onContinue, onSkip }: {
  eventId: string; variant: WhatsappVariant; revealed?: boolean; onContinue?: () => void; onSkip?: () => void;
}) {
  const { live, status, phase, error, link, optin, opened, retry } = useWhatsappOptIn(eventId);
  if (!live || !status || !status.enabled || !status.eligible) return null;
  if (revealed && !optin) return null; // pós-evento fica fora do primeiro corte: nada de pedir opt-in depois da revelação

  const small = variant !== "passo";
  const cta = phase === "error" ? (
    <div className="stack">
      <p className="rv-field-erro" role="alert">{error}</p>
      <button type="button" className={`wa-btn${small ? " wa-btn--compacto" : ""}`} onClick={retry}><WhatsappLogo />{WA_COPY.retry}</button>
    </div>
  ) : link ? (
    <a className={`wa-btn${small ? " wa-btn--compacto" : ""}`} href={link} target="_blank" rel="noopener" onClick={opened} data-testid="wa-abrir">
      <WhatsappLogo />{phase === "opening" ? WA_COPY.opening : WA_COPY.button}
    </a>
  ) : (
    <span className={`wa-btn${small ? " wa-btn--compacto" : ""}`} role="button" aria-disabled="true" aria-busy="true" data-testid="wa-preparando">
      <span className="wa-spin" aria-hidden="true" />{WA_COPY.preparing}
    </span>
  );
  const waiting = (
    <div className="wa-wait" data-testid="wa-aguardando" role="status">
      <b><span className="wa-spin" aria-hidden="true" />{WA_COPY.waiting}</b>
      <span className="rv-caption">{WA_COPY.waitingHelp}</span>
      {link && <a className="wa-again" href={link} target="_blank" rel="noopener" onClick={opened}>{WA_COPY.reopen}</a>}
    </div>
  );
  const active = (
    <div className="stack" data-testid="wa-ativado">
      <span className="wa-ok" role="status"><WhatsappLogo />{WA_COPY.active}</span>
      <p className="rv-caption">{WA_COPY.howToStop}</p>
    </div>
  );
  const body = optin ? active : phase === "waiting" ? waiting : cta;

  if (variant === "linha") {
    return (
      <div className="rv-row" style={{ alignItems: "flex-start" }} data-testid="wa-linha">
        <WhatsappLogo className="wa-icon" />
        <div className="rv-row__text stack" style={{ width: "100%", gap: 8 }}>
          {!optin && phase !== "waiting" && <span className="rv-row__meta">{WA_COPY.pitchShort}</span>}
          {body}
          {!optin && <span className="rv-row__meta">{WA_COPY.privacy}</span>}
        </div>
      </div>
    );
  }

  if (variant === "compacta") {
    if (optin) return null; // lembrete: some assim que ativa
    return (
      <div className="stack" data-testid="wa-compacta" style={{ marginTop: 14 }}>
        <p className="rv-caption">{WA_COPY.pitchShort}</p>
        {body}
        <p className="rv-caption">{WA_COPY.privacy}</p>
      </div>
    );
  }

  return (
    <div className="wa-hero" data-testid="wa-passo">
      <span className="wa-hero__badge" aria-hidden="true"><WhatsappLogo /></span>
      <h1 className="rv-title-lg" style={{ fontSize: 28 }}>{WA_COPY.stepTitle}</h1>
      <p className="rv-body muted">{WA_COPY.pitch}</p>
      {body}
      <p className="rv-caption">{WA_COPY.privacy}</p>
      {optin
        ? <Button block onClick={onContinue}>{WA_COPY.next}</Button>
        : <button type="button" className="wa-skip" onClick={onSkip ?? onContinue}>{WA_COPY.skip}</button>}
    </div>
  );
}
