"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Chip, Chips, ConfirmSheet, Field, OptionGroup, Sheet } from "@/components/revela";
import { canEditEnd, endAt, eventStatus } from "@/domain/event";
import { CAPACITY_OPTIONS, SHOTS_OPTIONS, type Capacity, type Shots } from "@/domain/options";
import { computeRevealStatus } from "@/domain/reveal";
import { photosAvailableUntil } from "@/domain/retention";
import { endConsequence } from "@/features/admin/end-consequence";
import { useAdmin } from "@/features/admin/context";
import { shortWhen } from "@/features/admin/panel-format";
import { usePlanInfo } from "@/features/admin/PlanInfo";
import { formatDate, formatTime } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { limitChoices } from "@/features/billing/limits";
import { RedeemCodeSheet, type RedeemCodeProps } from "@/features/billing/RedeemCode";
import { endEventNow, setEndIn, updateSettings } from "@/features/events/service";
import { RevealSettings } from "@/features/events/RevealSettings";
import { AnfitriaoAjustes } from "@/revela/screens/AnfitriaoAjustes";
import { useFlash } from "@/revela/painel-ui";

const EXTEND = [1, 3, 6, 24];
type Panel = "nome" | "fim" | "revela" | "poses" | "mais" | "codigo" | undefined;

/** Ajustes do evento (17): plano, fim, revelação, filme, poses e o feed; o resto vive nas folhas abertas pelos mesmos botões. */
export default function Configuracoes() {
  const { repos, now: clock, scheduler } = useApp();
  const router = useRouter();
  const { event, now, photos, refresh } = useAdmin();
  const [panel, setPanel] = useState<Panel>();
  const [title, setTitle] = useState(event.title);
  const [hostName, setHostName] = useState(event.hostName);
  const [planVersion, setPlanVersion] = useState(0);
  const info = usePlanInfo(event.id, `${event.version}-${planVersion}`);
  const [confirm, setConfirm] = useState<"encerrar" | number | undefined>();
  // resultado do último salvamento, mostrado dentro da folha aberta (o aviso curto na tela também aparece, acima das folhas)
  const [note, setNote] = useState<{ text: string; tone: "ok" | "erro" } | undefined>();
  const [toast, flash] = useFlash();
  const ended = eventStatus(event, now) === "encerrado";
  const photoCount = photos.filter((p) => p.status !== "removida").length;
  const locked = !canEditEnd(event, photoCount, now);
  const availableUntil = photosAvailableUntil(event);
  // sem o plano carregado, o piso é o Grátis do catálogo; o servidor impõe de qualquer forma (MM012)
  const limitGuests = info.current ? info.current.maxGuests : event.capacity;
  const limitShots = info.current ? info.current.maxShots : event.shotsPerPerson;

  const save = async (patch: Parameters<typeof updateSettings>[2]) => {
    const say = (text: string, tone: "ok" | "erro") => { flash(text); setNote({ text, tone }); };
    try {
      const r = await updateSettings(repos, event.id, patch);
      say(r.ok ? "Salvo." : r.reason === "capacidade-menor-que-convidados" ? "Esse evento já tem mais convidados do que essa capacidade. Escolha um número maior." : "Não foi possível salvar. Tente de novo.", r.ok ? "ok" : "erro");
      await refresh();
      return r.ok;
    } catch { say("Não foi possível salvar. Tente de novo.", "erro"); return false; }
  };
  /** Abre uma folha com os campos locais ressincronizados com o evento (o que foi digitado e não salvo não volta). */
  const openPanel = (p: Exclude<Panel, undefined>) => {
    setTitle(event.title);
    setHostName(event.hostName);
    setNote(undefined);
    setPanel(p);
  };
  const status = note && <p className="app-dialog-status" role="status" data-tone={note.tone}>{note.text}</p>;
  const done = <Button variant="secundario" block onClick={() => setPanel(undefined)}>Pronto</Button>;
  const onCodeApplied: RedeemCodeProps["onApplied"] = async (r) => {
    setPanel(undefined);
    const name = info.plans.find((p) => p.code === r.planCode)?.name;
    flash(name ? `Código aplicado. Plano ${name} liberado.` : "Código aplicado. Plano liberado.");
    setPlanVersion((v) => v + 1);
    await refresh();
  };
  async function extend(h: number) {
    const r = await setEndIn(repos, event.id, h, clock());
    flash(r.ok ? `Novo fim: ${formatDate(endAt(r.event))} · ${formatTime(endAt(r.event))}.` : r.reason === "encerrado-com-fotos" ? "Este álbum já terminou e tem fotos. Não dá para reabrir." : "Escolha um fim pelo menos 30 minutos à frente.");
    await refresh();
  }

  const revStatus = computeRevealStatus(event, now);
  const reveals = revStatus === "desativada" ? "na hora" : event.revealAt === null ? "quando terminar" : shortWhen(event.revealAt, event.timezone);
  const planName = info.current?.name ?? "Grátis";

  return (
    <>
      <AnfitriaoAjustes
        name={event.title}
        cam={`/revela/3d/cam-${event.cameraStyle}-640.webp`}
        plan={`${planName} · ${event.capacity === null ? "convidados sem limite" : `até ${event.capacity} convidados`}`}
        closes={shortWhen(endAt(event), event.timezone)}
        reveals={reveals}
        film={event.filmLook === "natural" ? "natural" : "35mm"}
        poses={event.shotsPerPerson === null ? "sem limite" : `${event.shotsPerPerson} por pessoa`}
        feedOn={event.reactionsEnabled}
        canEnd={!ended}
        onClose={() => router.push(`/painel/${event.id}`)}
        onMore={() => openPanel("mais")}
        onWrap={() => router.push(`/painel/${event.id}/aparencia`)}
        onName={() => openPanel("nome")}
        onPlan={() => router.push(`/painel/${event.id}/plano`)}
        onCloses={() => openPanel("fim")}
        onReveals={() => openPanel("revela")}
        onFilm={() => router.push(`/painel/${event.id}/aparencia`)}
        onPoses={() => openPanel("poses")}
        onFeed={() => void save({ reactionsEnabled: !event.reactionsEnabled })}
        onEnd={() => setConfirm("encerrar")}
      />
      {toast}

      {panel === "nome" && (
        <Sheet title="Editar nome" history onClose={() => setPanel(undefined)}
          footer={<div className="app-stack-sm">{status}<Button block disabled={!title.trim() || title.trim() === event.title} onClick={async () => { if (await save({ title: title.trim() })) setPanel(undefined); }}>Salvar nome</Button></div>}>
          <Field label="Nome do evento" value={title} maxLength={60} onChange={(e) => { setNote(undefined); setTitle(e.target.value); }} />
        </Sheet>
      )}

      {panel === "fim" && (
        <Sheet title="Fim do evento" history onClose={() => setPanel(undefined)}>
          <p className="app-p">{ended ? "Terminou" : "Termina"} em {formatDate(endAt(event))} · {formatTime(endAt(event))}.</p>
          {locked ? <p className="app-p app-muted">Este álbum já terminou e tem fotos. Não dá para reabrir.</p> : (
            <div className="app-stack-sm">
              <span className="rv-group-label">Mudar o fim para daqui a</span>
              <Chips label="Mudar o fim">
                {EXTEND.map((h) => <Chip key={h} variant="filtro" onClick={() => setConfirm(h)}>{h === 1 ? "1 hora" : h === 24 ? "1 dia" : `${h} horas`}</Chip>)}
              </Chips>
            </div>
          )}
          {availableUntil !== null && (
            <p className="app-p app-muted" data-testid="guarda-fotos">As fotos ficam disponíveis até {formatDate(availableUntil)}, 90 dias após o encerramento do evento. Baixe as que quiser guardar antes dessa data; depois dela o acesso é encerrado e as fotos são excluídas.</p>
          )}
        </Sheet>
      )}

      {panel === "revela" && (
        <Sheet title="Quando revelar" history onClose={() => setPanel(undefined)}>
          <RevealSettings event={event} now={now} photoCount={photoCount} onSaved={refresh} />
        </Sheet>
      )}

      {panel === "poses" && (
        <Sheet title="Poses por pessoa" history onClose={() => setPanel(undefined)} footer={<div className="app-stack-sm">{status}{done}</div>}>
          <OptionGroup<Shots> label="Fotos por pessoa" value={event.shotsPerPerson} onChange={(v) => void save({ shotsPerPerson: v })} options={limitChoices<Shots>(SHOTS_OPTIONS, limitShots, event.shotsPerPerson).map((s) => ({ value: s, label: s === null ? "Ilimitadas" : String(s) }))} />
          {info.loaded && info.current && (
            <p className="app-p app-muted" data-testid="limite-plano">
              Seu plano permite até {info.current.maxGuests === null ? "convidados sem limite" : `${info.current.maxGuests} convidados`} e {info.current.maxShots === null ? "fotos sem limite" : `${info.current.maxShots} fotos por pessoa`}.{" "}
              <Link href={`/painel/${event.id}/plano`}>Aumentar plano</Link>
            </p>
          )}
        </Sheet>
      )}

      {panel === "mais" && (
        <Sheet title="Mais ajustes" history onClose={() => setPanel(undefined)} footer={<div className="app-stack-sm">{status}{done}</div>}>
          <OptionGroup<Capacity> label="Convidados" value={event.capacity} onChange={(v) => void save({ capacity: v })} options={limitChoices<Capacity>(CAPACITY_OPTIONS, limitGuests, event.capacity, true).map((c) => ({ value: c, label: c === null ? "Ilimitado" : String(c) }))} />
          <OptionGroup<boolean> list label="Quem vê as fotos" value={event.everyoneSeesAll} onChange={(v) => void save({ everyoneSeesAll: v })} options={[{ value: true, label: "Todos veem todas as fotos" }, { value: false, label: "Cada um vê só as suas" }]} />
          <OptionGroup<boolean> list label="Baixar em alta" value={event.guestDownloadHigh !== false} onChange={(v) => void save({ guestDownloadHigh: v })} options={[{ value: true, label: "Convidados podem baixar em alta" }, { value: false, label: "Só você baixa em alta" }]} />
          <Field label="Seu nome (aparece no convite)" value={hostName} maxLength={60} onChange={(e) => { setNote(undefined); setHostName(e.target.value); }} />
          <Button variant="secundario" block disabled={!hostName.trim() || hostName.trim() === event.hostName} onClick={() => void save({ hostName: hostName.trim() })}>Salvar seu nome</Button>
          <Button variant="secundario" block onClick={() => openPanel("codigo")}>Tenho um código de presente</Button>
          <Button variant="destrutivo" block onClick={() => router.push(`/painel/${event.id}/excluir`)}>Excluir evento</Button>
        </Sheet>
      )}

      {panel === "codigo" && <RedeemCodeSheet eventId={event.id} onApplied={(r) => void onCodeApplied(r)} onClose={() => setPanel(undefined)} />}

      {confirm !== undefined && (
        <ConfirmSheet history title={confirm === "encerrar" ? "Encerrar agora?" : "Mudar o fim do evento?"}
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
            setPanel(undefined);
          }} />
      )}
    </>
  );
}
