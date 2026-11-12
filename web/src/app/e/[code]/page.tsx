"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, CameraStage, EventTheme, GuestShell, Icon, KnownPeople, ShotCounter } from "@/components/revela";
import { ConvidadoConsentimento } from "@/revela/screens/ConvidadoConsentimento";
import { ConvidadoEntrar } from "@/revela/screens/ConvidadoEntrar";
import { ConvidadoInvalido } from "@/revela/screens/ConvidadoInvalido";
import { ConvidadoLotado } from "@/revela/screens/ConvidadoLotado";
import { wrapOf } from "@/domain/options";
import { ConvidadoCarregando } from "@/revela/screens/ConvidadoCarregando";
import { eventStatus } from "@/domain/event";
import { normalizeShareCode } from "@/domain/share-code";
import { formatDate, prefetchEventData, useEventData } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { tableFromSearch } from "@/features/invitations/links";
import { joinEvent } from "@/features/participants/service";
import { BackendNotice } from "@/features/app/backend-notice";
import { CONSENT_FAILED, CONSENT_REQUIRED } from "@/features/consent/ConsentCheck";
import { EMAIL_RE, saveGuestEmail } from "@/features/participants/guest-email";
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
  const [askConsent, setAskConsent] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [full, setFull] = useState(false);
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
    const trimmed = name.trim();
    if (!trimmed) {
      setError(MESSAGES.nome);
      document.querySelector<HTMLInputElement>('input[autocomplete="given-name"]')?.focus();
      return;
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) { setEmailError("Confira o e-mail ou deixe em branco."); return; }
    if (!acceptedTerms || !ackedPrivacy) { setAskConsent(true); return; }
    setConsentError(undefined);
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
        if (r.reason === "lotado") { setFull(true); return; }
        setError(r.reason === "codigo" ? copyFor(backendMode()).inviteInvalid : MESSAGES[r.reason]);
        return;
      }
      if (email.trim()) await saveGuestEmail(r.event.id, email);
      // lê a festa já como membro antes de ir para a câmera: ela abre sem a tela de carregando (se falhar, ela mesma lê)
      await prefetchEventData(repos, { code }, me.id, now()).catch(() => undefined);
      router.push(`/e/${code}/postar`);
    } catch {
      setError(MESSAGES.rede);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { enterRef.current = enter; });

  const dateStamp = event ? stampDate(event.startAt) : undefined;
  const top = dateStamp ? <span className="rv-stamp">{dateStamp}</span> : undefined;

  // 20g · Carregando a festa: a câmera do evento com o nome, assim que o convite chega
  if (!ready || data.loading) return <main role="status" aria-label="Carregando a festa"><ConvidadoCarregando name={event?.title ?? null} wrap={event?.cameraStyle} /></main>;
  // 20h: o código não abre nenhuma festa — volta para a tela do código, em vermelho
  if (!inactive && data.error !== "forbidden" && !data.error && !sessionFailed && !waiting && (!event || data.access === "inexistente")) {
    router.replace(`/entrar?erro=${encodeURIComponent(code)}`);
    return <main role="status" aria-label="Carregando a festa"><ConvidadoCarregando name={null} /></main>;
  }
  // 20e: convite vencido ou trocado
  if (inactive || data.error === "forbidden") {
    return <main><ConvidadoInvalido closeHref="/" actionHref="/entrar#codigo" /></main>;
  }
  if (sessionFailed || waiting) {
    return (
      <GuestShell closeHref="/" top={top} action={<Button variant="secundario" block icon="agora" onClick={retryNow}>{sessionFailed ? "Tentar de novo" : "Tentar agora"}</Button>}>
        <CameraStage wrap={event?.cameraStyle} size={640} className="rv-camera--off" print={{ name: event?.title, poses: event?.shotsPerPerson }} />
        <div className="rv-guest__center">
          <h1 className="titulo-pagina app-h1">Muita gente entrando agora</h1>
          <p className="corpo app-muted" style={{ margin: 0 }}>{sessionFailed ? "Não conseguimos abrir o convite agora. Toque em Tentar de novo." : "Tentamos de novo sozinhos em 30 segundos. Pode deixar esta tela aberta."}</p>
          {!sessionFailed && <ShotCounter value={`0:${String(secs).padStart(2, "0")}`} label="nova tentativa" />}
          {!sessionFailed && <span role="timer" aria-live="off" className="rv-sr-only" data-testid="nova-tentativa">{`0:${String(secs).padStart(2, "0")}`}</span>}
        </div>
      </GuestShell>
    );
  }
  if (data.error || !event) {
    return (
      <GuestShell closeHref="/" action={<Button variant="primario" block onClick={() => void refreshData()}>Tentar de novo</Button>}>
        <div className="rv-guest__center" style={{ marginTop: "auto", marginBottom: "auto" }}>
          <Icon name="sem-sinal" decorative size={40} />
          <h1 className="titulo-pagina app-h1">Não deu para abrir o convite</h1>
          <p className="corpo app-muted" style={{ margin: 0 }}>Confira a internet e tente de novo.</p>
        </div>
      </GuestShell>
    );
  }

  const ended = (data.preview?.status ?? (data.event ? eventStatus(data.event, now()) : "ativo")) === "encerrado";
  const lotada = !isHost && !member && (full || data.preview?.full === true);
  // 20f (câmera lotou) e câmera fechada: mesma tela
  if (lotada || (ended && !isHost && !member)) {
    return (
      <EventTheme wrap={event.cameraStyle}>
        <main>
          <ConvidadoLotado
            title={event.title}
            wrap={event.cameraStyle}
            stamp={dateStamp ?? ""}
            poses={event.shotsPerPerson}
            closed={!lotada}
            body={lotada ? `Os ${event.capacity ?? ""} lugares de ${event.title} já foram ocupados. Fale com o anfitrião, que pode abrir mais vagas.`.replace("Os  lugares", "Os lugares") : MESSAGES.encerrado}
            closeHref="/"
            onRetry={() => { setFull(false); void refreshData(); }}
          />
        </main>
      </EventTheme>
    );
  }

  const inside = isHost || member;
  // 20d: Antes de fotografar (aceite dos Termos e da Política), sobre a câmera
  if (askConsent && !inside) {
    return (
      <EventTheme wrap={event.cameraStyle}>
        <main>
          <ConvidadoConsentimento
            title={event.title}
            wrap={wrapOf(event.cameraStyle)}
            left={event.shotsPerPerson}
            checked={[acceptedTerms, ackedPrivacy]}
            onCheck={(i, v) => { if (i === 0) setAcceptedTerms(v); else setAckedPrivacy(v); setConsentError(undefined); }}
            error={consentError}
            onLater={() => setAskConsent(false)}
            onAccept={() => { if (!acceptedTerms || !ackedPrivacy) { setConsentError(CONSENT_REQUIRED); return; } setAskConsent(false); void enter(); }}
          />
        </main>
      </EventTheme>
    );
  }

  // 20b: Entrar no evento
  return (
    <EventTheme wrap={event.cameraStyle}>
      <main>
        <ConvidadoEntrar
          title={event.title}
          wrap={event.cameraStyle}
          stamp={dateStamp ?? ""}
          printDate={formatDate(event.startAt)}
          poses={event.shotsPerPerson}
          welcome={event.theme?.welcomeMessage}
          name={name}
          email={email}
          nameError={error}
          emailError={emailError}
          busy={busy}
          inside={inside ? (member?.name ?? user?.name ?? "") : undefined}
          cta={inside ? (
            <div className="stack">
              <Link href={`/e/${code}/postar`} className="rv-btn rv-btn--block rv-btn--primary"><Icon name="camera" decorative size={20} />Abrir câmera</Link>
              {isHost && <Link href={`/painel/${data.event?.id}`} className="rv-btn rv-btn--block">Abrir o painel</Link>}
            </div>
          ) : undefined}
          extra={<>
            {consentError && <p className="rv-field-erro" role="alert">{consentError}</p>}
            {!user && canSwitchIdentity && <KnownPeople people={known} onPick={(id) => void switchTo(id)} />}
            <BackendNotice localText="Versão local: tudo fica guardado neste aparelho. Fotos de outros aparelhos só aparecem quando o servidor entrar." />
          </>}
          onName={(v) => { setName(v); setError(undefined); }}
          onEmail={(v) => { setEmail(v); setEmailError(undefined); }}
          onSubmit={() => void enter()}
        />
      </main>
    </EventTheme>
  );
}

const WEEK = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
/** Carimbo de data da câmera: "SÁB 14 MAR 2027". */
function stampDate(ts: number): string {
  const d = new Date(ts);
  return `${WEEK[d.getDay()]} ${String(d.getDate()).padStart(2, "0")} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}
