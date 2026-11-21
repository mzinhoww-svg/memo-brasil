"use client";

import { useCallback, useEffect, useState } from "react";
import { WhatsappLogo } from "@/features/whatsapp/WhatsappOptIn";
import { getHostWhatsappStatus, HostWhatsappError, requestHostWhatsappLink, subscribeHostWhatsapp, type HostWhatsappStatus } from "./api";

const ERRORS = {
  gateway: "O WhatsApp não respondeu agora. Tente de novo em instantes.",
  muitas: "Você pediu várias vezes seguidas. Espere alguns minutos e tente de novo.",
  rede: "Sem conexão agora. Confira a internet e toque de novo.",
} as const;

/**
 * Opt-in do anfitrião: lembretes do evento e do pagamento no WhatsApp. Consentimento explícito (a pessoa toca e envia a mensagem
 * pelo próprio WhatsApp); some quando o recurso está desligado ou fora da nuvem; "SAIR" desativa a qualquer momento.
 */
const COPY = {
  painel: {
    title: "Avisos no WhatsApp",
    body: "Receba os lembretes do seu evento e do pagamento no seu WhatsApp. Só sobre os seus eventos; para sair, envie SAIR a qualquer momento.",
    cta: "Receber avisos no WhatsApp",
  },
  // logo depois de criar o evento: pergunta clara e opcional (texto da Coordenação)
  criacao: {
    title: "Quer receber no WhatsApp os lembretes do seu evento?",
    body: "Avisamos quando faltar pouco para a festa e quando os convidados chegarem ao limite. Responda SAIR quando quiser.",
    cta: "Sim, quero receber no WhatsApp",
  },
} as const;

export function HostWhatsappOptIn({ variant = "painel" }: { variant?: keyof typeof COPY } = {}) {
  const copy = COPY[variant];
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<HostWhatsappStatus | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => { void getHostWhatsappStatus().then(setStatus, () => setStatus(null)); }, []);
  useEffect(() => { load(); return subscribeHostWhatsapp(load); }, [load]);

  async function ask() {
    setBusy(true); setError(null);
    try { setLink(await requestHostWhatsappLink()); }
    catch (e) { setError(ERRORS[e instanceof HostWhatsappError ? e.kind : "rede"]); }
    finally { setBusy(false); }
  }

  if (!status?.enabled || dismissed) return null;
  if (status.optin) {
    return (
      <section className="app-card stack" data-testid="host-wa-ativado">
        <span className="wa-ok" role="status"><WhatsappLogo />Avisos no WhatsApp ativados</span>
        <p className="rv-caption">Para desativar, envie SAIR no WhatsApp.</p>
      </section>
    );
  }
  return (
    <section className="app-card stack" aria-labelledby="host-wa-titulo">
      <h2 id="host-wa-titulo" className="titulo-card app-h1">{copy.title}</h2>
      <p className="app-p app-muted">{copy.body}</p>
      {error && <p className="rv-field-erro" role="alert">{error}</p>}
      {link ? (
        <a className="wa-btn wa-btn--compacto" href={link} target="_blank" rel="noopener"><WhatsappLogo />Abrir o WhatsApp e enviar</a>
      ) : (
        <button type="button" className="wa-btn wa-btn--compacto" onClick={() => void ask()} disabled={busy} aria-busy={busy || undefined}>
          <WhatsappLogo />{error ? "Tentar de novo" : busy ? "Preparando o WhatsApp…" : copy.cta}
        </button>
      )}
      {variant === "criacao" && !link && <button type="button" className="plano-link" onClick={() => setDismissed(true)}>Agora não</button>}
    </section>
  );
}
