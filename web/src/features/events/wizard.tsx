"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Breadcrumbs, Button, GoogleButton } from "@/components/revela";
import { DEFAULT_FILM, DEFAULT_WRAP, WRAP_INFO, type EventCategory, type FilmLook, type Wrap } from "@/domain/options";
import { useApp } from "@/features/app/provider";
import { CONSENT_FAILED, CONSENT_REQUIRED, ConsentChecks } from "@/features/consent/ConsentCheck";
import { currentConsent, recordConsent } from "@/lib/consent";
import { createEvent } from "./service";
import { REVEAL_ERROR_TEXT, resolveReveal } from "./reveal-input";
import { buildRevealInput, type RevealChoice } from "./reveal-choice";
import { WINDOW_ERROR_TEXT, REVEAL_BEFORE_END_TEXT, defaultWindow, longDay, noticeLine, resolveWindow, revealOptions, shortWhen, type WindowInput } from "./wizard-time";
import { useOpen } from "@/lib/motion/use-motion";
import { WizardDirection } from "@/revela/wizard-motion";
import { CameraEmbalagem } from "@/revela/screens/CameraEmbalagem";
import { CameraNome } from "@/revela/screens/CameraNome";
import { CameraFiltro } from "@/revela/screens/CameraFiltro";
import { CameraPrivacidade } from "@/revela/screens/CameraPrivacidade";
import { CameraData } from "@/revela/screens/CameraData";
import { CameraPoses, type PoseChoice } from "@/revela/screens/CameraPoses";
import { CameraRevelacao, type RevealChoiceView } from "@/revela/screens/CameraRevelacao";
import { CameraPublicar, type PlanView } from "@/revela/screens/CameraPublicar";
import { hostFallbackName, suggestEventNames } from "./name-suggestions";
import { clearPendingCode, planForShots, readPendingCode } from "./plan-catalog";
import { afterCreateDestination, type AfterCreate } from "./after-create";
import { goToCheckout } from "@/features/billing/checkout-nav";
import { CodeApplied, REDEEM_TEXT, RedeemCode, redeemMessage } from "@/features/billing/RedeemCode";
import { formatBRL, listPublicPlans, redeemCode } from "@/features/billing/api";
import type { PublicPlan } from "@/features/billing/types";
import { buildCreateInput, WIZARD_DEFAULTS } from "./wizard-input";
import { defaultTimezone, zonedToEpoch, zoneLabel, type RevealErrors } from "@/domain/reveal";

export { WIZARD_DEFAULTS };

/** Os 8 passos de "Monte a câmera": embalagem, nome, quando é a festa, poses, revelação, filme, quem vê, plano. */
const STEP_COUNT = 8;
const LAST_STEP = STEP_COUNT - 1;
/** Opções de poses do desenho; a legenda de cada uma vem do catálogo (plano que a comporta). */
const POSE_OPTIONS = [10, 24, 27, 36];
type CreatedEvent = { eventId: string; title: string; paid: boolean; destination: AfterCreate; ready: boolean };

/** "Antes de criar": folha centrada com o fundo e a entrada do kit. */
function ConsentDialog({ terms, privacy, onTerms, onPrivacy, onAccept, onCancel }: { terms: boolean; privacy: boolean; onTerms: (v: boolean) => void; onPrivacy: (v: boolean) => void; onAccept: () => void; onCancel: () => void }) {
  const open = useOpen();
  return (
    <div className="rv-dialog rv-backdrop" data-open={open} role="dialog" aria-modal="true" aria-labelledby="consent-h">
      <div className="rv-dialog__panel rv-sheet-motion" data-open={open}>
        <div className="rv-dialog__body">
          <h2 id="consent-h">Antes de criar</h2>
          <ConsentChecks terms={terms} privacy={privacy} onTerms={onTerms} onPrivacy={onPrivacy} />
          <Button block disabled={!terms || !privacy} onClick={onAccept}>Aceitar</Button>
          <Button variant="texto" block onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

export function CreateWizard() {
  const router = useRouter();
  const { repos, user, signIn, now, ready, backend, canCreate, signInWithGoogle } = useApp();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"next" | "back">();
  const [wrap, setWrap] = useState<Wrap>(DEFAULT_WRAP);
  const [film, setFilm] = useState<FilmLook>(DEFAULT_FILM);
  const [everyoneSeesAll, setEveryoneSeesAll] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [ackedPrivacy, setAckedPrivacy] = useState(false);
  const [title, setTitle] = useState("");
  // o tipo do evento sai da embalagem escolhida (o desenho não pergunta o tipo): casamento → casamento, as outras → festa
  const category: EventCategory = wrap === "casamento" ? "casamento" : "festa";
  const [downloadHigh, setDownloadHigh] = useState(true); // "Permitir baixar em alta": grava events.guest_download_high
  const [timezone] = useState(defaultTimezone);
  const [win, setWin] = useState<WindowInput>(() => defaultWindow(now(), defaultTimezone()));
  const [choice, setChoice] = useState<RevealChoice>("manha");
  const [revCustom, setRevCustom] = useState(""); // aaaa-mm-ddTHH:MM no fuso do evento
  const [planTouched, setPlanTouched] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [rollOn, setRollOn] = useState(true);
  const [desiredShots, setDesiredShots] = useState<number>(WIZARD_DEFAULTS.shots);
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [planCode, setPlanCode] = useState("gratis");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [codeOutcome, setCodeOutcome] = useState<{ eventId: string; eventTitle: string; code: string; applied: PublicPlan | null | "sem-plano"; error?: string } | null>(null);
  const [errors, setErrors] = useState<{ title?: string; termino?: string; reveal?: string; create?: string }>({});
  const [revealErrors, setRevealErrors] = useState<RevealErrors | undefined>();
  const [busy, setBusy] = useState(false);
  const creating = useRef(false);
  const createdResult = useRef<CreatedEvent | null>(null);
  const [created, setCreated] = useState<CreatedEvent | null>(null);
  const [handoffError, setHandoffError] = useState<string>();
  const navigating = useRef(false);

  function retainCreated(result: CreatedEvent) {
    createdResult.current = result;
    setCreated(result);
  }

  function recoverHandoff() {
    const result = createdResult.current;
    if (!result) return false;
    retainCreated({ ...result, ready: true });
    setHandoffError("Seu evento já foi criado. Não conseguimos abrir a próxima página. Tente continuar novamente.");
    return true;
  }

  function continueCreated() {
    const result = createdResult.current;
    if (!result?.ready || navigating.current) return;
    navigating.current = true;
    setBusy(true);
    setHandoffError(undefined);
    try {
      if (result.destination.kind === "checkout") goToCheckout(result.destination.url);
      else router.push(result.destination.href);
    } catch {
      recoverHandoff();
    } finally {
      navigating.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setPendingCode(readPendingCode());
      void Promise.all([listPublicPlans()]).then(([p]) => { setPlans(p); }, () => setPlans([]));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // o nome de quem organiza vem da conta Google (editável depois no painel); padrão seguro quando vazio
  const hostName = hostFallbackName(user?.name);
  const windowNow = resolveWindow(win, now());
  // fim da festa (instante); sem janela válida, mantém um fim razoável só para os rótulos
  const endMs = () => (windowNow.ok ? windowNow.endMs : now() + 6 * 3_600_000);
  const [customDate, customTime] = revCustom.split("T");
  const revealInput = () => buildRevealInput(choice, endMs(), { date: customDate ?? "", time: customTime ?? "", timezone });

  function next() {
    const e: typeof errors = {};
    if (step === 1 && !title.trim()) e.title = "Escolha o nome do evento. Todos os convidados vão ver.";
    if (step === 2 && !windowNow.ok) e.termino = WINDOW_ERROR_TEXT[windowNow.error];
    if (step === 3) {
      const r = resolveReveal(revealInput(), endMs(), now());
      setRevealErrors(r.ok ? undefined : r.errors);
      if (!r.ok) return setErrors(e);
      if (r.enabled && r.at < endMs()) return setErrors({ ...e, reveal: REVEAL_BEFORE_END_TEXT });
    }
    setErrors(e);
    if (Object.keys(e).length === 0) { setDir("next"); setStep((x) => Math.min(LAST_STEP, x + 1)); }
  }

  async function create() {
    if (!acceptedTerms || !ackedPrivacy) return setErrors({ create: CONSENT_REQUIRED });
    if (creating.current || createdResult.current) return;
    const w = resolveWindow(win, now());
    if (!w.ok) {
      setStep(2);
      return setErrors({ termino: WINDOW_ERROR_TEXT[w.error] });
    }
    creating.current = true;
    setBusy(true);
    setErrors({});
    try {
      const me = await signIn(hostName);
      if (backend === "supabase") {
        try { await recordConsent(currentConsent("organizador", null, { termsAccepted: acceptedTerms, privacyAcknowledged: ackedPrivacy })); } catch { return setErrors({ create: CONSENT_FAILED }); }
      }
      const startNow = now();
      const hoursNow = (w.endMs - startNow) / 3_600_000;
      const input = buildCreateInput({ title, category, durationHours: hoursNow, reveal: buildRevealInput(choice, w.endMs, { date: customDate ?? "", time: customTime ?? "", timezone }), desiredShots, cameraStyle: wrap, filmLook: film, everyoneSeesAll, downloadHigh });
      const r = await createEvent(repos, me, input, startNow);
      if (!r.ok) {
        if (r.errors.reveal) {
          setRevealErrors(r.errors.reveal);
          setStep(3);
        }
        return setErrors({ create: "Não deu para criar o evento. Confira os campos e tente de novo." });
      }
      const chosen = plans?.find((p) => p.code === planCodeEff);
      const eventId = r.event.id;
      const paid = !!chosen && !chosen.isFree;
      // A identidade salva é terminal: retomar a saída nunca repete a criação ou o pedido.
      const result: CreatedEvent = {
        eventId, title: r.event.title, paid, ready: !paid,
        destination: { kind: "plan", href: paid ? `/painel/${eventId}/plano?plano=${encodeURIComponent(chosen.code)}` : `/criar/pronto/${eventId}` },
      };
      retainCreated(result);
      if (pendingCode) {
        // o evento já existe: o código nunca impede a criação; a recusa aparece em B8, com mensagem neutra
        clearPendingCode();
        let outcome: NonNullable<typeof codeOutcome>;
        try {
          const red = await redeemCode(eventId, pendingCode);
          outcome = red.applied && red.reason === "ok"
            ? { eventId, eventTitle: r.event.title, code: pendingCode, applied: plans?.find((p) => p.code === red.planCode) ?? "sem-plano" }
            : { eventId, eventTitle: r.event.title, code: pendingCode, applied: null, error: red.reason === "ok" ? undefined : redeemMessage(red.reason) };
        } catch {
          outcome = { eventId, eventTitle: r.event.title, code: pendingCode, applied: null, error: REDEEM_TEXT.falha };
        }
        return setCodeOutcome(outcome);
      }
      if (chosen && !chosen.isFree) {
        // plano pago escolhido: encaminha ao checkout do provedor vigente
        const dest = await afterCreateDestination(eventId, chosen.code);
        retainCreated({ ...result, destination: dest, ready: true });
      }
      continueCreated();
    } catch {
      if (!recoverHandoff()) setErrors({ create: "Não deu para criar o evento. Confira sua conexão e tente de novo." });
    } finally {
      if (!createdResult.current) creating.current = false;
      setBusy(false);
    }
  }

  const catalog = plans ?? [];
  const shotsPlan = planForShots(catalog, desiredShots);
  // pré-seleção do plano: o mais barato que comporta as poses escolhidas, até a pessoa tocar em outro
  const planCodeEff = planTouched ? planCode : (shotsPlan?.code ?? catalog.find((p) => p.isFree)?.code ?? planCode);
  const chosenPlan = catalog.find((p) => p.code === planCodeEff);
  const tz = timezone;
  const cityLabel = zoneLabel(tz).split(" (")[0].replace(/^.*\//, "").replace(/_/g, " ");
  const money = (cents: number) => (cents % 100 === 0 ? `R$ ${cents / 100}` : formatBRL(cents));
  const options = revealOptions(endMs(), tz);
  const customAt = customDate && customTime ? zonedToEpoch(customDate, customTime, tz) : NaN;
  const revealAtMs = choice === "dia" ? customAt : options.find((o) => o.id === choice)?.at;
  const poseChoices: PoseChoice[] = POSE_OPTIONS.map((n) => {
    const need = planForShots(catalog, n);
    return { n, caption: need ? `exige ${need.name}` : "Grátis" };
  });
  const planViews: PlanView[] = catalog.map((p, i) => ({
    code: p.code, tier: p.name, price: p.isFree ? "Grátis" : money(p.priceCents),
    lines: [p.maxGuests === null ? "convidados sem limite" : `${p.maxGuests} convidados`, p.maxShots === null ? "poses livres" : `${p.maxShots} poses cada`],
    gold: !p.isFree && i === catalog.length - 1 && catalog.length > 2,
  }));
  const revealChoiceViews: RevealChoiceView[] = options.map((o) => ({ id: o.id, label: o.label, small: o.at !== undefined ? shortWhen(o.at, tz) : (choice === "dia" && Number.isFinite(customAt) ? shortWhen(customAt, tz) : " ") }));
  const wrapLabelUi = WRAP_INFO[wrap].label;

  if (!ready) return <p className="app-screen app-muted">Carregando…</p>;

  if (codeOutcome) {
    const { eventId, eventTitle, code, applied, error } = codeOutcome;
    return (
      <div className="app-screen plano-pagina">
        {applied ? (
          <CodeApplied plan={applied === "sem-plano" ? undefined : applied} code={code} eventTitle={eventTitle} backHref={`/painel/${eventId}`} printHref={`/painel/${eventId}/qr`} />
        ) : (
          <div className="app-stack">
            <h1 className="titulo-tela app-h1">Evento criado. O código não foi aplicado.</h1>
            <p className="app-p app-muted">O seu evento está no ar, no plano Grátis. Você pode tentar o código de novo agora ou depois, no plano.</p>
            <RedeemCode eventId={eventId} initialValue={code} initialError={error} onApplied={(r) => setCodeOutcome({ eventId, eventTitle, code: r.code, applied: plans?.find((p) => p.code === r.planCode) ?? "sem-plano" })} />
          </div>
        )}
        <Button href={`/criar/pronto/${eventId}`} variant={applied ? "secundario" : "primario"} block>Ver o convite e o QR</Button>
      </div>
    );
  }

  if (created) return (
    <div className="app-screen app-stack">
      <h1 className="titulo-tela app-h1">Evento criado.</h1>
      <p className="app-p">{created.title} já está salvo. Se a próxima página não abrir, continue por aqui.</p>
      {handoffError && <p className="rv-field-erro" role="alert">{handoffError}</p>}
      <Button block disabled={busy || !created.ready} aria-busy={busy} onClick={continueCreated}>{busy ? "Preparando a próxima página…" : created.paid ? "Continuar para o pagamento" : "Continuar para o convite"}</Button>
      {created.paid && <Button href={`/criar/pronto/${created.eventId}`} variant="secundario" block>Ver o convite e o QR</Button>}
      <Button href="/eventos" variant="texto">Meus eventos</Button>
    </div>
  );

  // na nuvem só o organizador com conta cria evento (RLS recusa convidado anônimo); a entrada é pelo Google
  if (ready && backend === "supabase" && !canCreate) {
    return (
      <div className="app-screen">
        <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Criar evento" }]} />
        <h1 className="titulo-tela app-h1">Entre para criar o seu evento.</h1>
        <p className="corpo app-p app-muted">Quem organiza usa uma conta Google. Convidados entram só com o código, sem conta.</p>
        <GoogleButton block onClick={() => void signInWithGoogle("/criar")} />
      </div>
    );
  }

  const back = () => { setDir("back"); setStep((x) => Math.max(0, x - 1)); };
  const renderStep = () => {
    if (step === 0) return <CameraEmbalagem wrap={wrap} busy={busy} onPick={setWrap} onNext={next} onBack={() => router.push("/")} />;
    if (step === 1) {
      return (
        <CameraNome
          wrap={wrap} name={title} error={errors.title} busy={busy} keyboard={false}
          suggestions={suggestEventNames(category, user?.name ?? "", now())}
          onName={(v) => { setTitle(v); setErrors((x) => ({ ...x, title: undefined })); }}
          onSuggest={(v) => { setTitle(v); setErrors((x) => ({ ...x, title: undefined })); }}
          onBack={back} onNext={next}
        />
      );
    }
    if (step === 2) {
      const w = windowNow.ok ? windowNow : undefined;
      return (
        <CameraData
          date={win.date} start={win.start} end={win.end} cityLabel={cityLabel} busy={busy} error={errors.termino}
          dayLabel={Number.isFinite(zonedToEpoch(win.date, win.start, tz)) ? longDay(zonedToEpoch(win.date, win.start, tz), tz, true) : "Escolha o dia"}
          endLabel={w ? `${win.end} · ${longDay(w.endMs, tz)}` : win.end}
          minDate={defaultWindow(now(), tz).date}
          onDate={(v) => { setWin((x) => ({ ...x, date: v })); setErrors((x) => ({ ...x, termino: undefined })); }}
          onStart={(v) => { setWin((x) => ({ ...x, start: v })); setErrors((x) => ({ ...x, termino: undefined })); }}
          onEnd={(v) => { setWin((x) => ({ ...x, end: v })); setErrors((x) => ({ ...x, termino: undefined })); }}
          onBack={back} onNext={next}
        />
      );
    }
    if (step === 3) {
      const rErr = errors.reveal ?? (revealErrors?.data ? REVEAL_ERROR_TEXT[revealErrors.data] : undefined);
      return (
        <CameraRevelacao
          step={4}
          startLabel={shortWhen(windowNow.ok ? windowNow.startMs : now(), tz)} endLabel={shortWhen(endMs(), tz)}
          revealLabel={revealAtMs !== undefined && Number.isFinite(revealAtMs) ? shortWhen(revealAtMs, tz) : "—"}
          choices={revealChoiceViews} value={choice} error={rErr} busy={busy} custom={revCustom} customMin={`${defaultWindow(now(), tz).date}T00:00`}
          notice={revealAtMs !== undefined && Number.isFinite(revealAtMs) ? `Todo mundo recebe o aviso ${/^(sábado|domingo)/.test(longDay(revealAtMs, tz)) ? "no" : "na"} ${noticeLine(revealAtMs, tz)}.` : "Escolha o dia e a hora da revelação."}
          onPick={(id) => { setChoice(id as RevealChoice); setRevealErrors(undefined); setErrors((x) => ({ ...x, reveal: undefined })); }}
          onCustom={(v) => { setRevCustom(v); setRevealErrors(undefined); setErrors((x) => ({ ...x, reveal: undefined })); }}
          onBack={back} onNext={next}
        />
      );
    }
    if (step === 4) {
      return <CameraPoses step={5} value={desiredShots} choices={poseChoices} roll={rollOn} onPick={setDesiredShots} onRoll={setRollOn} onBack={back} onNext={next} busy={busy} />;
    }
    if (step === 5) return <CameraFiltro samples={{ filme35: "/revela/lut/amostra-bolo-filme35.jpg" }} film={film} busy={busy} onPick={setFilm} onBack={back} onNext={next} />;
    if (step === 6) return <CameraPrivacidade showDownload feed={everyoneSeesAll} download={downloadHigh} busy={busy} onFeed={setEveryoneSeesAll} onDownload={setDownloadHigh} onBack={back} onNext={next} />;
    if (step === 7) {
      const revealShort = revealAtMs !== undefined && Number.isFinite(revealAtMs) ? shortWhen(revealAtMs, tz).replace(" ", ", ") : "—";
      const cta = busy ? "Criando câmera…" : chosenPlan && !chosenPlan.isFree ? `Continuar · ${money(chosenPlan.priceCents)}` : "Criar câmera";
      return (
        <>
          <CameraPublicar
            image={`/revela/3d/cam-${wrap}-640.webp`} wrapLabel={wrapLabelUi} posesLabel={`${desiredShots} por pessoa`} revealLabel={revealShort}
            plans={planViews.length ? planViews : undefined} selected={chosenPlan?.code ?? "gratis"} next={cta} busy={busy} error={errors.create}
            onSelect={(c) => { setPlanCode(c); setPlanTouched(true); }} onBack={back}
            onNext={() => { if (acceptedTerms && ackedPrivacy) void create(); else setConsentOpen(true); }}
          />
          {consentOpen && (
            <ConsentDialog terms={acceptedTerms} privacy={ackedPrivacy} onTerms={setAcceptedTerms} onPrivacy={setAckedPrivacy} onAccept={() => { setConsentOpen(false); void create(); }} onCancel={() => setConsentOpen(false)} />
          )}
        </>
      );
    }
  };
  return <WizardDirection.Provider value={dir}>{renderStep()}</WizardDirection.Provider>;
}
