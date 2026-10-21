"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Chip, Chips, Field, Notice, OptionGroup, Sheet } from "@/components/memoriesmt";
import { canEditEnd, endAt, eventStatus, type EventFontId, type PaletteId } from "@/domain/event";
import { CAPACITY_OPTIONS, SHOTS_OPTIONS, type Capacity, type Shots } from "@/domain/options";
import { RevealSettings } from "@/features/events/RevealSettings";
import { EVENT_FONT_LABEL, PALETTES } from "@/lib/event-theme";
import { useAdmin } from "@/features/admin/context";
import { formatDate, formatTime } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { deleteEvent, endEventNow, setEndIn, updateSettings } from "@/features/events/service";

const EXTEND = [1, 3, 6, 24];

export default function Configuracoes() {
  const { repos, now: clock, scheduler } = useApp();
  const router = useRouter();
  const { event, now, photos, refresh } = useAdmin();
  const [title, setTitle] = useState(event.title);
  const [notice, setNotice] = useState(event.notice?.text ?? "");
  const [msg, setMsg] = useState<string | undefined>();
  const [confirm, setConfirm] = useState<"encerrar" | "excluir" | undefined>();
  const ended = eventStatus(event, now) === "encerrado";
  const photoCount = photos.filter((p) => p.status !== "removida").length;
  const locked = !canEditEnd(event, photoCount, now);

  const save = async (patch: Parameters<typeof updateSettings>[2]) => {
    const r = await updateSettings(repos, event.id, patch);
    setMsg(!r.ok && r.reason === "capacidade-menor-que-convidados" ? "Esse evento já tem mais convidados do que essa capacidade. Escolha um número maior." : undefined);
    await refresh();
  };

  async function extend(h: number) {
    const r = await setEndIn(repos, event.id, h, clock());
    setMsg(r.ok ? `Novo fim: ${formatDate(endAt(r.event))} · ${formatTime(endAt(r.event))}.` : r.reason === "encerrado-com-fotos" ? "Este álbum já terminou e tem fotos. Não dá para reabrir." : "Escolha um fim pelo menos 30 minutos à frente.");
    await refresh();
  }

  return (
    <>
      <h1 className="titulo-pagina app-h1">Configurações</h1>
      {msg && <p className="app-p" role="status">{msg}</p>}

      <section className="app-stack" style={{ maxWidth: 343 }} aria-labelledby="nome">
        <h2 id="nome" className="titulo-card app-h1">Nome e aparência</h2>
        <Field label="Nome do evento" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
        <Button variant="secundario" disabled={!title.trim() || title === event.title} onClick={() => save({ title: title.trim() })}>Salvar nome</Button>
        <div className="app-stack-sm">
          <span className="mm-group-label">Cor do evento</span>
          <Chips label="Cor do evento">
            {(Object.keys(PALETTES) as PaletteId[]).map((p) => <Chip key={p} variant="filtro" pressed={event.palette === p} onClick={() => save({ palette: p })}>{PALETTES[p].label}</Chip>)}
          </Chips>
        </div>
        <OptionGroup<EventFontId> label="Fonte do nome do evento" value={event.eventFont} onChange={(v) => save({ eventFont: v })} options={(Object.keys(EVENT_FONT_LABEL) as EventFontId[]).map((f) => ({ value: f, label: EVENT_FONT_LABEL[f] }))} />
      </section>

      <section className="app-stack" style={{ maxWidth: 343 }} aria-labelledby="regras">
        <h2 id="regras" className="titulo-card app-h1">Regras da festa</h2>
        <OptionGroup<Shots> label="Fotos por pessoa" value={event.shotsPerPerson} onChange={(v) => save({ shotsPerPerson: v })} options={SHOTS_OPTIONS.map((s) => ({ value: s, label: s === null ? "Ilimitadas" : String(s) }))} />
        <OptionGroup<Capacity> label="Convidados" value={event.capacity} onChange={(v) => save({ capacity: v })} options={CAPACITY_OPTIONS.map((c) => ({ value: c, label: c === null ? "Ilimitado" : String(c) }))} />
        {event.capacity !== null && event.capacity > 10 || event.capacity === null ? <p className="app-p app-muted">Passar de 10 convidados teria valor. Nesta versão de demonstração, nada é cobrado.</p> : null}
        <OptionGroup<boolean> list label="Quem vê as fotos" value={event.everyoneSeesAll} onChange={(v) => save({ everyoneSeesAll: v })} options={[{ value: true, label: "Todos veem todas as fotos" }, { value: false, label: "Cada um vê só as suas" }]} />
        <OptionGroup<boolean> label="Reações nas fotos" value={event.reactionsEnabled} onChange={(v) => save({ reactionsEnabled: v })} options={[{ value: true, label: "Ligadas" }, { value: false, label: "Desligadas" }]} />
      </section>

      <div style={{ maxWidth: 343 }}><RevealSettings event={event} now={now} photoCount={photoCount} onSaved={refresh} /></div>

      <section className="app-stack" style={{ maxWidth: 343 }} aria-labelledby="aviso">
        <h2 id="aviso" className="titulo-card app-h1">Aviso no Agora</h2>
        {event.notice && <Notice text={event.notice.text} />}
        <Field label="Aviso curto" value={notice} maxLength={90} onChange={(e) => setNotice(e.target.value)} placeholder="Ex.: Pôr do sol na areia em 10 minutos." help="Um aviso por vez. Escreva a hora ou o lugar." />
        <div className="app-row">
          <Button variant="secundario" disabled={!notice.trim()} onClick={() => save({ notice: { text: notice.trim() } })}>Publicar aviso</Button>
          {event.notice && <Button variant="texto" onClick={async () => { setNotice(""); await save({ notice: undefined }); }}>Apagar aviso</Button>}
        </div>
      </section>

      <section className="app-stack" style={{ maxWidth: 343 }} aria-labelledby="fim">
        <h2 id="fim" className="titulo-card app-h1">Fim do evento</h2>
        <p className="app-p">{ended ? "Terminou" : "Termina"} em {formatDate(endAt(event))} · {formatTime(endAt(event))}.</p>
        {locked ? <p className="app-p app-muted">Este álbum já terminou e tem fotos. Não dá para reabrir.</p> : (
          <div className="app-stack-sm">
            <span className="mm-group-label">Mudar o fim para daqui a</span>
            <Chips label="Mudar o fim">
              {EXTEND.map((h) => <Chip key={h} variant="filtro" onClick={() => extend(h)}>{h === 1 ? "1 hora" : h === 24 ? "1 dia" : `${h} horas`}</Chip>)}
            </Chips>
          </div>
        )}
        {!ended && <Button variant="destrutivo" onClick={() => setConfirm("encerrar")}>Encerrar agora</Button>}
      </section>

      <section className="app-stack" style={{ maxWidth: 343 }} aria-labelledby="perigo">
        <h2 id="perigo" className="titulo-card app-h1">Excluir</h2>
        <p className="app-p app-muted">Apaga o evento, as fotos e as reações deste aparelho.</p>
        <Button variant="destrutivo" onClick={() => setConfirm("excluir")}>Excluir evento</Button>
      </section>

      {confirm === "encerrar" && (
        <Sheet title="Encerrar agora?" onClose={() => setConfirm(undefined)}>
          <p className="corpo app-p">Ninguém posta mais. A revelação segue o horário que você configurou.</p>
          <div className="app-stack-sm">
            <Button variant="destrutivo" block onClick={async () => { await endEventNow(repos, event.id, clock()); scheduler.cancel(event.id); setConfirm(undefined); await refresh(); }}>Encerrar agora</Button>
            <Button variant="secundario" block onClick={() => setConfirm(undefined)}>Voltar</Button>
          </div>
        </Sheet>
      )}
      {confirm === "excluir" && (
        <Sheet title="Excluir evento?" onClose={() => setConfirm(undefined)}>
          <p className="corpo app-p">As fotos e reações deste evento serão apagadas. Não dá para desfazer.</p>
          <div className="app-stack-sm">
            <Button variant="destrutivo" block onClick={async () => { scheduler.cancel(event.id); await deleteEvent(repos, event.id); router.push("/"); }}>Excluir evento</Button>
            <Button variant="secundario" block onClick={() => setConfirm(undefined)}>Voltar</Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
