"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Sheet } from "@/components/revela";
import { MIN_REVEAL_LEAD_MS, epochToZoned, zonedToEpoch } from "@/domain/reveal";
import { useAdmin } from "@/features/admin/context";
import { shortWhen } from "@/features/admin/panel-format";
import { useApp } from "@/features/app/provider";
import { updateSettings } from "@/features/events/service";
import { hhmm } from "@/features/guest/format";
import { PainelAviso } from "@/revela/screens/PainelAviso";

const MAX = 140;
const HALF_HOUR = 30 * 60_000;

/** Aviso aos convidados (17g): uma mensagem curta no Agora, enviada já ou agendada. Um aviso por vez. */
export default function Aviso() {
  const router = useRouter();
  const { repos, now: clock } = useApp();
  const { event, now, refresh } = useAdmin();
  const tz = event.timezone;
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"agora" | "agendar">("agora");
  const [at, setAt] = useState(() => Math.ceil((now + HALF_HOUR) / 60_000) * 60_000);
  const [picking, setPicking] = useState<{ date: string; time: string } | undefined>();
  const [pickError, setPickError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const body = text.trim();

  const n = event.notice;
  const live = n && (!n.expiresAt || n.expiresAt > now);
  const current = live ? (n.startsAt && n.startsAt > now ? `Agendado para ${shortWhen(n.startsAt, tz)}: ${n.text}` : `No ar agora: ${n.text}`) : undefined;

  async function send() {
    if (!body) return setError("Escreva a mensagem do aviso.");
    if (mode === "agendar" && at < clock() + MIN_REVEAL_LEAD_MS) return setError("Escolha um horário pelo menos 1 minuto à frente.");
    setBusy(true);
    setError(undefined);
    try {
      const r = await updateSettings(repos, event.id, { notice: { text: body, ...(mode === "agendar" ? { startsAt: at } : {}) } });
      if (!r.ok) throw new Error(r.reason);
      router.push(`/painel/${event.id}`);
    } catch {
      setError("Não foi possível enviar o aviso. Tente de novo.");
      setBusy(false);
    }
  }
  async function clear() {
    try {
      await updateSettings(repos, event.id, { notice: undefined });
      await refresh();
      setError(undefined);
    } catch { setError("Não foi possível apagar o aviso. Tente de novo."); }
  }
  function confirmWhen() {
    if (!picking) return;
    const ms = zonedToEpoch(picking.date, picking.time, tz);
    if (Number.isNaN(ms) || ms < clock() + MIN_REVEAL_LEAD_MS) return setPickError("Escolha um horário pelo menos 1 minuto à frente.");
    setAt(ms);
    setPicking(undefined);
    setPickError(undefined);
  }

  return (
    <>
      <PainelAviso
        text={text} max={MAX} mode={mode} when={shortWhen(at, tz)}
        previewName={event.title} previewTime={hhmm(mode === "agendar" ? at : now, tz)}
        cta={mode === "agendar" ? "Agendar aviso" : "Enviar aviso"} busy={busy} disabled={!body} error={error} current={current}
        onText={setText} onMode={setMode}
        onWhen={() => { setPickError(undefined); setPicking(epochToZoned(at, tz)); }}
        onSend={() => void send()} onClear={() => void clear()}
        onBack={() => router.push(`/painel/${event.id}`)}
      />
      {picking && (
        <Sheet title="Quando enviar" onClose={() => setPicking(undefined)}>
          <form className="app-stack-sm" onSubmit={(e) => { e.preventDefault(); confirmWhen(); }} noValidate>
            <Field label="Dia" type="date" value={picking.date} onChange={(e) => setPicking({ ...picking, date: e.target.value })} />
            <Field label="Hora" type="time" value={picking.time} onChange={(e) => setPicking({ ...picking, time: e.target.value })} error={pickError} />
            <Button type="submit" block>Pronto</Button>
          </form>
        </Sheet>
      )}
    </>
  );
}
