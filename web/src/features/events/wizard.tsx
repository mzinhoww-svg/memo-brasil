"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Breadcrumbs, Button, CameraStage, Chip, Chips, Field, GoogleButton, Icon, OptionGroup, Select, ShotCounter, ToggleRow, WrapPicker } from "@/components/revela";
import { CATEGORY_LABEL, DEFAULT_FILM, DEFAULT_WRAP, FILM_LABEL, MIN_DURATION_HOURS, WRAP_INFO, type EventCategory, type FilmLook, type Wrap } from "@/domain/options";
import { useApp } from "@/features/app/provider";
import { CONSENT_FAILED, CONSENT_REQUIRED, ConsentChecks } from "@/features/consent/ConsentCheck";
import { currentConsent, recordConsent } from "@/lib/consent";
import { createEvent } from "./service";
import { resolveDuration } from "./duration";
import { REVEAL_ERROR_TEXT, resolveReveal } from "./reveal-input";
import { REVEAL_CHOICES, buildRevealInput, type RevealChoice } from "./reveal-choice";
import { hostFallbackName, suggestEventNames } from "./name-suggestions";
import { clearPendingCode, freeShots, hasPaidPlans, planForShots, readPendingCode } from "./plan-catalog";
import { PAID_PLAN_LINE, PlanStep } from "./PlanStep";
import { afterCreateDestination, type AfterCreate } from "./after-create";
import { goToCheckout } from "@/features/billing/checkout-nav";
import { CodeApplied, REDEEM_TEXT, RedeemCode, redeemMessage } from "@/features/billing/RedeemCode";
import { formatBRL, getPublicSettings, listPublicPlans, redeemCode } from "@/features/billing/api";
import type { PublicPlan, PublicSettings } from "@/features/billing/types";
import { buildCreateInput, WIZARD_DEFAULTS } from "./wizard-input";
import { TIMEZONES, defaultTimezone, formatInZone, zoneLabel, type RevealErrors } from "@/domain/reveal";

export { WIZARD_DEFAULTS };

/** Os 8 passos de "Monte a câmera". Cada um tem título, apoio e o que mostra; o contador "n/8" é o visor da câmera. */
const STEPS = [
  { key: "embalagem", title: "Escolha a embalagem", hint: "É a cara da câmera: aparece no convite, no QR e na tela de cada convidado." },
  { key: "nome", title: "Nome impresso", hint: "O que sai impresso na câmera e que todos os convidados vão ver." },
  { key: "ate-quando", title: "Até quando vale?", hint: "Depois desse horário ninguém tira mais fotos." },
  { key: "poses", title: "Quantas poses?", hint: "Cada convidado tem um filme. Quanto menos poses, mais cada uma vale." },
  { key: "revelar", title: "Quando revelar?", hint: "As fotos ficam no escuro até a revelação. Aí aparecem para todos, juntas." },
  { key: "filme", title: "Qual filme?", hint: "O filme é aplicado em todas as fotos." },
  { key: "quem-ve", title: "Quem vê o quê", hint: "Você vê tudo e pode tirar qualquer foto antes da revelação." },
  { key: "plano", title: "Escolha o plano", hint: "Pague uma vez por evento. Sem assinatura." },
] as const;
const LAST_STEP = STEPS.length - 1;
const DURATIONS = [1, 3, 6, 12, 24, 48];
const SHOTS_FALLBACK = [10, 24, 36];
const OTHER_DATE = -1;
type CreatedEvent = { eventId: string; title: string; paid: boolean; destination: AfterCreate; ready: boolean };

const toLocalInput = (ts: number) => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

export function CreateWizard() {
  const router = useRouter();
  const { repos, user, signIn, now, ready, backend, canCreate, signInWithGoogle } = useApp();
  const [step, setStep] = useState(0);
  const [wrap, setWrap] = useState<Wrap>(DEFAULT_WRAP);
  const [film, setFilm] = useState<FilmLook>(DEFAULT_FILM);
  const [everyoneSeesAll, setEveryoneSeesAll] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [ackedPrivacy, setAckedPrivacy] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>("casamento");
  const [hours, setHours] = useState<number>(6);
  const [until, setUntil] = useState("");
  const [otherDate, setOtherDate] = useState(false);
  const [choice, setChoice] = useState<RevealChoice>("manha");
  const [revDate, setRevDate] = useState("");
  const [revTime, setRevTime] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [desiredShots, setDesiredShots] = useState<number>(WIZARD_DEFAULTS.shots);
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [planCode, setPlanCode] = useState("gratis");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [codeOutcome, setCodeOutcome] = useState<{ eventId: string; eventTitle: string; code: string; applied: PublicPlan | null | "sem-plano"; error?: string } | null>(null);
  const [errors, setErrors] = useState<{ title?: string; termino?: string; create?: string }>({});
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
      void Promise.all([listPublicPlans(), getPublicSettings()]).then(([p, st]) => { setPlans(p); setSettings(st); }, () => setPlans([]));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // o nome de quem organiza vem da conta Google (editável depois no painel); padrão seguro quando vazio
  const hostName = hostFallbackName(user?.name);
  const untilMs = until ? new Date(until).getTime() : undefined;
  const durationHours = () => resolveDuration({ untilMs: otherDate ? untilMs : undefined, presetHours: hours }, now());
  const endMs = () => now() + durationHours() * 3_600_000;
  const revealInput = () => buildRevealInput(choice, endMs(), { date: revDate, time: revTime, timezone });

  function next() {
    const e: typeof errors = {};
    if (step === 1 && !title.trim()) e.title = "Escolha o nome do evento. Todos os convidados vão ver.";
    if (step === 2) {
      if (otherDate && (untilMs === undefined || !Number.isFinite(untilMs))) e.termino = "Escolha a data e o horário para o fim da festa.";
      else if (!Number.isFinite(durationHours()) || durationHours() < MIN_DURATION_HOURS) e.termino = "Escolha um horário no futuro, pelo menos 30 minutos a partir de agora.";
    }
    if (step === 4) {
      const r = resolveReveal(revealInput(), endMs(), now());
      setRevealErrors(r.ok ? undefined : r.errors);
      if (!r.ok) return setErrors(e);
    }
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((x) => Math.min(LAST_STEP, x + 1));
  }

  async function create() {
    if (!acceptedTerms || !ackedPrivacy) return setErrors({ create: CONSENT_REQUIRED });
    if (creating.current || createdResult.current) return;
    if (otherDate && (untilMs === undefined || !Number.isFinite(untilMs))) {
      setStep(2);
      return setErrors({ termino: "Escolha a data e o horário para o fim da festa." });
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
      const hoursNow = resolveDuration({ untilMs: otherDate ? untilMs : undefined, presetHours: hours }, startNow);
      const input = buildCreateInput({ title, category, durationHours: hoursNow, reveal: buildRevealInput(choice, startNow + hoursNow * 3_600_000, { date: revDate, time: revTime, timezone }), desiredShots, cameraStyle: wrap, filmLook: film, everyoneSeesAll });
      const r = await createEvent(repos, me, input, startNow);
      if (!r.ok) {
        if (r.errors.reveal) {
          setRevealErrors(r.errors.reveal);
          setStep(4);
        }
        return setErrors({ create: "Não deu para criar o evento. Confira os campos e tente de novo." });
      }
      const chosen = plans?.find((p) => p.code === planCode);
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

  const resolved = step === 4 ? resolveReveal(revealInput(), endMs(), now()) : undefined;
  const revealWhen = resolved?.ok && resolved.enabled ? formatInZone(resolved.at, resolved.timezone) : undefined;
  const eventName = title.trim() || "sua festa";
  const catalog = plans ?? [];
  const shotsPlan = planForShots(catalog, desiredShots);
  const freeShotsLimit = freeShots(catalog);
  const chosenPlan = catalog.find((p) => p.code === planCode);
  // opções de poses vêm do catálogo (limites de cada plano); sem catálogo, o padrão
  const shotsChoices = (() => {
    const set = new Set<number>(catalog.flatMap((p) => (p.maxShots === null ? [] : [p.maxShots])));
    return (set.size ? [...set] : SHOTS_FALLBACK).sort((x, y) => x - y);
  })();

  if (!ready) return <p className="app-screen app-muted">Carregando…</p>;
  const last = step === LAST_STEP;

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

  const info = STEPS[step];
  const ctaLabel = busy ? "Criando câmera…" : last ? (chosenPlan && !chosenPlan.isFree ? `Continuar · ${formatBRL(chosenPlan.priceCents)}` : "Criar câmera") : "Próximo";
  return (
    <div className="rv-wiz">
      <header className="rv-wiz__head">
        <div className="rv-wiz__top">
          <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Montar câmera" }]} />
          <span className="rv-stamp" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>{step + 1}/{STEPS.length}</span>
        </div>
        <h1 className="titulo-tela app-h1" id="wiz-titulo">{info.title}</h1>
        <p className="corpo app-muted" style={{ margin: 0 }}>{step === 3 && shotsPlan ? `Cada convidado tem um filme. No plano ${shotsPlan.name}, até ${shotsPlan.maxShots ?? "sem limite de"} por pessoa.` : info.hint}</p>
        <div className="rv-steps" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Passo ${step + 1} de ${STEPS.length}: ${info.title}`}>
          {STEPS.map((x, i) => <i key={x.key} className={i <= step ? "on" : undefined} />)}
        </div>
      </header>

      <form className="rv-wiz__form" aria-busy={busy} aria-labelledby="wiz-titulo" noValidate onSubmit={(e) => { e.preventDefault(); if (last) void create(); else next(); }}>
        <div className="rv-wiz__body app-stack">
          {step === 0 && (
            <>
              <CameraStage wrap={wrap} size={640} priority />
              <div className="app-stack-sm" style={{ textAlign: "center" }}>
                <h2 className="titulo-card app-h1">{WRAP_INFO[wrap].label}</h2>
                <p className="corpo-sm app-muted" style={{ margin: 0 }}>{WRAP_INFO[wrap].blurb}</p>
              </div>
              <WrapPicker value={wrap} onChange={setWrap} />
            </>
          )}
          {step === 1 && (
            <>
              <CameraStage wrap={wrap} size={360} />
              <Field label="Nome que os convidados vão ver" value={title} onChange={(e) => { setTitle(e.target.value); setErrors((x) => ({ ...x, title: undefined })); }} maxLength={60} placeholder="Ex.: Ana & Leo" error={errors.title} />
              <div className="app-stack-sm">
                <span className="rv-group-label">Sugestões</span>
                <Chips label="Sugestões de nome">
                  {suggestEventNames(category, user?.name ?? "", now()).map((s) => (
                    <Chip key={s} variant="filtro" pressed={title === s} onClick={() => { setTitle(s); setErrors((x) => ({ ...x, title: undefined })); }}>{s}</Chip>
                  ))}
                </Chips>
              </div>
              <OptionGroup<EventCategory> label="Tipo de evento" value={category} onChange={setCategory} options={(Object.keys(CATEGORY_LABEL) as EventCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
            </>
          )}
          {step === 2 && (
            <>
              <OptionGroup<number> label="Termina em" value={otherDate ? OTHER_DATE : hours} onChange={(v) => { if (v === OTHER_DATE) setOtherDate(true); else { setOtherDate(false); setHours(v); } setErrors((x) => ({ ...x, termino: undefined })); }} options={[...DURATIONS.map((h) => ({ value: h, label: h === 1 ? "1 hora" : `${h} horas` })), { value: OTHER_DATE, label: "Outra data" }]} />
              {otherDate && <div role={errors.termino ? "alert" : undefined}><Field label="Escolha o horário" type="datetime-local" value={until} min={toLocalInput(now() + 30 * 60_000)} onChange={(e) => { setUntil(e.target.value); setErrors((x) => ({ ...x, termino: undefined })); }} error={errors.termino} help="Pelo menos 30 minutos a partir de agora." /></div>}
              {!otherDate && errors.termino && <p className="rv-field-erro" role="alert">{errors.termino}</p>}
            </>
          )}
          {step === 3 && (
            <>
              <div style={{ display: "grid", placeItems: "center" }}><ShotCounter value={desiredShots} label="poses por pessoa" /></div>
              <div className="rv-choices" role="group" aria-label="Poses por pessoa">
                {shotsChoices.map((n) => (
                  <button key={n} type="button" className={`rv-choice rv-choice--num ${desiredShots === n ? "rv-choice--on" : ""}`} aria-pressed={desiredShots === n} onClick={() => setDesiredShots(n)}>
                    {n}<small>poses</small>
                  </button>
                ))}
              </div>
              <p className="corpo-sm app-muted" style={{ margin: 0 }}>
                {shotsPlan
                  ? `Acima de ${freeShotsLimit} poses pede o plano ${shotsPlan.name} (${formatBRL(shotsPlan.priceCents)}). A câmera nasce Grátis, com ${freeShotsLimit} poses por pessoa, e passa para o plano quando o pagamento for confirmado.`
                  : `${freeShotsLimit} poses por pessoa cabem no plano Grátis.`}
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <OptionGroup<RevealChoice> label="Revelar" value={choice} onChange={(c) => { setChoice(c); setRevealErrors(undefined); }} options={REVEAL_CHOICES} />
              {choice === "dia" && (
                <>
                  <Field label="Data" type="date" value={revDate} onChange={(e) => setRevDate(e.target.value)} error={revealErrors?.data ? REVEAL_ERROR_TEXT[revealErrors.data] : undefined} />
                  <Field label="Horário" type="time" value={revTime} onChange={(e) => setRevTime(e.target.value)} />
                  <Select label="Fuso horário" value={timezone} onChange={(e) => setTimezone(e.target.value)} options={(TIMEZONES.some((z) => z.id === timezone) ? TIMEZONES : [{ id: timezone, label: timezone }, ...TIMEZONES]).map((z) => ({ value: z.id, label: z.label }))} help="A contagem regressiva dos convidados usa este fuso." />
                </>
              )}
              {choice !== "dia" && revealErrors?.data && <p className="rv-field-erro" role="alert">{REVEAL_ERROR_TEXT[revealErrors.data]}</p>}
              <div className="rv-notice" style={{ maxWidth: "none" }} aria-live="polite">
                <span className="rv-notice-eyebrow">Como o convidado recebe</span>
                {choice === "na-hora" ? (
                  <span className="rv-notice-texto">As fotos aparecem para todos assim que são tiradas.</span>
                ) : (
                  <>
                    <span className="rv-notice-texto">O filme de {eventName} foi revelado.</span>
                    <span className="rv-stamp">{revealWhen ? `${revealWhen.date} · ${revealWhen.time} · ${zoneLabel(timezone).split(" (")[0]}` : "Escolha a data e a hora"}</span>
                  </>
                )}
              </div>
              {choice === "manha" && <p className="corpo-sm app-muted" style={{ margin: 0 }}>Revelar na manhã seguinte deixa a noite para a pista.</p>}
            </>
          )}
          {step === 5 && (
            <>
              <div className="rv-film" role="radiogroup" aria-label="Filme">
                {(["natural", "filme35"] as const).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={film === f} className={`rv-film__opt ${film === f ? "rv-film__opt--on" : ""}`} onClick={() => setFilm(f)}>
                    <span className={`rv-film__frame rv-film__frame--${f}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- objeto 3D do kit (bolo), WebP responsivo */}
                      <img src="/revela/3d/obj-cake.webp" alt="" width={240} height={240} loading="lazy" decoding="async" />
                      {f === "filme35" && <span className="rv-tag" style={{ top: "auto", left: "auto", right: 8, bottom: 8 }}>&apos;27 03 14</span>}
                    </span>
                    <span className="rv-film__name">{FILM_LABEL[f]}</span>
                  </button>
                ))}
              </div>
              <p className="corpo-sm app-muted" style={{ margin: 0, textAlign: "center" }}>
                {film === "filme35" ? "Filme 35mm: tons quentes, grão, carimbo de data e o brilho do flash." : "Natural: a foto como a câmera do celular viu, sem efeito."}
              </p>
            </>
          )}
          {step === 6 && (
            <div className="rv-group" style={{ maxWidth: "none" }}>
              <ToggleRow icon="olho" label="Convidados veem o feed" hint="Curtem e comentam depois da revelação" checked={everyoneSeesAll} onChange={setEveryoneSeesAll} />
              <p className="corpo-sm app-muted" style={{ margin: "var(--space-3) 0 0" }}>
                {everyoneSeesAll ? "Depois da revelação, cada convidado vê as fotos de todos." : "Depois da revelação, cada convidado vê só as próprias fotos. Você continua vendo tudo."}
              </p>
            </div>
          )}
          {step === 7 && (
            <>
              <CameraStage wrap={wrap} size={360} />
              <dl className="rv-summary">
                <div><dt>Embalagem</dt><dd>{WRAP_INFO[wrap].label}</dd></div>
                <div><dt>Poses</dt><dd>{desiredShots} por pessoa</dd></div>
                <div><dt>Revela</dt><dd>{choice === "na-hora" ? "na hora" : choice === "ao-acabar" ? "ao acabar" : choice === "manha" ? "manhã seguinte" : `${revDate || "—"} ${revTime}`}</dd></div>
              </dl>
              <PlanStep plans={plans} settings={settings} selected={planCode} onSelect={setPlanCode} pendingCode={pendingCode} />
              <p className="app-p" role="status">Limite ao criar: {WIZARD_DEFAULTS.shots} poses por pessoa no Grátis. Você deseja {desiredShots}.</p>
              {shotsPlan && (
                <div className="app-card">
                  <p className="app-p">Para {desiredShots} poses por pessoa, recomendamos {shotsPlan.name} ({formatBRL(shotsPlan.priceCents)}). O limite aumenta depois da confirmação do pagamento.</p>
                  <Button variant="secundario" onClick={() => setPlanCode(shotsPlan.code)}>Escolher {shotsPlan.name}</Button>
                </div>
              )}
              {planCode !== "gratis" && <p className="corpo-sm app-muted" style={{ margin: 0 }}>O plano escolhido só é ativado depois do pagamento; até lá valem os limites do Grátis.</p>}
              <ConsentChecks terms={acceptedTerms} privacy={ackedPrivacy} onTerms={(v) => { setAcceptedTerms(v); setErrors((e) => ({ ...e, create: undefined })); }} onPrivacy={(v) => { setAckedPrivacy(v); setErrors((e) => ({ ...e, create: undefined })); }} />
              {errors.create && <p className="rv-field-erro" role="alert">{errors.create}</p>}
              {hasPaidPlans(catalog) && <p className="corpo-sm app-muted" style={{ margin: 0 }}>{PAID_PLAN_LINE}</p>}
            </>
          )}
        </div>

        <div className="rv-wiz__bar">
          {step > 0 ? <button type="button" className="rv-icon-btn" aria-label="Voltar" disabled={busy} onClick={() => setStep(step - 1)}><Icon name="voltar" decorative /></button> : <Button href="/" variant="texto" small>Cancelar</Button>}
          <Button type="submit" variant="primario" block disabled={busy}>{ctaLabel}</Button>
        </div>
      </form>
    </div>
  );
}
