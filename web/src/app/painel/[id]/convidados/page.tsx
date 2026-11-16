"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { guestRanking, removeGuest, unblockGuest } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { hhmm } from "@/features/guest/format";
import { relativeTime } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { shareInvite } from "@/features/invitations/share";
import { siteOrigin } from "@/lib/site";
import type { Participant } from "@/repositories";
import { AnfitriaoConvidados, type GuestRow } from "@/revela/screens/AnfitriaoConvidados";
import { useFlash } from "@/revela/painel-ui";

/** Convidados (17b): quem entrou, quanto do filme cada um usou e quem ainda não apareceu; tocar na pessoa bloqueia ou desbloqueia. */
export default function Convidados() {
  const router = useRouter();
  const { repos } = useApp();
  const { event, now, photos, participants, refresh } = useAdmin();
  const [rows, setRows] = useState<{ participant: Participant; photos: number }[]>([]);
  const [target, setTarget] = useState<Participant | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [toast, flash] = useFlash();
  useEffect(() => {
    let active = true;
    guestRanking(repos, event).then((r) => { if (active) { setRows(r); setError(undefined); } }).catch(() => { if (active) setError("Não deu para carregar os convidados. Tente atualizar a página."); });
    return () => { active = false; };
  }, [repos, event, photos, participants]);

  async function toggle(p: Participant) {
    if (busy) return;
    setBusy(true); setError(undefined);
    try {
      await (p.blockedAt !== undefined ? unblockGuest : removeGuest)(repos, event.id, p.userId);
      setTarget(undefined);
      await refresh();
    } catch { setError("Não deu para atualizar o acesso. Tente de novo."); }
    finally { setBusy(false); }
  }
  async function invite() {
    const r = await shareInvite(event, siteOrigin());
    flash(r === "compartilhado" ? "Convite compartilhado." : r === "copiado" ? "Convite copiado." : "Não conseguimos copiar o convite.");
  }

  const live = photos.filter((p) => p.status !== "removida");
  const people = rows.filter((r) => r.participant.userId !== event.hostId);
  const lastPose = (id: string) => live.filter((p) => p.authorId === id).reduce((a, p) => Math.max(a, p.createdAt), 0);
  const guests: GuestRow[] = people.map(({ participant: p, photos: used }) => {
    const last = lastPose(p.userId);
    const meta = p.blockedAt !== undefined ? "bloqueado" : event.shotsPerPerson !== null && used >= event.shotsPerPerson ? "filme acabou" : last ? `última pose ${relativeTime(last, now)}` : `entrou às ${hhmm(p.joinedAt, event.timezone)}`;
    return { id: p.userId, initial: (p.name.trim()[0] ?? "?").toUpperCase(), name: p.name, meta, used, shots: event.shotsPerPerson, blocked: p.blockedAt !== undefined };
  });
  const joined = people.length;
  const missing = event.capacity === null ? 0 : Math.max(0, event.capacity - joined);
  const summary = `${joined}${event.capacity === null ? "" : ` de ${event.capacity}`} ${joined === 1 ? "entrou" : "entraram"} · ${live.length} ${live.length === 1 ? "pose" : "poses"} no filme`;

  return (
    <>
      <AnfitriaoConvidados
        summary={summary} pct={event.capacity ? Math.min(100, Math.round((joined / event.capacity) * 100)) : 0}
        guests={guests} missing={missing}
        onBack={() => router.push(`/painel/${event.id}`)} onInvite={() => router.push(`/painel/${event.id}/compartilhar`)} onRemind={() => void invite()}
        onGuest={(id) => setTarget(people.find((r) => r.participant.userId === id)?.participant)}
      />
      {toast}
      {error && !target && <p role="alert" className="rv-sr-only">{error}</p>}
      {target && (
        <Sheet title={target.blockedAt !== undefined ? `Desbloquear ${target.name}?` : `Bloquear ${target.name}?`} onClose={() => { if (!busy) setTarget(undefined); }}>
          <p className="corpo app-p">{target.blockedAt !== undefined ? "A pessoa volta a poder entrar e postar nesta festa." : "A pessoa não poderá entrar nem postar com esta identidade até você desbloqueá-la. O histórico e as fotos dela continuam no álbum."}</p>
          {error && <p role="alert" className="app-p">{error}</p>}
          <div className="app-stack-sm">
            <Button variant="secundario" block disabled={busy} onClick={() => setTarget(undefined)}>Voltar</Button>
            {target.blockedAt !== undefined
              ? <Button variant="primario" block disabled={busy} onClick={() => void toggle(target)}>{busy ? "Desbloqueando…" : "Desbloquear acesso"}</Button>
              : <Button variant="destrutivo" block disabled={busy} onClick={() => void toggle(target)}>{busy ? "Bloqueando…" : "Bloquear acesso"}</Button>}
          </div>
        </Sheet>
      )}
    </>
  );
}
