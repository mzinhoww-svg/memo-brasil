"use client";

import { plural } from "@/lib/plural";
import { useEffect, useState } from "react";
import { Button, DataList, Sheet } from "@/components/revela";
import { guestRanking, removeGuest, unblockGuest } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import type { Participant } from "@/repositories";

export default function Convidados() {
  const { repos } = useApp();
  const { event, photos, participants, refresh } = useAdmin();
  const [rows, setRows] = useState<{ participant: Participant; photos: number }[]>([]);
  const [removing, setRemoving] = useState<Participant | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    guestRanking(repos, event).then((r) => { if (active) { setRows(r); setError(undefined); } }).catch(() => { if (active) setError("Não deu para carregar os convidados. Tente atualizar a página."); });
    return () => { active = false; };
  }, [repos, event, photos, participants]);
  async function moderate(participant: Participant, unblock = false) {
    if (busy) return;
    setBusy(true); setError(undefined);
    try {
      await (unblock ? unblockGuest : removeGuest)(repos, event.id, participant.userId);
      setRemoving(undefined);
      await refresh();
    } catch { setError("Não deu para atualizar o acesso. Tente de novo."); }
    finally { setBusy(false); }
  }
  const silent = rows.filter((r) => r.photos === 0).length;

  return (
    <>
      <h1 className="titulo-pagina app-h1">Convidados</h1>
      {error && <p role="alert" className="app-p">{error}</p>}
      {rows.length === 0 ? (
        <p className="app-p app-muted">Ninguém entrou ainda. Compartilhe o código <strong>{event.code}</strong> ou imprima os QR Codes.</p>
      ) : (
        <>
          <DataList head={["Convidados", "Fotos"]} rows={rows.filter((r) => r.participant.userId !== event.hostId).map((r) => ({ key: r.participant.userId, name: r.participant.name, kind: r.participant.blockedAt !== undefined ? "Bloqueado" : r.participant.tableLabel, value: String(r.photos), alert: r.photos === 0 }))} note={silent ? `${silent} ${plural(silent, "convidado ainda não postou", "convidados ainda não postaram")}. Vale um aviso no Agora.` : undefined} />
          <section className="app-stack-sm" aria-labelledby="rem">
            <h2 id="rem" className="titulo-card app-h1">Acesso à festa</h2>
            {rows.filter((r) => r.participant.userId !== event.hostId).map((r) => (
              <div key={r.participant.userId} className="app-between" style={{ maxWidth: 340 }}>
                <span>{r.participant.name}{r.participant.blockedAt !== undefined ? " · Bloqueado" : ""}</span>
                {r.participant.blockedAt !== undefined
                  ? <Button variant="secundario" small disabled={busy} onClick={() => void moderate(r.participant, true)}>Desbloquear</Button>
                  : <Button variant="destrutivo" small disabled={busy} onClick={() => { setError(undefined); setRemoving(r.participant); }}>Bloquear</Button>}
              </div>
            ))}
          </section>
        </>
      )}
      {removing && (
        <Sheet title={`Bloquear ${removing.name}?`} onClose={() => { if (!busy) setRemoving(undefined); }}>
          <p className="corpo app-p">A pessoa não poderá entrar nem postar com esta identidade até você desbloqueá-la. O histórico e as fotos dela continuam no álbum.</p>
          {error && <p role="alert" className="app-p">{error}</p>}
          <div className="app-stack-sm">
            <Button variant="secundario" block disabled={busy} onClick={() => setRemoving(undefined)}>Voltar</Button>
            <Button variant="destrutivo" block disabled={busy} onClick={() => void moderate(removing)}>{busy ? "Bloqueando…" : "Bloquear acesso"}</Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
