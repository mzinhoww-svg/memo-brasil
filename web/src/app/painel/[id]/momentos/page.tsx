"use client";

import { useState } from "react";
import { Button, Chip, ConfirmSheet, Chips, Field, Progress } from "@/components/revela";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import { updateSettings } from "@/features/events/service";

export default function Momentos() {
  const { repos } = useApp();
  const { event, photos, refresh } = useAdmin();
  const [name, setName] = useState("");
  const [removing, setRemoving] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const counts = event.moments.map((m) => ({ m, n: photos.filter((p) => p.moment === m && p.status !== "removida").length }));
  const max = Math.max(1, ...counts.map((c) => c.n));

  async function add() {
    const v = name.trim();
    if (!v) return setError("Escreva o nome do momento.");
    if (event.moments.some((m) => m.toLowerCase() === v.toLowerCase())) return setError("Esse momento já existe.");
    if (event.moments.length >= 12) return setError("São no máximo 12 momentos.");
    await updateSettings(repos, event.id, { moments: [...event.moments, v] });
    setName("");
    setError(undefined);
    await refresh();
  }
  async function remove(m: string) {
    if (event.moments.length <= 1) return;
    await updateSettings(repos, event.id, { moments: event.moments.filter((x) => x !== m) });
    await refresh();
  }

  return (
    <>
      <h1 className="titulo-pagina app-h1">Momentos</h1>
      <p className="app-p app-muted">Os convidados escolhem um momento ao postar. Eles também filtram o Explorar.</p>
      <section className="app-stack-sm" aria-labelledby="rank">
        <h2 id="rank" className="titulo-card app-h1">Ranking</h2>
        {counts.map((c) => <Progress key={c.m} variant="evento" label={c.m} status={c.n.toLocaleString("pt-BR")} value={(c.n / max) * 100} />)}
      </section>
      <section className="app-stack-sm" aria-labelledby="lista">
        <h2 id="lista" className="titulo-card app-h1">Lista</h2>
        <Chips label="Momentos do evento">
          {event.moments.map((m) => <Chip key={m} variant="filtro" onClick={() => setRemoving(m)}>{`Remover ${m}`}</Chip>)}
        </Chips>
        <form className="app-stack-sm app-form-col" onSubmit={(e) => { e.preventDefault(); void add(); }} noValidate>
          <Field label="Novo momento" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Ex.: Corte do bolo" error={error} />
          <Button type="submit" variant="secundario">Adicionar momento</Button>
        </form>
      </section>
      {removing && <ConfirmSheet title={`Remover momento ${removing}?`} onCancel={() => setRemoving(undefined)} onConfirm={async () => { await remove(removing); setRemoving(undefined); }} />}
    </>
  );
}
