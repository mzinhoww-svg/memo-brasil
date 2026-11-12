"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmSheet, Sheet } from "@/components/revela";
import { computeRevealStatus } from "@/domain/reveal";
import { moderate, type ModerationAction } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { revealStamp, shortWhen } from "@/features/admin/panel-format";
import { usePhotoUrls } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { formatReasonCounts } from "@/features/moderation/report-reasons";
import { useReportReasons } from "@/features/moderation/use-report-reasons";
import { revealNow, type RevealNowResult } from "@/features/events/reveal-now";
import { RevealNowSheet, type RevealFailure } from "@/revela/master/RevealNowSheet";
import { AnfitriaoModerar } from "@/revela/screens/AnfitriaoModerar";

const PAGE = 60;
/** Recusa do repositório → recusa da folha única (as mensagens são as do servidor). */
const HOST_FAILURE: Record<Extract<RevealNowResult, { ok: false }>["reason"], RevealFailure> = { "sem-permissao": "forbidden", "ja-revelado": "revealed", indisponivel: "invalid", inexistente: "forbidden", erro: "unknown" };
const pad = (n: number) => String(n).padStart(2, "0");

/** Revisar antes de revelar (17c): só o anfitrião vê as fotos; tocar numa foto a tira (ou devolve) e "Revelar agora" antecipa a revelação. */
export default function Conteudo() {
  const router = useRouter();
  const { repos, now: clock } = useApp();
  const { event, now, photos, refresh } = useAdmin();
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState<string | undefined>();
  const [removing, setRemoving] = useState<string | undefined>();
  const [revealing, setRevealing] = useState(false);
  const [msg, setMsg] = useState<string | undefined>();
  const status = computeRevealStatus(event, now);
  const list = useMemo(() => photos.filter((p) => p.status !== "removida").sort((a, b) => b.createdAt - a.createdAt), [photos]);
  const page = list.slice(0, shown);
  const urls = usePhotoUrls(page, "thumb");
  const reasons = useReportReasons(event.id, photos.length);
  const current = picked ? list.find((p) => p.id === picked) : undefined;

  async function act(id: string, a: ModerationAction) {
    await moderate(repos, id, a);
    await refresh();
  }

  let stamp = revealStamp(event, now);
  let intro = "Tire o que não deve aparecer. O resto já está revelado para todos.";
  if (status === "pendente" && event.revealAt !== null) {
    const left = Math.max(0, event.revealAt - now);
    stamp = `REVELA EM ${pad(Math.floor(left / 3_600_000))}:${pad(Math.floor((left % 3_600_000) / 60_000))}`;
    intro = `Tire o que não deve aparecer. O resto revela para todos em ${shortWhen(event.revealAt, event.timezone)}.`;
  } else if (status === "pendente") intro = "Tire o que não deve aparecer. O resto revela para todos quando o evento terminar.";
  else if (status === "desativada") intro = "Tire o que não deve aparecer. As fotos aparecem para todos assim que são tiradas.";

  return (
    <>
      <AnfitriaoModerar
        stamp={stamp} intro={intro} canReveal={status === "pendente"}
        empty="Ainda sem fotos. Elas aparecem aqui conforme os convidados fotografam."
        items={page.map((p) => ({ id: p.id, src: urls[p.id] ?? "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", name: `${p.authorName.split(" ")[0]}${p.status === "oculta" ? " · removida" : ""}`, off: p.status === "oculta", alt: `Foto de ${p.authorName}` }))}
        onMore={list.length > shown ? () => setShown((n) => n + PAGE) : undefined}
        onBack={() => router.push(`/painel/${event.id}`)}
        onItem={setPicked}
        onReveal={() => setRevealing(true)}
      />
      {msg && <p role="status" className="rv-sr-only">{msg}</p>}
      {current && (
        <Sheet title={`Foto de ${current.authorName}`} onClose={() => setPicked(undefined)}>
          <div className="app-stack-sm">
            {formatReasonCounts(reasons.photos[current.id]) && <p className="rv-caption">Denúncias: {formatReasonCounts(reasons.photos[current.id])}</p>}
            {current.status === "oculta"
              ? <Button block onClick={async () => { await act(current.id, "mostrar"); setPicked(undefined); }}>Devolver ao álbum</Button>
              : <Button block variant="secundario" onClick={async () => { await act(current.id, "ocultar"); setPicked(undefined); }}>Tirar do álbum</Button>}
            <Button block variant="secundario" onClick={async () => { await act(current.id, "destacar"); setPicked(undefined); }}>{current.highlighted ? "Tirar destaque" : "Destacar"}</Button>
            <Button block variant="destrutivo" onClick={() => { setRemoving(current.id); setPicked(undefined); }}>Excluir a foto</Button>
          </div>
        </Sheet>
      )}
      {removing && <ConfirmSheet title="Excluir esta foto?" body="Os convidados deixam de vê-la e ela não volta." confirmLabel="Excluir foto" onCancel={() => setRemoving(undefined)} onConfirm={async () => { await act(removing, "remover"); setRemoving(undefined); }} />}
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
