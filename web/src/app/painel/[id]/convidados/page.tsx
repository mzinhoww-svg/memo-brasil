"use client";

import { useEffect, useState } from "react";
import { Button, DataList, Sheet } from "@/components/memoriesmt";
import { guestRanking, removeGuest } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import type { Participant } from "@/repositories";

export default function Convidados() {
  const { repos } = useApp();
  const { event, photos, participants, refresh } = useAdmin();
  const [rows, setRows] = useState<{ participant: Participant; photos: number }[]>([]);
  const [removing, setRemoving] = useState<Participant | undefined>();
  useEffect(() => void guestRanking(repos, event).then(setRows), [repos, event, photos, participants]);
  const silent = rows.filter((r) => r.photos === 0).length;

  return (
    <>
      <h1 className="titulo-pagina app-h1">Convidados</h1>
      {rows.length === 0 ? (
        <p className="app-p app-muted">Ninguém entrou ainda. Compartilhe o código <strong>{event.code}</strong> ou imprima os QR Codes.</p>
      ) : (
        <>
          <DataList head={["Convidados", "Fotos"]} rows={rows.map((r) => ({ key: r.participant.userId, name: r.participant.name, kind: r.participant.tableLabel, value: String(r.photos), alert: r.photos === 0 }))} note={silent ? `${silent} ${silent === 1 ? "convidado ainda não postou" : "convidados ainda não postaram"}. Vale um aviso no Agora.` : undefined} />
          <section className="app-stack-sm" aria-labelledby="rem">
            <h2 id="rem" className="titulo-card app-h1">Remover da festa</h2>
            {rows.map((r) => (
              <div key={r.participant.userId} className="app-between" style={{ maxWidth: 340 }}>
                <span>{r.participant.name}</span>
                <Button variant="destrutivo" small onClick={() => setRemoving(r.participant)}>Remover</Button>
              </div>
            ))}
          </section>
        </>
      )}
      {removing && (
        <Sheet title={`Remover ${removing.name}?`} onClose={() => setRemoving(undefined)}>
          <p className="corpo app-p">A pessoa sai da lista e não posta mais. As fotos dela continuam no álbum até você removê-las em Conteúdo.</p>
          <div className="app-stack-sm">
            <Button variant="destrutivo" block onClick={async () => { await removeGuest(repos, event.id, removing.userId); setRemoving(undefined); await refresh(); }}>Remover da festa</Button>
            <Button variant="secundario" block onClick={() => setRemoving(undefined)}>Voltar</Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
