"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, EventHeader, EventTheme, Field, KnownPeople, Signature } from "@/components/memoriesmt";
import { eventStatus } from "@/domain/event";
import { normalizeShareCode } from "@/domain/share-code";
import { formatDate, useEventData } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { tableFromSearch } from "@/features/invitations/links";
import { joinEvent } from "@/features/participants/service";
import { BackendNotice } from "@/features/app/backend-notice";
import { useBrandImages } from "@/features/studio/useBrandImages";
import { CONSENT_FAILED, CONSENT_REQUIRED, ConsentChecks } from "@/features/consent/ConsentCheck";
import { currentConsent, recordConsent } from "@/lib/consent";

const MESSAGES = {
  codigo: "Código não confere. Confira no card da mesa.",
  encerrado: "Esta festa já terminou. As fotos continuam com quem estava lá.",
  lotado: "A festa está lotada. Fale com quem convidou você.",
  nome: "Escreva como te chamam na festa.",
} as const;

/** Convite: primeira tela do convidado ao abrir o link ou escanear o QR. */
export default function Convite() {
  const params = useParams<{ code: string }>();
  const code = normalizeShareCode(params.code ?? "") ?? "";
  const router = useRouter();
  const { ready, user, signIn, repos, now, known, switchTo, canSwitchIdentity, backend, ensureSession } = useApp();
  const data = useEventData({ code });
  const brand = useBrandImages(data.event?.id); // só quem já entrou (RLS do bucket) recebe URL assinada
  // na nuvem o convite só abre com sessão (anônima, sem conta): cria ao chegar
  useEffect(() => {
    if (ready && backend === "supabase" && !user) void ensureSession();
  }, [ready, backend, user, ensureSession]);
  const [nameInput, setName] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [ackedPrivacy, setAckedPrivacy] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>();
  const member = data.participants.find((p) => p.userId === user?.id);
  const event = data.event ?? data.preview; // quem ainda não entrou só recebe a prévia do convite
  const isHost = data.access === "organizador";

  const name = nameInput ?? member?.name ?? user?.name ?? "";

  if (!ready || data.loading) return <main className="app-col"><p className="app-screen app-muted">Abrindo o convite…</p></main>;
  if (!event || data.access === "inexistente") {
    return (
      <main className="app-col app-col--card app-fluid">
        <div className="app-screen">
          <h1 className="titulo-tela app-h1">Código não confere.</h1>
          <p className="corpo app-p app-muted">Confira no card da mesa. Esta versão só abre festas criadas neste aparelho.</p>
          <Button href="/entrar" block>Tentar outro código</Button>
          <Button href="/" variant="texto">Voltar ao início</Button>
        </div>
      </main>
    );
  }

  async function enter() {
    setError(undefined);
    if (!acceptedTerms || !ackedPrivacy) return setConsentError(CONSENT_REQUIRED);
    setConsentError(undefined);
    setBusy(true);
    const me = await signIn(name || "");
    if (backend === "supabase") {
      try { await recordConsent(currentConsent("convidado", null, { termsAccepted: acceptedTerms, privacyAcknowledged: ackedPrivacy })); } catch { setBusy(false); return setConsentError(CONSENT_FAILED); }
    }
    const r = await joinEvent(repos, me, code, name, now(), tableFromSearch(window.location.search));
    setBusy(false);
    if (!r.ok) return setError(MESSAGES[r.reason]);
    router.push(`/e/${code}/agora`);
  }

  const ended = (data.preview?.status ?? (data.event ? eventStatus(data.event, now()) : "ativo")) === "encerrado";
  const meta = [formatDate(event.startAt), event.place].filter(Boolean).join(" · ");
  return (
    <EventTheme palette={event.palette} font={event.eventFont} theme={event.theme} className="app-col app-col--card app-fluid">
      <main style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <EventHeader meta={meta} name={event.title} {...brand} />
        <div className="app-screen">
          <p className="emocao app-emocao">A visão de {event.hostName}. Agora, a sua.</p>
          {event.theme?.welcomeMessage && <p className="app-p" data-testid="mensagem-evento">{event.theme.welcomeMessage}</p>}

          {!user && canSwitchIdentity && <KnownPeople people={known} onPick={(id) => void switchTo(id)} />}

          {isHost || member ? (
            <div className="app-stack">
              <h1 className="titulo-tela app-h1">Você está dentro, {member?.name ?? user?.name}.</h1>
              <Button href={`/e/${code}/agora`} block>Ver no Agora</Button>
              {isHost && <Button variant="secundario" href={`/painel/${data.event?.id}`} block>Abrir o painel do evento</Button>}
            </div>
          ) : (
            <form className="app-stack" onSubmit={(e) => { e.preventDefault(); void enter(); }}>
              <h1 className="titulo-tela app-h1">Entrar na festa</h1>
              <Field label="Como te chamam na festa?" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} error={error} />
              {!ended && <ConsentChecks terms={acceptedTerms} privacy={ackedPrivacy} onTerms={(v) => { setAcceptedTerms(v); if (v) setConsentError(undefined); }} onPrivacy={(v) => { setAckedPrivacy(v); if (v) setConsentError(undefined); }} />}
              {consentError && <p className="mm-field-erro" role="alert">{consentError}</p>}
              {!ended && <p className="app-p app-muted">Ao postar, você declara ter o direito de compartilhar a foto com as pessoas autorizadas neste evento.</p>}
              <Button type="submit" variant="primario" block disabled={busy || ended}>{busy ? "Entrando…" : "Entrar na festa"}</Button>
              {ended && <p className="mm-field-erro">{MESSAGES.encerrado}</p>}
            </form>
          )}

          <BackendNotice localText="Versão local: tudo fica guardado neste aparelho. Fotos de outros aparelhos só aparecem quando o servidor entrar." />
          <div style={{ marginTop: "auto" }}><Signature /></div>
        </div>
      </main>
    </EventTheme>
  );
}
