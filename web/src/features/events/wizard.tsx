"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumbs, Button, Chip, Chips, Field, GoogleButton, OptionGroup, Progress, Select, Signature } from "@/components/memoriesmt";
import { CATEGORY_LABEL, MIN_DURATION_HOURS, type EventCategory } from "@/domain/options";
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
import { CodeApplied, REDEEM_TEXT, RedeemCode, redeemMessage } from "@/features/billing/RedeemCode";
import { formatBRL, getPublicSettings, listPublicPlans, redeemCode } from "@/features/billing/api";
import type { PublicPlan, PublicSettings } from "@/features/billing/types";
import { buildCreateInput, WIZARD_DEFAULTS } from "./wizard-input";
import { TIMEZONES, defaultTimezone, formatInZone, zoneLabel, type RevealErrors } from "@/domain/reveal";

export { WIZARD_DEFAULTS };

const STEPS = ["Nome", "Quando", "Fotos", "Convidados"] as const;
const DURATIONS = [1, 3, 6, 12, 24, 48];
const SHOTS_CHOICES = [10, 16, 24, 36];
const OTHER_DATE = -1;

const toLocalInput = (ts: number) => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

export function CreateWizard() {
  const router = useRouter();
  const { repos, user, signIn, now, ready, backend, canCreate, signInWithGoogle } = useApp();
  const [step, setStep] = useState(0);
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
    if (step === 0 && !title.trim()) e.title = "Escolha o nome do evento. Todos os convidados vão ver.";
    if (step === 1) {
      if (durationHours() < MIN_DURATION_HOURS) e.termino = "Escolha um horário no futuro, pelo menos 30 minutos a partir de agora.";
      else {
        const r = resolveReveal(revealInput(), endMs(), now());
        setRevealErrors(r.ok ? undefined : r.errors);
        if (!r.ok) return setErrors(e);
      }
    }
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function create() {
    if (!acceptedTerms || !ackedPrivacy) return setErrors({ create: CONSENT_REQUIRED });
    setBusy(true);
    const me = await signIn(hostName);
    if (backend === "supabase") {
      try { await recordConsent(currentConsent("organizador", null, { termsAccepted: acceptedTerms, privacyAcknowledged: ackedPrivacy })); } catch { setBusy(false); return setErrors({ create: CONSENT_FAILED }); }
    }
    const startNow = now();
    const hoursNow = resolveDuration({ untilMs: otherDate ? untilMs : undefined, presetHours: hours }, startNow);
    const input = buildCreateInput({ title, category, durationHours: hoursNow, reveal: buildRevealInput(choice, startNow + hoursNow * 3_600_000, { date: revDate, time: revTime, timezone }), desiredShots });
    const r = await createEvent(repos, me, input, startNow);
    setBusy(false);
    if (!r.ok) {
      if (r.errors.reveal) {
        setRevealErrors(r.errors.reveal);
        setStep(1);
      }
      return setErrors({ create: "Não deu para criar o evento. Confira os campos e tente de novo." });
    }
    const chosen = plans?.find((p) => p.code === planCode);
    const eventId = r.event.id;
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
    if (chosen && !chosen.isFree) router.push(`/painel/${eventId}/plano?plano=${encodeURIComponent(chosen.code)}`);
    else router.push(`/criar/pronto/${eventId}`);
  }

  const resolved = step === 1 ? resolveReveal(revealInput(), endMs(), now()) : undefined;
  const revealWhen = resolved?.ok && resolved.enabled ? formatInZone(resolved.at, resolved.timezone) : undefined;
  const eventName = title.trim() || "sua festa";
  const catalog = plans ?? [];
  const shotsPlan = planForShots(catalog, desiredShots);
  const freeShotsLimit = freeShots(catalog);

  if (!ready) return <p className="app-screen app-muted">Carregando…</p>;
  const last = step === STEPS.length - 1;

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

  return (
    <div className="app-screen">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Criar evento" }]} />
      <div className="app-stack-sm">
        <Button variant="texto" href="/">Cancelar</Button>
        <Progress variant="evento" label={`Passo ${step + 1} de ${STEPS.length}`} status={STEPS[step]} value={((step + 1) / STEPS.length) * 100} />
      </div>

      <form className="app-stack" noValidate onSubmit={(e) => { e.preventDefault(); if (last) void create(); else next(); }}>
        {step === 0 && (
          <>
            <h1 className="titulo-tela app-h1">Como se chama a festa?</h1>
            <Field label="Nome que os convidados vão ver" value={title} onChange={(e) => { setTitle(e.target.value); setErrors((x) => ({ ...x, title: undefined })); }} maxLength={60} placeholder="Ex.: Emy e Igor" error={errors.title} />
            <div className="app-stack-sm">
              <span className="mm-group-label">Sugestões</span>
              <Chips label="Sugestões de nome">
                {suggestEventNames(category, user?.name ?? "", now()).map((s) => (
                  <Chip key={s} variant="filtro" pressed={title === s} onClick={() => { setTitle(s); setErrors((x) => ({ ...x, title: undefined })); }}>{s}</Chip>
                ))}
              </Chips>
            </div>
            <OptionGroup<EventCategory> label="Tipo de evento" value={category} onChange={setCategory} options={(Object.keys(CATEGORY_LABEL) as EventCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
            <p className="app-p app-muted">Local, capa e estilo ficam para depois, no painel.</p>
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="titulo-tela app-h1">Quando a festa acaba?</h1>
            <OptionGroup<number> label="Termina em" value={otherDate ? OTHER_DATE : hours} onChange={(v) => { if (v === OTHER_DATE) setOtherDate(true); else { setOtherDate(false); setHours(v); } setErrors((x) => ({ ...x, termino: undefined })); }} options={[...DURATIONS.map((h) => ({ value: h, label: h === 1 ? "1 hora" : `${h} horas` })), { value: OTHER_DATE, label: "Outra data" }]} />
            {otherDate && <Field label="Escolha o horário" type="datetime-local" value={until} min={toLocalInput(now() + 30 * 60_000)} onChange={(e) => { setUntil(e.target.value); setErrors((x) => ({ ...x, termino: undefined })); }} error={errors.termino} help="Pelo menos 30 minutos a partir de agora." />}
            {!otherDate && errors.termino && <p className="mm-field-erro" role="alert">{errors.termino}</p>}
            <OptionGroup<RevealChoice> label="E quando as fotos aparecem?" value={choice} onChange={(c) => { setChoice(c); setRevealErrors(undefined); }} options={REVEAL_CHOICES} />
            {choice === "dia" && (
              <>
                <Field label="Data" type="date" value={revDate} onChange={(e) => setRevDate(e.target.value)} error={revealErrors?.data ? REVEAL_ERROR_TEXT[revealErrors.data] : undefined} />
                <Field label="Horário" type="time" value={revTime} onChange={(e) => setRevTime(e.target.value)} />
                <Select label="Fuso horário" value={timezone} onChange={(e) => setTimezone(e.target.value)} options={(TIMEZONES.some((z) => z.id === timezone) ? TIMEZONES : [{ id: timezone, label: timezone }, ...TIMEZONES]).map((z) => ({ value: z.id, label: z.label }))} help="A contagem regressiva dos convidados usa este fuso." />
              </>
            )}
            {choice !== "dia" && revealErrors?.data && <p className="mm-field-erro" role="alert">{REVEAL_ERROR_TEXT[revealErrors.data]}</p>}
            <div className="app-card" aria-live="polite" style={{ background: "var(--tinta)", color: "var(--fundo)" }}>
              <span className="eyebrow">Como o convidado recebe</span>
              {choice === "na-hora" ? (
                <span className="corpo">As fotos aparecem para todos assim que são postadas.</span>
              ) : (
                <>
                  <span className="titulo-card">O filme de {eventName} foi revelado.</span>
                  <span className="corpo">{revealWhen ? `${revealWhen.date} às ${revealWhen.time}, ${zoneLabel(timezone).split(" (")[0]}.` : "Escolha a data e a hora para ver quando."}</span>
                </>
              )}
            </div>
            {choice === "manha" && <p className="app-p app-muted">Revelar na manhã seguinte deixa a noite para a pista.</p>}
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="titulo-tela app-h1">Quantas fotos cada pessoa tira?</h1>
            <p className="app-p app-muted">Como num filme: poucas fotos fazem cada uma valer.</p>
            <div className="app-card" style={{ background: "var(--tinta)", color: "var(--fundo)" }} aria-live="polite">
              <span className="titulo-tela" data-testid="contador-previa"><strong style={{ fontSize: 40 }}>{desiredShots}</strong> FOTOS RESTANTES</span>
            </div>
            <div className="mm-group" role="group" aria-label="Fotos por pessoa">
              <div className="mm-opts" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                {SHOTS_CHOICES.map((n) => {
                  const hint = planForShots(catalog, n)?.name;
                  return (
                    <button key={n} type="button" className="mm-opt" aria-pressed={desiredShots === n} onClick={() => setDesiredShots(n)} style={{ height: "auto", minHeight: "var(--size-opcao)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "8px 14px" }}>
                      <span>{n}</span>
                      {hint && <span data-testid="selo-plano" style={{ fontSize: 12, fontWeight: 700 }}>{`Plano ${hint}`}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="app-p app-muted">
              {shotsPlan
                ? `Acima de ${freeShotsLimit} fotos pede o plano ${shotsPlan.name} (${formatBRL(shotsPlan.priceCents)}). O evento nasce Grátis, com ${freeShotsLimit} fotos por pessoa.`
                : desiredShots <= freeShotsLimit
                  ? `${freeShotsLimit} fotos por pessoa cabem no plano Grátis.`
                  : `O evento nasce Grátis, com ${freeShotsLimit} fotos por pessoa.`}
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="titulo-tela app-h1">Quantos convidados vão fotografar?</h1>
            <PlanStep plans={plans} settings={settings} selected={planCode} onSelect={setPlanCode} pendingCode={pendingCode} />
            <ConsentChecks terms={acceptedTerms} privacy={ackedPrivacy} onTerms={(v) => { setAcceptedTerms(v); setErrors((e) => ({ ...e, create: undefined })); }} onPrivacy={(v) => { setAckedPrivacy(v); setErrors((e) => ({ ...e, create: undefined })); }} />
            {errors.create && <p className="mm-field-erro" role="alert">{errors.create}</p>}
          </>
        )}

        <div className="app-stack-sm">
          <Button type="submit" variant="primario" block disabled={busy}>{last ? "Criar evento" : "Continuar"}</Button>
          {last && hasPaidPlans(catalog) && <p className="app-p app-muted">{PAID_PLAN_LINE}</p>}
          {step > 0 && <Button variant="texto" onClick={() => setStep(step - 1)}>Voltar</Button>}
        </div>
      </form>
      <div style={{ marginTop: "auto" }}><Signature /></div>
    </div>
  );
}
