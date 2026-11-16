"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmSheet, Field, Sheet } from "@/components/revela";
import { joinMoment, splitMoment } from "@/domain/moments";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import { updateSettings } from "@/features/events/service";
import { PainelProgramacao } from "@/revela/screens/PainelProgramacao";
import { useFlash } from "@/revela/painel-ui";

interface Draft { time: string; name: string }
const MAX = 12;

/** Ordena por horário; momentos sem horário vão depois, na ordem em que estavam. */
const sortMoments = (list: Draft[]) => [...list].sort((a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : a.time ? -1 : b.time ? 1 : 0));

/** Programação e local (17f): o local do evento e os momentos que os convidados escolhem ao postar. */
export default function Momentos() {
  const router = useRouter();
  const { repos } = useApp();
  const { event, refresh } = useAdmin();
  const saved = event.moments.map((m) => { const s = splitMoment(m); return { time: s.time ?? "", name: s.name }; });
  const [place, setPlace] = useState(event.place ?? "");
  const [moments, setMoments] = useState<Draft[]>(saved);
  const [editing, setEditing] = useState<{ index: number; time: string; name: string } | undefined>();
  const [removing, setRemoving] = useState<number | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [toast, flash] = useFlash();
  const raw = (l: Draft[]) => l.map((m) => joinMoment(m.time, m.name));
  const dirty = place.trim() !== (event.place ?? "") || JSON.stringify(raw(moments)) !== JSON.stringify(event.moments);

  function apply() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return setFormError("Escreva o nome do momento.");
    if (moments.some((m, i) => i !== editing.index && m.name.toLowerCase() === name.toLowerCase())) return setFormError("Esse momento já existe.");
    const next = [...moments];
    if (editing.index >= moments.length) next.push({ time: editing.time, name }); else next[editing.index] = { time: editing.time, name };
    setMoments(sortMoments(next));
    setEditing(undefined);
    setFormError(undefined);
  }
  async function save() {
    if (!moments.length) return setError("Deixe pelo menos um momento.");
    setSaving(true);
    setError(undefined);
    try {
      const r = await updateSettings(repos, event.id, { place: place.trim() || undefined, moments: raw(moments) });
      if (!r.ok) throw new Error(r.reason);
      await refresh();
      flash("Programação salva.");
    } catch { setError("Não foi possível salvar. Tente de novo."); }
    finally { setSaving(false); }
  }

  return (
    <>
      <PainelProgramacao
        place={place} moments={moments} canSave={dirty} saving={saving} error={error}
        onBack={() => router.push(`/painel/${event.id}`)}
        onPlace={setPlace}
        onEdit={(i) => { setFormError(undefined); setEditing({ index: i, time: moments[i].time, name: moments[i].name }); }}
        onAdd={() => {
          if (moments.length >= MAX) return setError(`São no máximo ${MAX} momentos.`);
          setError(undefined); setFormError(undefined); setEditing({ index: moments.length, time: "", name: "" });
        }}
        onSave={() => void save()}
      />
      {toast}
      {editing && (
        <Sheet title={editing.index >= moments.length ? "Novo momento" : "Editar momento"} onClose={() => setEditing(undefined)}>
          <form className="app-stack-sm" onSubmit={(e) => { e.preventDefault(); apply(); }} noValidate>
            <Field label="Nome do momento" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={30} placeholder="Ex.: Corte do bolo" error={formError} />
            <Field label="Horário (opcional)" type="time" value={editing.time} onChange={(e) => setEditing({ ...editing, time: e.target.value })} />
            <Button type="submit" block>Pronto</Button>
            {editing.index < moments.length && moments.length > 1 && <Button variant="destrutivo" block onClick={() => { setRemoving(editing.index); setEditing(undefined); }}>Remover momento</Button>}
          </form>
        </Sheet>
      )}
      {removing !== undefined && (
        <ConfirmSheet title={`Remover momento ${moments[removing]?.name ?? ""}?`} body="As fotos já tiradas nesse momento continuam no álbum." confirmLabel="Remover momento" onCancel={() => setRemoving(undefined)} onConfirm={() => { setMoments(moments.filter((_, i) => i !== removing)); setRemoving(undefined); }} />
      )}
    </>
  );
}
