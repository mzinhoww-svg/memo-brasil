"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, CameraStage, EventTheme, GuestShell, Icon, KnownPeople, PrintBack, ShotCounter } from "@/components/revela";
import { ConvidadoCarregando } from "@/revela/screens/ConvidadoCarregando";
import { eventStatus } from "@/domain/event";
import { normalizeShareCode } from "@/domain/share-code";
import { formatDate, useEventData } from "@/features/app/hooks";
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
    const missing = false;
    return (
      <GuestShell closeHref="/" action={<Button href="/entrar#codigo" variant="primario" block>Digitar outro código</Button>}>
        <PrintBack stamp={missing ? undefined : "VENCIDO"} />
        <div className="rv-guest__center">
          <h1 className="titulo-pagina app-h1">{missing ? "Código não confere" : "Este convite não vale mais"}</h1>
          <p className="corpo app-muted" style={{ margin: 0 }}>{missing ? copyFor(backendMode()).inviteInvalidBody : "O link expirou ou foi trocado pelo anfitrião. Peça o QR novo para quem organizou a festa."}</p>
        </div>
      </GuestShell>
    );
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
  const print = { name: event.title, poses: event.shotsPerPerson, date: formatDate(event.startAt) };
  // 20f (câmera lotou) e câmera fechada: mesmo layout, câmera apagada
  if (lotada || (ended && !isHost && !member)) {
    return (
      <EventTheme wrap={event.cameraStyle}>
        <GuestShell closeHref="/" top={top} action={lotada ? <Button variant="secundario" block icon="agora" onClick={() => { setFull(false); void refreshData(); }}>Tentar de novo</Button> : <Button href="/" variant="secundario" block>Voltar ao início</Button>}>
          <CameraStage wrap={event.cameraStyle} size={640} className="rv-camera--off rv-guest__cam--lg" print={print} />
          <div className="rv-guest__center">
            <h1 className="titulo-pagina app-h1">{lotada ? "A câmera lotou" : "Esta câmera já fechou"}</h1>
            <p className="corpo app-muted" style={{ margin: 0 }}>
              {lotada
                ? `Os ${event.capacity ?? ""} lugares de ${event.title} já foram ocupados. Fale com o anfitrião, que pode abrir mais vagas.`.replace("Os  lugares", "Os lugares")
                : MESSAGES.encerrado}
            </p>
          </div>
        </GuestShell>
      </EventTheme>
    );
  }

  const inside = isHost || member;
  return (
    <EventTheme wrap={event.cameraStyle}>
      <GuestShell top={top} action={inside ? (
        <div className="app-stack-sm">
          <Button href={`/e/${code}/postar`} variant="primario" block icon="camera">Abrir câmera</Button>
          {isHost && <Button variant="secundario" href={`/painel/${data.event?.id}`} block>Abrir o painel</Button>}
        </div>
      ) : (
        <Button type="submit" form="entrar-form" variant="primario" block disabled={busy}>{busy ? "Entrando…" : <>Entrar e fotografar <Icon name="seguir" decorative size={18} /></>}</Button>
      )}>
        <CameraStage wrap={event.cameraStyle} size={640} priority print={print} className="rv-guest__cam" />
        <h1 className="rv-guest__title">{event.title}</h1>
        {event.theme?.welcomeMessage && <p className="corpo app-muted" style={{ margin: 0, textAlign: "center" }} data-testid="mensagem-evento">{event.theme.welcomeMessage}</p>}
        <div className="rv-quota">
          <ShotCounter value={event.shotsPerPerson ?? "∞"} label={event.shotsPerPerson === null ? "poses livres" : "poses suas"} />
          <p>Foi o que o anfitrião liberou para você. Ninguém vê as fotos antes da revelação.</p>
        </div>
        {inside ? (
          <h2 className="corpo app-muted" style={{ margin: 0, textAlign: "center" }}>Você está dentro, {member?.name ?? user?.name}.</h2>
        ) : (
          <form id="entrar-form" className="app-stack-sm" noValidate onSubmit={(e) => { e.preventDefault(); void enter(); }}>
            <label className="rv-inrow" data-invalid={error ? true : undefined}>
              <Icon name="voce" decorative size={20} />
              <span className="rv-sr-only">Seu nome</span>
              <input value={name} onChange={(e) => { setName(e.target.value); setError(undefined); }} placeholder="Seu nome" autoComplete="given-name" maxLength={40} aria-invalid={error ? true : undefined} aria-describedby={error ? "erro-nome" : undefined} />
            </label>
            {error && <p id="erro-nome" className="rv-field-erro" role="alert">{error}</p>}
            <label className="rv-inrow" data-invalid={emailError ? true : undefined}>
              <Icon name="email" decorative size={20} />
              <span className="rv-sr-only">E-mail (opcional)</span>
              <input type="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(undefined); }} placeholder="E-mail (opcional)" autoComplete="email" maxLength={254} aria-describedby="email-ajuda" />
            </label>
            <p id="email-ajuda" className="rv-field-ajuda">{emailError ?? "E-mail opcional. Só serve para avisar quando as fotos revelarem."}</p>
            {consentError && !askConsent && <p className="rv-field-erro" role="alert">{consentError}</p>}
          </form>
        )}
        {!user && canSwitchIdentity && <KnownPeople people={known} onPick={(id) => void switchTo(id)} />}
        <BackendNotice localText="Versão local: tudo fica guardado neste aparelho. Fotos de outros aparelhos só aparecem quando o servidor entrar." />
      </GuestShell>

      {askConsent && (
        <div className="rv-dialog" role="dialog" aria-modal="true" aria-labelledby="consent-titulo">
          <div className="rv-dialog__panel">
            <div className="rv-dialog__body">
              <h2 id="consent-titulo">Antes de fotografar</h2>
              <p>Depois da revelação, suas fotos aparecem no feed do evento, com seu nome. Os anfitriões podem esconder ou apagar qualquer foto ou comentário.</p>
              <label className="rv-check"><input type="checkbox" checked={acceptedTerms} onChange={(e) => { setAcceptedTerms(e.target.checked); setConsentError(undefined); }} /><span>Li e aceito os <Link href="/termos" target="_blank" rel="noopener">Termos de Uso</Link>.</span></label>
              <label className="rv-check"><input type="checkbox" checked={ackedPrivacy} onChange={(e) => { setAckedPrivacy(e.target.checked); setConsentError(undefined); }} /><span>Li a <Link href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</Link>.</span></label>
              <small>Você pode apagar seus dados quando quiser.</small>
              {consentError && <p className="rv-field-erro" role="alert">{consentError}</p>}
            </div>
            <div className="rv-dialog__actions">
              <button type="button" onClick={() => setAskConsent(false)}>Agora não</button>
              <button type="button" className="go" onClick={() => { if (!acceptedTerms || !ackedPrivacy) { setConsentError(CONSENT_REQUIRED); return; } setAskConsent(false); void enter(); }}>Aceitar</button>
            </div>
          </div>
        </div>
      )}
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
