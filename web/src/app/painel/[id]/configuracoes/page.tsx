"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CapacityBanner, usePlanInfo } from "@/features/admin/PlanInfo";
import { capacityState } from "@/features/billing/capacity";
import { limitChoices } from "@/features/billing/limits";
import { RedeemCodeSheet, type RedeemCodeProps } from "@/features/billing/RedeemCode";
import { Button, Chip, Chips, Field, Notice, OptionGroup, ConfirmSheet } from "@/components/revela";
import { photosAvailableUntil } from "@/domain/retention";
import { canEditEnd, endAt, eventStatus } from "@/domain/event";
import { CAPACITY_OPTIONS, SHOTS_OPTIONS, type Capacity, type Shots } from "@/domain/options";
import { RevealSettings } from "@/features/events/RevealSettings";
import { useAdmin } from "@/features/admin/context";
import { formatDate, formatTime } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { copyFor } from "@/features/app/copy";
import { backendMode } from "@/lib/supabase/env";
import { deleteEvent, endEventNow, setEndIn, updateSettings } from "@/features/events/service";

import { endConsequence } from "@/features/admin/end-consequence";

const EXTEND = [1, 3, 6, 24];

export default function Configuracoes() {
  const { repos, now: clock, scheduler } = useApp();
  const router = useRouter();
  const { event, now, photos, participants, refresh } = useAdmin();
  const participantsCount = participants.length;
  const [title, setTitle] = useState(event.title);
  const [hostName, setHostName] = useState(event.hostName);
  const [codeOpen, setCodeOpen] = useState(false);
  const [planVersion, setPlanVersion] = useState(0);
  const info = usePlanInfo(event.id, `${event.version}-${planVersion}`);
  const [notice, setNotice] = useState(event.notice?.text ?? "");
  const [msg, setMsg] = useState<string | undefined>();
  const [confirm, setConfirm] = useState<"encerrar" | "excluir" | number | undefined>();
  const ended = eventStatus(event, now) === "encerrado";
  const photoCount = photos.filter((p) => p.status !== "removida").length;
  const locked = !canEditEnd(event, photoCount, now);
  const availableUntil = photosAvailableUntil(event);
  // sem o plano carregado, o piso é o Grátis do catálogo; o servidor impõe de qualquer forma (MM012)
  const limitGuests = info.current ? info.current.maxGuests : event.capacity;
  const limitShots = info.current ? info.current.maxShots : event.shotsPerPerson;

  const save = async (patch: Parameters<typeof updateSettings>[2]) => {
    try {
      const r = await updateSettings(repos, event.id, patch);
      setMsg(r.ok ? "Salvo." : r.reason === "capacidade-menor-que-convidados" ? "Esse evento já tem mais convidados do que essa capacidade. Escolha um número maior." : "Não foi possível salvar. Tente de novo.");
      await refresh();
    } catch { setMsg("Não foi possível salvar. Tente de novo."); }
  };

  const onCodeApplied: RedeemCodeProps["onApplied"] = async (r) => {
    setCodeOpen(false);
    const name = info.plans.find((p) => p.code === r.planCode)?.name;
    setMsg(name ? `Código aplicado. Plano ${name} liberado.` : "Código aplicado. Plano liberado.");
    setPlanVersion((v) => v + 1);
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

      {(() => {
        const cap = capacityState(participantsCount, event.capacity, info.settings?.capacityGracePct ?? 0);
        return info.loaded && cap.near && event.capacity !== null && cap.limit !== null
          ? <div className="app-form-col"><CapacityBanner guests={participantsCount} capacity={event.capacity} limit={cap.limit} planHref={`/painel/${event.id}/plano`} /></div>
          : null;
      })()}

      <section className="app-stack app-form-col" aria-labelledby="nome">
        <h2 id="nome" className="titulo-card app-h1">Nome e aparência</h2>
        <Field label="Nome do evento" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
        <Button variant="secundario" disabled={!title.trim() || title === event.title} onClick={() => save({ title: title.trim() })}>Salvar nome</Button>
        <Field label="Seu nome (aparece no convite)" value={hostName} maxLength={60} onChange={(e) => setHostName(e.target.value)} />
        <Button variant="secundario" disabled={!hostName.trim() || hostName.trim() === event.hostName} onClick={() => save({ hostName: hostName.trim() })}>Salvar seu nome</Button>
        <p className="app-p app-muted">Cores, fonte, mensagem e QR ficam em <Link href={`/painel/${event.id}/aparencia`}>Aparência</Link>.</p>
      </section>

      {availableUntil !== null && (
        <section className="app-stack app-form-col" aria-labelledby="guarda" data-testid="guarda-fotos">
          <h2 id="guarda" className="titulo-card app-h1">Guarda das fotos</h2>
          <p className="app-p">As fotos ficam disponíveis até {formatDate(availableUntil)}, 90 dias após o encerramento do evento. Baixe as que quiser guardar antes dessa data; depois dela o acesso é encerrado e as fotos são excluídas.</p>
        </section>
      )}

      <section className="app-stack app-form-col" aria-labelledby="regras">
        <h2 id="regras" className="titulo-card app-h1">Regras da festa</h2>
        <OptionGroup<Shots> label="Fotos por pessoa" value={event.shotsPerPerson} onChange={(v) => save({ shotsPerPerson: v })} options={limitChoices<Shots>(SHOTS_OPTIONS, limitShots, event.shotsPerPerson).map((s) => ({ value: s, label: s === null ? "Ilimitadas" : String(s) }))} />
        <OptionGroup<Capacity> label="Convidados" value={event.capacity} onChange={(v) => save({ capacity: v })} options={limitChoices<Capacity>(CAPACITY_OPTIONS, limitGuests, event.capacity, true).map((c) => ({ value: c, label: c === null ? "Ilimitado" : String(c) }))} />
        {info.loaded && info.current && (
          <p className="app-p app-muted" data-testid="limite-plano">
            Seu plano permite até {info.current.maxGuests === null ? "convidados sem limite" : `${info.current.maxGuests} convidados`} e {info.current.maxShots === null ? "fotos sem limite" : `${info.current.maxShots} fotos por pessoa`}.{" "}
            <Link href={`/painel/${event.id}/plano`}>Aumentar plano</Link>
          </p>
        )}
        <OptionGroup<boolean> list label="Quem vê as fotos" value={event.everyoneSeesAll} onChange={(v) => save({ everyoneSeesAll: v })} options={[{ value: true, label: "Todos veem todas as fotos" }, { value: false, label: "Cada um vê só as suas" }]} />
        <OptionGroup<boolean> label="Reações nas fotos" value={event.reactionsEnabled} onChange={(v) => save({ reactionsEnabled: v })} options={[{ value: true, label: "Ligadas" }, { value: false, label: "Desligadas" }]} />
      </section>

      <div className="app-form-col"><RevealSettings event={event} now={now} photoCount={photoCount} onSaved={refresh} /></div>

      <section className="app-stack app-form-col" aria-labelledby="aviso">
        <h2 id="aviso" className="titulo-card app-h1">Aviso no Agora</h2>
        {event.notice && <Notice text={event.notice.text} />}
        <Field label="Aviso curto" value={notice} maxLength={90} onChange={(e) => setNotice(e.target.value)} placeholder="Ex.: Pôr do sol na areia em 10 minutos." help="Um aviso por vez. Escreva a hora ou o lugar." />
        <div className="app-row">
          <Button variant="secundario" disabled={!notice.trim()} onClick={() => save({ notice: { text: notice.trim() } })}>Publicar aviso</Button>
          {event.notice && <Button variant="texto" onClick={async () => { setNotice(""); await save({ notice: undefined }); }}>Apagar aviso</Button>}
        </div>
      </section>

      <section className="app-stack app-form-col" aria-labelledby="presente">
        <h2 id="presente" className="titulo-card app-h1">Código de presente</h2>
        <p className="app-p app-muted">Ganhou um código de presente ou de teste? Ele libera o plano sem pagar.</p>
        <Button variant="secundario" onClick={() => setCodeOpen(true)}>Tenho um código</Button>
      </section>

      <section className="app-stack app-form-col" aria-labelledby="fim">
        <h2 id="fim" className="titulo-card app-h1">Fim do evento</h2>
        <p className="app-p">{ended ? "Terminou" : "Termina"} em {formatDate(endAt(event))} · {formatTime(endAt(event))}.</p>
        {locked ? <p className="app-p app-muted">Este álbum já terminou e tem fotos. Não dá para reabrir.</p> : (
          <div className="app-stack-sm">
            <span className="rv-group-label">Mudar o fim para daqui a</span>
            <Chips label="Mudar o fim">
              {EXTEND.map((h) => <Chip key={h} variant="filtro" onClick={() => setConfirm(h)}>{h === 1 ? "1 hora" : h === 24 ? "1 dia" : `${h} horas`}</Chip>)}
            </Chips>
          </div>
        )}
        {!ended && <Button variant="destrutivo" onClick={() => setConfirm("encerrar")}>Encerrar agora</Button>}
      </section>

      <section className="app-stack app-form-col" aria-labelledby="perigo">
        <h2 id="perigo" className="titulo-card app-h1">Excluir</h2>
        <p className="app-p app-muted">{copyFor(backendMode()).deleteBody}</p>
        <Button variant="destrutivo" onClick={() => setConfirm("excluir")}>Excluir evento</Button>
      </section>

      {codeOpen && <RedeemCodeSheet eventId={event.id} onApplied={(r) => void onCodeApplied(r)} onClose={() => setCodeOpen(false)} />}
      {(confirm === "encerrar" || typeof confirm === "number") && (
        <ConfirmSheet title={confirm === "encerrar" ? "Encerrar agora?" : "Mudar o fim do evento?"}
          body={`${confirm === "encerrar" ? "Ninguém posta mais. " : "O fim muda para " + formatDate(clock() + confirm * 3_600_000) + " · " + formatTime(clock() + confirm * 3_600_000) + ". "}${endConsequence(event, confirm === "encerrar" ? clock() : clock() + confirm * 3_600_000, clock())}`}
          confirmLabel={confirm === "encerrar" ? "Encerrar agora" : "Confirmar novo fim"}
          onCancel={() => setConfirm(undefined)} onConfirm={async () => {
            if (typeof confirm === "number") { await extend(confirm); }
            else {
              const updated = await endEventNow(repos, event.id, clock());
              if (!updated) throw new Error("Evento indisponível");
              scheduler.cancel(event.id);
              await refresh();
            }
            setConfirm(undefined);
          }} />
      )}
      {confirm === "excluir" && (
        <ConfirmSheet title={copyFor(backendMode()).deleteQuestion} body={copyFor(backendMode()).deleteBody}
          confirmLabel="Excluir evento" onCancel={() => setConfirm(undefined)} onConfirm={async () => {
            await deleteEvent(repos, event.id); scheduler.cancel(event.id); router.push("/eventos");
          }} />
      )}
    </>
  );
}
