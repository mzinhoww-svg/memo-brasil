"use client";

import { Button } from "./Button";

/** "Continuar como …": volta a uma identidade já usada neste aparelho (ex.: o anfitrião). */
export function KnownPeople({ people, onPick }: { people: { id: string; name: string }[]; onPick: (id: string) => void }) {
  if (people.length === 0) return null;
  return (
    <section className="app-stack-sm" aria-labelledby="conhecidos">
      <h2 id="conhecidos" className="titulo-card app-h1">Continuar como</h2>
      {people.map((p) => <Button key={p.id} variant="secundario" block onClick={() => onPick(p.id)}>{p.name}</Button>)}
    </section>
  );
}
