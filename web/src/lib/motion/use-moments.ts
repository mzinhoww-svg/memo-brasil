"use client";
/* Ganchos finos sobre o kit do designer (revela-motion.ts). Só chamam o kit: curvas e durações são dele. */
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { flyTo, heartPop, odometer } from "./revela-motion";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Liga `odometer(el, valor)` a um elemento: os dígitos rolam quando o valor muda. `null` não escreve nada. */
export function useOdometer<T extends HTMLElement>(value: number | string | null, minDigits = 2): RefObject<T | null> {
  const ref = useRef<T>(null);
  // a cada render: o kit só move a fita se o valor mudou, e assim um disparo que não foi confirmado volta ao número certo
  useIsoLayoutEffect(() => {
    if (ref.current && value !== null) odometer(ref.current, value, minDigits);
  });
  return ref;
}

/** Roda `run` uma única vez, quando `ready` fica verdadeiro (momentos que só acontecem uma vez por tela). */
export function useMomentOnce(ready: boolean, run: () => void | (() => void)): void {
  const done = useRef(false);
  const runRef = useRef(run);
  useIsoLayoutEffect(() => { runRef.current = run; });
  // antes da pintura: o kit começa em "invisível" (fill: backwards) e a tela não pisca no estado final
  useIsoLayoutEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    return runRef.current();
  }, [ready]);
}

const SEEN = new Set<string>();
/** Verdadeiro só na primeira vez que a foto `id` abre nesta sessão (a foto "revela" com `rv-develop`). */
export function useFirstOpen(id: string | undefined): boolean {
  const [state, setState] = useState<{ id?: string; first: boolean }>({ first: false });
  if (state.id !== id) setState({ id, first: id !== undefined && !SEEN.has(id) });
  useEffect(() => { if (id) SEEN.add(id); }, [id]);
  return state.id === id && state.first;
}

/** Coração que estoura no botão tocado (curtir e reagir). Use no `onClick`, antes de chamar a ação. */
export function popHeart(e: MouseEvent<HTMLElement>): void {
  void heartPop(e.currentTarget);
}

/** Uma cópia pequena da pose sai de `from` e voa até o item "Minhas" das abas (ou, sem abas na tela, até `fallback`). */
export function flyPose(url: string, from: HTMLElement | null, fallback?: HTMLElement | null): Promise<void> {
  const target = document.querySelector<HTMLElement>('[data-tab="minhas"]') ?? fallback ?? null;
  if (!from || !target) return Promise.resolve();
  const r = from.getBoundingClientRect();
  const ghost = document.createElement("img");
  ghost.src = url;
  ghost.alt = "";
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("data-testid", "pose-voando");
  ghost.style.cssText = `position:fixed;left:${r.left + r.width / 2 - 45}px;top:${r.top + r.height / 2 - 60}px;width:90px;height:120px;object-fit:cover;border:6px solid var(--paper);border-bottom-width:18px;border-radius:2px;z-index:90;pointer-events:none`;
  document.body.append(ghost);
  return flyTo(ghost, target).finally(() => ghost.remove());
}
