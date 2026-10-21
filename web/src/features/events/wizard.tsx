"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Chip, Chips, Field, OptionGroup, Progress, Signature } from "@/components/memoriesmt";
import { priceRule } from "@/domain/pricing";
import { CAMERA_STYLE_LABEL, CAPACITY_OPTIONS, CATEGORY_LABEL, SHOTS_OPTIONS, MIN_DURATION_HOURS, type CameraStyle, type Capacity, type EventCategory, type Shots } from "@/domain/options";
import type { EventFontId, PaletteId } from "@/domain/event";
import { EVENT_FONT_LABEL, PALETTES } from "@/lib/event-theme";
import { useApp } from "@/features/app/provider";
import { localBilling } from "@/lib/services";
import { createEvent } from "./service";
import { resolveDuration } from "./duration";
import { RevealForm } from "./RevealForm";
import { defaultRevealInput, resolveReveal, type RevealInput } from "./reveal-input";
import { formatInZone, zoneLabel, type RevealErrors } from "@/domain/reveal";

const STEPS = ["Nome", "Término", "Revelação", "Identidade", "Convidados", "Resumo"] as const;
const DURATIONS = [1, 3, 6, 12, 24, 48];

const toLocalInput = (ts: number) => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

export function CreateWizard() {
  const router = useRouter();
  const { repos, user, signIn, now, ready, backend, canCreate, signInWithGoogle } = useApp();
  const [step, setStep] = useState(0);
  const [hostInput, setHostName] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>("casamento");
  const [place, setPlace] = useState("");
  const [hours, setHours] = useState<number>(6);
  const [until, setUntil] = useState("");
  const [reveal, setReveal] = useState<RevealInput>(defaultRevealInput);
  const [camera, setCamera] = useState<CameraStyle>("original");
  const [palette, setPalette] = useState<PaletteId>("salvia");
  const [font, setFont] = useState<EventFontId>("birthstone");
  const [capacity, setCapacity] = useState<Capacity>(50);
  const [shots, setShots] = useState<Shots>(24);
  const [everyone, setEveryone] = useState(true);
  const [errors, setErrors] = useState<{ title?: string; host?: string; termino?: string; create?: string }>({});
  const [busy, setBusy] = useState(false);

  const hostName = hostInput ?? user?.name ?? "";

  const untilMs = until ? new Date(until).getTime() : undefined;
  const [previewHours, setPreviewHours] = useState(6);
  const [revealErrors, setRevealErrors] = useState<RevealErrors | undefined>();
  const price = priceRule(capacity, false);

  function next() {
    const e: typeof errors = {};
    if (step === 0) {
      if (!hostName.trim()) e.host = "Escreva seu nome para organizar a festa.";
      if (!title.trim()) e.title = "Escolha o nome do evento. Todos os convidados vão ver.";
    }
    if (step === 1 && resolveDuration({ untilMs, presetHours: hours }, now()) < MIN_DURATION_HOURS) e.termino = "Escolha um horário no futuro, pelo menos 30 minutos a partir de agora.";
    if (step === 2) {
      const r = resolveReveal(reveal, now() + previewHours * 3_600_000, now());
      setRevealErrors(r.ok ? undefined : r.errors);
      if (!r.ok) {
        setErrors(e);
        return;
      }
    }
    setErrors(e);
    if (Object.keys(e).length === 0) {
      if (step === 1) setPreviewHours(resolveDuration({ untilMs, presetHours: hours }, now()));
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }
  }

  async function create() {
    setBusy(true);
    const me = await signIn(hostName);
    const startNow = now();
    const durationHours = resolveDuration({ untilMs, presetHours: hours }, startNow);
    const r = await createEvent(
      repos,
      me,
      { title, category, durationHours, reveal, cameraStyle: camera, capacity, shotsPerPerson: shots, everyoneSeesAll: everyone, palette, eventFont: font, place },
      startNow,
    );
    setBusy(false);
    if (!r.ok) {
      if (r.errors.reveal) {
        setRevealErrors(r.errors.reveal);
        setStep(2);
      }
      return setErrors({ create: "Não deu para criar o evento. Confira os campos e tente de novo." });
    }
    router.push(`/criar/pronto/${r.event.id}`);
  }

  const resolved = resolveReveal(reveal, now() + previewHours * 3_600_000, now());
  const summaryReveal = !reveal.enabled ? "fotos aparecem na hora" : resolved.ok && resolved.enabled ? `revelação em ${formatInZone(resolved.at, resolved.timezone).date} às ${formatInZone(resolved.at, resolved.timezone).time} (${zoneLabel(resolved.timezone).split(" (")[0]})` : "revelação a definir";

  if (!ready) return <p className="app-screen app-muted">Carregando…</p>;
  const last = step === STEPS.length - 1;

  // na nuvem só o organizador com conta cria evento (RLS recusa convidado anônimo); a entrada é pelo Google
  if (ready && backend === "supabase" && !canCreate) {
    return (
      <div className="app-screen">
        <h1 className="titulo-tela app-h1">Entre para criar o seu evento.</h1>
        <p className="corpo app-p app-muted">Quem organiza usa uma conta Google. Convidados entram só com o código, sem conta.</p>
        <Button variant="primario" block onClick={() => void signInWithGoogle("/criar")}>Entrar com Google</Button>
        <Button href="/" variant="texto">Voltar ao início</Button>
      </div>
    );
  }

  return (
    <div className="app-screen">
      <div className="app-stack-sm">
        <Button variant="texto" href="/">Cancelar</Button>
        <Progress variant="evento" label={`Passo ${step + 1} de ${STEPS.length}`} status={STEPS[step]} value={((step + 1) / STEPS.length) * 100} />
      </div>

      <form className="app-stack" noValidate onSubmit={(e) => { e.preventDefault(); if (last) void create(); else next(); }}>
        {step === 0 && (
          <>
            <h1 className="titulo-tela app-h1">Qual é o nome do seu evento?</h1>
            <p className="app-p app-muted">Ele aparece para todos os convidados.</p>
            <Field label="Nome do evento" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Ex.: Emy e Igor" error={errors.title} />
            <Field label="Seu nome" value={hostName} onChange={(e) => setHostName(e.target.value)} maxLength={40} autoComplete="given-name" error={errors.host} />
            <OptionGroup<EventCategory> label="Tipo de evento" value={category} onChange={setCategory} options={(Object.keys(CATEGORY_LABEL) as EventCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
            <Field label="Local (opcional)" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={60} placeholder="Ex.: Chalés Taíba, CE" />
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="titulo-tela app-h1">Quando o seu evento termina?</h1>
            <p className="app-p app-muted">O evento abre agora. Os convidados postam até ele fechar.</p>
            <OptionGroup<number> label="Termina em" value={until ? -1 : hours} onChange={(v) => { setHours(v); setUntil(""); }} options={DURATIONS.map((h) => ({ value: h, label: h === 1 ? "1 hora" : `${h} horas` }))} />
            <Field label="Ou escolha o horário" type="datetime-local" value={until} min={toLocalInput(now() + 30 * 60_000)} onChange={(e) => setUntil(e.target.value)} error={errors.termino} help="Pelo menos 30 minutos a partir de agora." />
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="titulo-tela app-h1">Quando revelar as fotos?</h1>
            <p className="app-p app-muted">Como numa câmera descartável: as fotos ficam guardadas e aparecem para todos juntas, na hora que você escolher.</p>
            <RevealForm value={reveal} onChange={(v) => { setReveal(v); setRevealErrors(undefined); }} endMs={now() + previewHours * 3_600_000} now={now()} errors={revealErrors} />
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="titulo-tela app-h1">Qual é a cara do seu evento?</h1>
            <OptionGroup<CameraStyle> label="Câmera" value={camera} onChange={setCamera} options={(Object.keys(CAMERA_STYLE_LABEL) as CameraStyle[]).map((c) => ({ value: c, label: CAMERA_STYLE_LABEL[c] }))} />
            <p className="app-p app-muted">Estilos mudam o visual da foto postada.</p>
            <div className="app-stack-sm">
              <span className="mm-group-label">Cor do evento</span>
              <Chips label="Cor do evento">
                {(Object.keys(PALETTES) as PaletteId[]).map((p) => (
                  <Chip key={p} variant="filtro" pressed={palette === p} onClick={() => setPalette(p)}>{PALETTES[p].label}</Chip>
                ))}
              </Chips>
            </div>
            <OptionGroup<EventFontId> label="Fonte do nome do evento" value={font} onChange={setFont} options={(Object.keys(EVENT_FONT_LABEL) as EventFontId[]).map((f) => ({ value: f, label: EVENT_FONT_LABEL[f] }))} />
            <div data-palette={palette} className="mm-event-header" style={{ ["--font-evento" as string]: `var(--fonte-${font}), cursive` }}>
              <span className="mm-event-meta">Prévia</span>
              <span className="mm-event-nome">{title || "Seu evento"}</span>
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h1 className="titulo-tela app-h1">Quantos convidados no seu evento?</h1>
            <OptionGroup<Capacity> label="Convidados" value={capacity} onChange={setCapacity} options={CAPACITY_OPTIONS.map((c) => ({ value: c, label: c === null ? "Ilimitado" : String(c) }))} />
            <OptionGroup<Shots> label="Fotos por pessoa" value={shots} onChange={setShots} options={SHOTS_OPTIONS.map((s) => ({ value: s, label: s === null ? "Ilimitadas" : String(s) }))} />
            <OptionGroup<boolean> list label="Quem vê as fotos" value={everyone} onChange={setEveryone} options={[{ value: true, label: "Todos veem todas as fotos" }, { value: false, label: "Cada um vê só as suas" }]} />
          </>
        )}
        {step === 5 && (
          <>
            <h1 className="titulo-tela app-h1">Confirme o seu evento</h1>
            <div className="app-card">
              <span className="titulo-card">{title}</span>
              <span className="app-muted">{CATEGORY_LABEL[category]}{place ? ` · ${place}` : ""}</span>
              <span>Termina em {Math.round(previewHours * 10) / 10} h · {summaryReveal}</span>
              <span>{capacity === null ? "Convidados ilimitados" : `Até ${capacity} convidados`} · {shots === null ? "fotos ilimitadas" : `${shots} fotos por pessoa`}</span>
            </div>
            {price.kind === "gratis" ? (
              <p className="corpo app-p">Eventos com até 10 convidados são gratuitos.</p>
            ) : (
              <div className="app-banner" role="status">
                <span>Este evento passaria de 10 convidados e teria valor. {localBilling.mode === "demo" ? "Nesta versão de demonstração, nada é cobrado." : ""}</span>
              </div>
            )}
            {errors.create && <p className="mm-field-erro" role="alert">{errors.create}</p>}
          </>
        )}

        <div className="app-stack-sm">
          <Button type="submit" variant="primario" block disabled={busy}>{last ? (price.kind === "gratis" ? "Criar evento grátis" : "Criar evento de demonstração") : "Próximo"}</Button>
          {step > 0 && <Button variant="texto" onClick={() => setStep(step - 1)}>Voltar</Button>}
        </div>
      </form>
      <div style={{ marginTop: "auto" }}><Signature /></div>
    </div>
  );
}
