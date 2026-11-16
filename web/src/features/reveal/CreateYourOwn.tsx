"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/revela";

const keyOf = (eventId: string, userId: string) => `mm-crie-o-seu-${eventId}-${userId}`;
const dismissed = new Set<string>(); // vale mesmo sem localStorage (modo privado)
const read = (key: string) => { if (dismissed.has(key)) return true; try { return localStorage.getItem(key) === "1"; } catch { return false; } };
const EVENT = "mm-crie-o-seu";
const write = (key: string) => {
  dismissed.add(key);
  try { localStorage.setItem(key, "1"); } catch { /* sem armazenamento: aparece de novo na próxima visita */ }
  window.dispatchEvent(new Event(EVENT));
};
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
};

/** Depois da revelação, uma vez por convidado e dispensável: convida a criar o próprio evento (grátis até 10 convidados). */
export function CreateYourOwn({ eventId, userId }: { eventId: string; userId: string }) {
  const key = keyOf(eventId, userId);
  // no servidor e na hidratação começa fechado: não pisca antes de ler o que a pessoa já dispensou
  const open = useSyncExternalStore(subscribe, () => !read(key), () => false);
  if (!open) return null;
  const close = () => write(key);
  return (
    <aside className="app-card" aria-labelledby="crie-h" data-testid="crie-o-seu">
      <div className="app-between">
        <h2 id="crie-h" className="titulo-tela app-h1">Tem uma festa vindo aí?</h2>
        <button type="button" className="rv-btn rv-btn--texto" aria-label="Dispensar convite para criar evento" onClick={close}><Icon name="fechar" decorative /></button>
      </div>
      <p className="corpo app-p">Faça a sua do mesmo jeito. Até 10 convidados é grátis.</p>
      <Link className="rv-btn rv-btn--secundario rv-btn--bloco" href="/" onClick={() => write(key)}>Criar o meu evento</Link>
    </aside>
  );
}
