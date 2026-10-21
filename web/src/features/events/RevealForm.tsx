"use client";

import { Field, OptionGroup, Select } from "@/components/memoriesmt";
import { TIMEZONES, formatInZone, zoneLabel, type RevealErrors } from "@/domain/reveal";
import { REVEAL_ERROR_TEXT, resolveReveal, type RevealInput, type RevealKind } from "./reveal-input";

/** Formulário de revelação programada: wizard (passo 3) e configurações do painel. */
export function RevealForm({ value, onChange, endMs, now, errors, disabled }: { value: RevealInput; onChange: (v: RevealInput) => void; endMs: number; now: number; errors?: RevealErrors; disabled?: boolean }) {
  const set = (patch: Partial<RevealInput>) => onChange({ ...value, ...patch });
  const zones = TIMEZONES.some((z) => z.id === value.timezone) ? TIMEZONES : [{ id: value.timezone, label: value.timezone }, ...TIMEZONES];
  const preview = resolveReveal(value, endMs, now);
  const when = preview.ok && preview.enabled ? formatInZone(preview.at, preview.timezone) : undefined;
  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="app-stack">
      <OptionGroup<boolean> list label="Revelação programada" value={value.enabled} onChange={(enabled) => set({ enabled })} options={[{ value: true, label: "Ligada: as fotos ficam bloqueadas até a revelação" }, { value: false, label: "Desligada: as fotos aparecem na hora" }]} />
      {value.enabled && (
        <>
          <OptionGroup<RevealKind> list label="Quando revelar" value={value.kind} onChange={(kind) => set({ kind })} options={[{ value: "ao-terminar", label: "Quando o evento terminar" }, { value: "depois", label: "Alguns dias depois do fim" }, { value: "data", label: "Escolher data e hora" }]} />
          {value.kind === "depois" && <Field label="Dias depois do fim" type="number" inputMode="numeric" min={1} max={30} value={String(value.days)} onChange={(e) => set({ days: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })} />}
          {value.kind === "data" && (
            <>
              <Field label="Data" type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} error={errors?.data ? REVEAL_ERROR_TEXT[errors.data] : undefined} />
              <Field label="Horário" type="time" value={value.time} onChange={(e) => set({ time: e.target.value })} />
            </>
          )}
          <Select label="Fuso horário" value={value.timezone} onChange={(e) => set({ timezone: e.target.value })} options={zones.map((z) => ({ value: z.id, label: z.label }))} help="A contagem regressiva dos convidados usa este fuso." />
          {errors?.fuso && <p className="mm-field-erro" role="alert">{REVEAL_ERROR_TEXT[errors.fuso]}</p>}
          {errors?.data && value.kind !== "data" && <p className="mm-field-erro" role="alert">{REVEAL_ERROR_TEXT[errors.data]}</p>}
          <div className="app-card" aria-live="polite">
            <span className="eyebrow app-muted">Resumo</span>
            {when ? <span className="corpo">A revelação acontece em {when.date} às {when.time}, {zoneLabel(value.timezone).split(" (")[0]}.</span> : <span className="corpo app-muted">Escolha a data e a hora para ver o resumo.</span>}
          </div>
        </>
      )}
      {!value.enabled && <p className="app-p app-muted">Sem revelação, cada foto aparece para todos assim que é postada.</p>}
    </fieldset>
  );
}
