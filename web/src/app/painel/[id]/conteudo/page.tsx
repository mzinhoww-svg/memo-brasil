"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmSheet, Sheet } from "@/components/revela";
import { computeRevealStatus } from "@/domain/reveal";
import type { Photo } from "@/domain/photo";
import { moderate, type ModerationAction } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { shortWhen } from "@/features/admin/panel-format";
import { usePhotoUrls } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { hhmm } from "@/features/guest/format";
import { formatReasonCounts } from "@/features/moderation/report-reasons";
import { useReportReasons } from "@/features/moderation/use-report-reasons";
import { revealNow, type RevealNowResult } from "@/features/events/reveal-now";
import { plural } from "@/lib/plural";
import { RevealNowSheet, type RevealFailure } from "@/revela/master/RevealNowSheet";
import { AnfitriaoModerar, ModFotoGrande, type ModFilter } from "@/revela/screens/AnfitriaoModerar";

const PAGE = 60;
/** Recusa do repositório → recusa da folha única (as mensagens são as do servidor). */
const HOST_FAILURE: Record<Extract<RevealNowResult, { ok: false }>["reason"], RevealFailure> = { "sem-permissao": "forbidden", "ja-revelado": "revealed", indisponivel: "invalid", inexistente: "forbidden", erro: "unknown" };
type FilterId = "todas" | "removidas" | "denunciadas";
const day = (ts: number, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(ts));
const sameDay = (a: number, b: number, tz: string) => day(a, tz) === day(b, tz);
const firstName = (n: string) => n.trim().split(/\s+/)[0] || "Convidado";

/** Conteúdo (17c): revisar antes de revelar. Só o anfitrião vê as fotos; tocar numa foto a abre grande, com as ações de tirar, destacar e excluir. */
export default function Conteudo() {
  const router = useRouter();
  const { repos, now: clock } = useApp();
  const { event, now, photos, refresh } = useAdmin();
  const [shown, setShown] = useState(PAGE);
  const [filter, setFilter] = useState<FilterId>("todas");
  const [person, setPerson] = useState("");
  const [picked, setPicked] = useState<string | undefined>();
  const [removing, setRemoving] = useState<string | undefined>();
  const [revealing, setRevealing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | undefined>();
  const status = computeRevealStatus(event, now);
  const reasons = useReportReasons(event.id, photos.length);
  const isReported = (p: Photo) => p.reports > 0 || formatReasonCounts(reasons.photos[p.id]) !== "";

  const list = useMemo(() => photos.filter((p) => p.status !== "removida").sort((a, b) => b.createdAt - a.createdAt), [photos]);
  const removedCount = list.filter((p) => p.status === "oculta").length;
  const reportedCount = list.filter(isReported).length;
  const people = useMemo(() => {
    const seen = new Map<string, { label: string; n: number }>();
    for (const p of list) seen.set(p.authorId, { label: firstName(p.authorName), n: (seen.get(p.authorId)?.n ?? 0) + 1 });
    return [...seen].map(([value, v]) => ({ value, label: `${v.label} (${v.n})` }));
  }, [list]);
  const filtered = list.filter((p) => (filter === "todas" || (filter === "removidas" ? p.status === "oculta" : isReported(p))) && (!person || p.authorId === person));
  const page = filtered.slice(0, shown);
  const urls = usePhotoUrls(page, "thumb");
  const current = picked ? list.find((p) => p.id === picked) : undefined;
  const big = usePhotoUrls(current ? [current] : [], "full");

  async function act(id: string, a: ModerationAction) {
    if (busy) return;
    setBusy(true);
    try {
      await moderate(repos, id, a);
      await refresh();
    } finally { setBusy(false); }
  }

  const filters: ModFilter[] = [
    { id: "todas", label: "Todas", count: list.length },
    { id: "removidas", label: "Removidas", count: removedCount },
    { id: "denunciadas", label: "Denunciadas", count: reportedCount },
  ];
  let intro = "O resto já está revelado para todos.";
  let state = "Revelada";
  if (status === "pendente" && event.revealAt !== null) {
    state = sameDay(event.revealAt, now, event.timezone) ? `Revela às ${hhmm(event.revealAt, event.timezone)}` : `Revela ${shortWhen(event.revealAt, event.timezone)}`;
    intro = `O resto revela para todos em ${shortWhen(event.revealAt, event.timezone)}.`;
  } else if (status === "pendente") { state = "Revela ao fim do evento"; intro = "O resto revela para todos quando o evento terminar."; }
  else if (status === "desativada") { state = "Fotos na hora"; intro = "As fotos aparecem para todos assim que são tiradas."; }

  return (
    <>
      <AnfitriaoModerar
        status={state} intro={intro} canReveal={status === "pendente"}
        count={`${list.length} ${plural(list.length, "foto", "fotos")} · ${removedCount} ${plural(removedCount, "removida", "removidas")}`}
        hint="Toque numa foto para ver e tirar do álbum."
        empty="Ainda sem fotos. Elas aparecem aqui conforme os convidados fotografam." emptyActionLabel="Compartilhar o QR" onEmptyAction={() => router.push(`/painel/${event.id}/compartilhar`)}
        filters={filters} filter={filter} onFilter={(f) => { setFilter(f as FilterId); setShown(PAGE); }}
        people={people} person={person} onPerson={(v) => { setPerson(v); setShown(PAGE); }}
        items={page.map((p) => ({ id: p.id, src: urls[p.id], name: firstName(p.authorName), when: hhmm(p.createdAt, event.timezone), off: p.status === "oculta", reported: isReported(p), alt: `Foto de ${p.authorName}` }))}
        onMore={filtered.length > shown ? () => setShown((n) => n + PAGE) : undefined}
        onBack={() => router.push(`/painel/${event.id}`)}
        onItem={setPicked}
        onReveal={() => setRevealing(true)}
      />
      {msg && <p role="status" className="rv-sr-only">{msg}</p>}
      {current && (
        <Sheet title={`Foto de ${current.authorName}`} history onClose={() => setPicked(undefined)}>
          <div className="cont-viewer">
            <ModFotoGrande src={big[current.id] ?? urls[current.id]} alt={`Foto de ${current.authorName}`} />
            <p className="rv-caption">
              {hhmm(current.createdAt, event.timezone)}{current.moment ? ` · ${current.moment}` : ""}
              {current.status === "oculta" ? " · removida do álbum" : ""}{current.highlighted ? " · em destaque" : ""}
            </p>
            {formatReasonCounts(reasons.photos[current.id]) && <p className="rv-caption">Denúncias: {formatReasonCounts(reasons.photos[current.id])}</p>}
          </div>
          <div className="app-stack-sm">
            {current.status === "oculta"
              ? <Button block disabled={busy} onClick={async () => { await act(current.id, "mostrar"); setPicked(undefined); }}>Devolver ao álbum</Button>
              : <Button block variant="secundario" disabled={busy} onClick={async () => { await act(current.id, "ocultar"); setPicked(undefined); }}>Tirar do álbum</Button>}
            <Button block variant="secundario" disabled={busy} onClick={async () => { await act(current.id, "destacar"); setPicked(undefined); }}>{current.highlighted ? "Tirar destaque" : "Destacar"}</Button>
            <Button block variant="destrutivo" disabled={busy} onClick={() => { setRemoving(current.id); setPicked(undefined); }}>Excluir a foto</Button>
          </div>
        </Sheet>
      )}
      {removing && <ConfirmSheet history title="Excluir esta foto?" body="Os convidados deixam de vê-la e ela não volta." confirmLabel="Excluir foto" onCancel={() => setRemoving(undefined)} onConfirm={async () => { await act(removing, "remover"); setRemoving(undefined); }} />}
      {revealing && (
        <RevealNowSheet
          eventId={event.id} eventTitle={event.title}
          plannedAt={event.revealAt !== null ? `${shortWhen(event.revealAt, event.timezone)}` : "Quando o evento terminar"}
          send={async (_id, reason) => {
            const r = await revealNow(repos, event, clock(), reason);
            return r.ok ? { ok: true } : { ok: false, failure: HOST_FAILURE[r.reason] };
          }}
          onDone={() => { setMsg("Revelação antecipada."); void refresh(); }}
          onClose={() => setRevealing(false)} />
      )}
    </>
  );
}
