"use client";

import { useState } from "react";
import { Button, Sheet } from "@/components/memoriesmt";
import { endAt, type MemoEvent } from "@/domain/event";
import { computeRevealStatus, epochToZoned, formatInZone, type RevealErrors } from "@/domain/reveal";
import { useApp } from "@/features/app/provider";
import { WaitingReveal } from "@/features/reveal/WaitingReveal";
import { RevealForm } from "./RevealForm";
import { defaultRevealInput, type RevealInput } from "./reveal-input";
import { updateReveal } from "./service";

const MESSAGES = {
  "ja-revelada": "A revelação já aconteceu. Não dá para esconder fotos que já foram vistas.",
  "fotos-ja-visiveis": "Este evento já tem fotos visíveis. Não dá para ligar a revelação e escondê-las de novo.",
  inexistente: "Não achamos esse evento.",
  invalido: "Confira a data, a hora e o fuso.",
} as const;

function fromEvent(e: MemoEvent): RevealInput {
  if (!e.revealEnabled || e.revealAt === null) return { ...defaultRevealInput(), enabled: false, timezone: e.timezone };
  const z = epochToZoned(e.revealAt, e.timezone);
  return { enabled: true, kind: "data", days: 1, date: z.date, time: z.time, timezone: e.timezone };
}

/** Revelação programada nas configurações: ligar, escolher data/hora/fuso, resumo, prévia e travas por estado. */
export function RevealSettings({ event, now, photoCount, onSaved }: { event: MemoEvent; now: number; photoCount: number; onSaved: () => Promise<void> }) {
  const { repos, now: clock } = useApp();
  const [form, setForm] = useState<RevealInput>(() => fromEvent(event));
  const [errors, setErrors] = useState<RevealErrors | undefined>();
  const [msg, setMsg] = useState<string | undefined>();
  const [preview, setPreview] = useState(false);
  const status = computeRevealStatus(event, now);
  const locked = status === "revelada";
  const at = event.revealAt !== null ? formatInZone(event.revealAt, event.timezone) : undefined;

  async function save() {
    setErrors(undefined);
    const r = await updateReveal(repos, event.id, form, clock());
    if (!r.ok) {
      setErrors(r.errors);
      return setMsg(MESSAGES[r.reason]);
    }
    setMsg("Revelação salva.");
    await onSaved();
  }

  return (
    <section className="app-stack" aria-labelledby="rev" data-testid="config-revelacao">
      <h2 id="rev" className="titulo-card app-h1">Revelação programada</h2>
      {locked ? (
        <div className="app-banner" role="status">
          <span>A revelação aconteceu em {at?.date} às {at?.time}. Não dá para esconder fotos que já foram vistas.</span>
        </div>
      ) : (
        <>
          <p className="app-p app-muted">
            {status === "desativada" ? "Desligada: as fotos aparecem na hora." : `Ligada: revela em ${at?.date} às ${at?.time}.`}
            {" "}Fim do evento: {formatInZone(endAt(event), event.timezone).date} às {formatInZone(endAt(event), event.timezone).time}.
          </p>
          <RevealForm value={form} onChange={(v) => { setForm(v); setMsg(undefined); setErrors(undefined); }} endMs={endAt(event)} now={now} errors={errors} />
          {photoCount > 0 && !event.revealEnabled && <p className="app-p app-muted">Já há fotos neste evento: não dá para ligar a revelação e escondê-las.</p>}
          <div className="app-row">
            <Button variant="secundario" onClick={save}>Salvar revelação</Button>
            {event.revealEnabled && event.revealAt !== null && <Button variant="texto" onClick={() => setPreview(true)}>Pré-visualizar como convidado</Button>}
          </div>
        </>
      )}
      {msg && <p className="app-p" role="status">{msg}</p>}
      {preview && (
        <Sheet title="Prévia do convidado" onClose={() => setPreview(false)}>
          <WaitingReveal event={event} ownCount={0} totalCount={photoCount} preview />
          <Button variant="secundario" block onClick={() => setPreview(false)}>Fechar prévia</Button>
        </Sheet>
      )}
    </section>
  );
}
