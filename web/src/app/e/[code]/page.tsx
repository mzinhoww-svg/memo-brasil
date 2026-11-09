"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, EventHeader, EventTheme, Field, KnownPeople, Signature } from "@/components/revela";
import { eventStatus } from "@/domain/event";
import { normalizeShareCode } from "@/domain/share-code";
import { formatDate, useEventData } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { factsFromEvent, factsFromPreview, inviteLines } from "@/features/invitations/invite-copy";
import { tableFromSearch } from "@/features/invitations/links";
import { joinEvent } from "@/features/participants/service";
import { BackendNotice } from "@/features/app/backend-notice";
import { useBrandImages } from "@/features/studio/useBrandImages";
import { CONSENT_FAILED, CONSENT_REQUIRED, ConsentChecks } from "@/features/consent/ConsentCheck";
import { currentConsent, recordConsent } from "@/lib/consent";
import { copyFor } from "@/features/app/copy";
import { backendMode } from "@/lib/supabase/env";

const MESSAGES = {
  encerrado: "Esta festa já terminou. As fotos continuam com quem estava lá.",
  lotado: "A festa está lotada. Fale com quem convidou você.",
  nome: "Escreva como te chamam na festa.",
  bloqueado: "Sua participação foi bloqueada pelo anfitrião. Fale com quem convidou você.",
  rede: "Sem conexão agora. Confira a internet e toque de novo.",
} as const;

const RETRY_IN_S = 30;

/** Convite: primeira tela do convidado ao abrir o link ou escanear o QR. */
export default function Convite() {
  const params = useParams<{ code: string }>();
  const code = normalizeShareCode(params.code ?? "") ?? "";
  const router = useRouter();
  const { ready, user, signIn, repos, now, known, switchTo, canSwitchIdentity, backend, ensureSession } = useApp();
  const data = useEventData({ code });
  const brand = useBrandImages(data.event?.id); // só quem já entrou (RLS do bucket) recebe URL assinada
  // na nuvem o convite só abre com sessão (anônima, sem conta): cria ao chegar
  const [sessionFailed, setSessionFailed] = useState(false);
  const openSession = useCallback(() => ensureSession().catch(() => setSessionFailed(true)), [ensureSession]);
  useEffect(() => {
    if (ready && backend === "supabase" && !user) void openSession();
  }, [ready, backend, user, openSession]);
  const [joinAt, setJoinAt] = useState<number | undefined>(); // "muita gente entrando" na entrada: nova tentativa automática (UX-04)
  const [secs, setSecs] = useState(RETRY_IN_S);
  const [inactive, setInactive] = useState(false); // o servidor recusou o convite (forbidden)
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
  const refreshData = data.refresh;
  const enterRef = useRef<() => Promise<void>>(async () => undefined);

  // a leitura do convite ou a entrada bateram no limite de tentativas: tenta de novo sozinha, a cada 30 s
  const previewBusy = data.error === "rate-limited";
  const waiting = joinAt !== undefined || previewBusy;
  const deadline = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!waiting) { deadline.current = undefined; return; }
    deadline.current = joinAt ?? Date.now() + RETRY_IN_S * 1000;
    const tick = setInterval(() => {
      const at = deadline.current ?? Date.now();
      setSecs(Math.max(0, Math.ceil((at - Date.now()) / 1000)));
      if (Date.now() < at) return;
      if (joinAt !== undefined) {
        clearInterval(tick);
        setJoinAt(undefined);
        void enterRef.current();
      } else {
        deadline.current = Date.now() + RETRY_IN_S * 1000;
        setSecs(RETRY_IN_S);
        void refreshData();
      }
    }, 250);
    return () => clearInterval(tick);
  }, [waiting, joinAt, refreshData]);
  function retryNow() {
    if (sessionFailed) { setSessionFailed(false); void openSession(); return; }
    if (joinAt !== undefined) { setJoinAt(undefined); void enterRef.current(); return; }
    void openSession();
    void refreshData();
  }

  async function enter() {
    setError(undefined);
    if (!acceptedTerms || !ackedPrivacy) return setConsentError(CONSENT_REQUIRED);
    setConsentError(undefined);
    const trimmed = name.trim();
    if (!trimmed) {
      setError(MESSAGES.nome);
      document.querySelector<HTMLInputElement>('input[autocomplete="given-name"]')?.focus();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const me = await signIn(trimmed);
      if (backend === "supabase") {
        try { await recordConsent(currentConsent("convidado", null, { termsAccepted: acceptedTerms, privacyAcknowledged: ackedPrivacy })); }
        catch { setConsentError(CONSENT_FAILED); return; }
      }
      const r = await joinEvent(repos, me, code, trimmed, now(), tableFromSearch(window.location.search));
      if (!r.ok) {
        if (r.reason === "ocupado") { setSecs(RETRY_IN_S); setJoinAt(Date.now() + RETRY_IN_S * 1000); return; }
        if (r.reason === "inativo") { setInactive(true); return; }
        setError(r.reason === "codigo" ? copyFor(backendMode()).inviteInvalid : MESSAGES[r.reason]);
        return;
      }
      router.push(`/e/${code}/postar`);
    } catch {
      setError(MESSAGES.rede);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { enterRef.current = enter; });

  if (!ready || data.loading) return <main className="app-col"><p className="app-screen app-muted">Abrindo o convite…</p></main>;
  if (inactive || data.error === "forbidden") {
    return (
      <main className="app-col app-col--card app-fluid">
        <div className="app-screen">
          <p className="eyebrow app-eyebrow">Convite</p>
          <h1 className="titulo-tela app-h1">Este convite não está mais ativo.</h1>
          <p className="corpo app-p app-muted">Fale com quem convidou você. Pode ser que a festa tenha um link novo.</p>
          <Button href="/entrar" block>Tenho outro código</Button>
          <Button href="/" variant="texto">Conhecer o Revela</Button>
        </div>
      </main>
    );
  }
  if (sessionFailed || waiting) {
    const retryLabel = sessionFailed ? "Tentar de novo" : "Tentar agora";
    return (
      <main className="app-col app-col--card app-fluid">
        <div className="app-screen">
          <p className="eyebrow app-eyebrow">{event ? [event.title, formatDate(event.startAt)].join(" · ") : "Convite"}</p>
          <h1 className="titulo-tela app-h1">Muita gente entrando agora.</h1>
          <p className="corpo app-p app-muted">{sessionFailed ? "Não conseguimos abrir o convite agora. Toque em Tentar de novo." : "Tentamos de novo sozinhos em 30 segundos. Pode deixar esta tela aberta."}</p>
          {!sessionFailed && (
            <div className="app-card">
              <span className="eyebrow app-muted">Nova tentativa em</span>
              <span role="timer" aria-live="off" className="display" data-testid="nova-tentativa" style={{ fontVariantNumeric: "tabular-nums" }}>{`0:${String(secs).padStart(2, "0")}`}</span>
            </div>
          )}
          <Button variant="cta" block onClick={retryNow}>{retryLabel}</Button>
        </div>
      </main>
    );
  }
  if (data.error) {
    return (
      <main className="app-col app-col--card app-fluid">
        <div className="app-screen">
          <h1 className="titulo-tela app-h1">Não deu para abrir o convite.</h1>
          <p className="corpo app-p app-muted">Confira a internet e tente de novo.</p>
          <Button variant="cta" block onClick={() => void refreshData()}>Tentar de novo</Button>
        </div>
      </main>
    );
  }
  if (!event || data.access === "inexistente") {
    return (
      <main className="app-col app-col--card app-fluid">
        <div className="app-screen">
          <h1 className="titulo-tela app-h1">Código não confere.</h1>
          <p className="corpo app-p app-muted">{copyFor(backendMode()).inviteInvalidBody}</p>
          <Button href="/entrar" block>Tentar outro código</Button>
          <Button href="/" variant="texto">Voltar ao início</Button>
        </div>
      </main>
    );
  }


  const facts = data.event ? factsFromEvent(data.event, now()) : data.preview ? factsFromPreview(data.preview) : undefined;
  const ended = (data.preview?.status ?? (data.event ? eventStatus(data.event, now()) : "ativo")) === "encerrado";
  const meta = [formatDate(event.startAt), event.place].filter(Boolean).join(" · ");
  return (
    <EventTheme wrap={event.cameraStyle} className="app-col app-col--card app-fluid">
      <main style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <EventHeader meta={meta} name={event.title} {...brand} />
        <div className="app-screen">
          {(isHost || member) && <p className="emocao app-emocao">A visão de {event.hostName}. Agora, a sua.</p>}
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
              <p className="eyebrow app-eyebrow">Você foi convidado para fotografar</p>
              <ul className="app-convite" aria-label="Como funciona esta festa" data-testid="convite-linhas">
                {(facts ? inviteLines(facts, now()) : []).map((l) => (
                  <li key={l.head}><strong>{l.head}</strong>{l.tail ? <span className="app-muted"> {l.tail}</span> : null}</li>
                ))}
              </ul>
              <h1 className="titulo-tela app-h1">Entrar na festa</h1>
              <Field label="Como te chamam na festa?" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} error={error} />
              {!ended && <ConsentChecks terms={acceptedTerms} privacy={ackedPrivacy} onTerms={(v) => { setAcceptedTerms(v); if (v) setConsentError(undefined); }} onPrivacy={(v) => { setAckedPrivacy(v); if (v) setConsentError(undefined); }} />}
              {consentError && <p className="rv-field-erro" role="alert">{consentError}</p>}
              {!ended && <p className="app-p app-muted">Ao postar, você declara ter o direito de compartilhar a foto com as pessoas autorizadas neste evento.</p>}
              <Button type="submit" variant="primario" block disabled={busy || ended}>{busy ? "Entrando…" : "Entrar e abrir a câmera"}</Button>
              <p className="meta app-muted">Sem conta e sem baixar app.</p>
              {ended && <p className="rv-field-erro">{MESSAGES.encerrado}</p>}
            </form>
          )}

          <BackendNotice localText="Versão local: tudo fica guardado neste aparelho. Fotos de outros aparelhos só aparecem quando o servidor entrar." />
          <div style={{ marginTop: "auto" }}><Signature /></div>
        </div>
      </main>
    </EventTheme>
  );
}
