"use client";
/* Ganchos finos sobre revela-motion.ts: só ligam as funções do kit ao ciclo de vida do React. Não reimplementam nada. */
import { useEffect, useState, type RefObject } from "react";
import { flipWrap, reduced, tilt } from "./revela-motion";

/** `false` no primeiro quadro e `true` logo depois: dá o `data-open` que dispara a transição de entrada do kit. */
export function useOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return open;
}

/** Inclinação 3D do kit (`tilt`) ligada a um elemento enquanto ele existir. */
export function useTilt<T extends HTMLElement>(ref: RefObject<T | null>, max?: number): void {
  useEffect(() => {
    const el = ref.current;
    return el ? tilt(el, max) : undefined;
  }, [ref, max]);
}

/** Devolve o `src` a mostrar: na troca, gira a imagem com `flipWrap` e só então assume o novo valor. */
export function useFlipSrc(ref: RefObject<HTMLImageElement | null>, src: string): string {
  const [shown, setShown] = useState(src);
  useEffect(() => {
    if (src === shown) return;
    let alive = true;
    const img = ref.current;
    // sem Web Animations (navegador antigo, jsdom) a troca é seca
    const turn = img && typeof img.animate === "function" ? flipWrap(img, src) : Promise.resolve();
    void turn.then(() => { if (alive) setShown(src); });
    return () => { alive = false; };
  }, [ref, src, shown]);
  return shown;
}

/** Presença com saída: `mounted` fica `true` até a animação `rv-toast-out` terminar (`leaveMs`). */
export function usePresence(show: boolean, leaveMs = 200): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(show);
  const [prev, setPrev] = useState(show);
  if (show !== prev) {
    setPrev(show);
    if (show) setMounted(true);
  }
  useEffect(() => {
    if (show) return;
    const t = setTimeout(() => setMounted(false), reduced() ? 0 : leaveMs);
    return () => clearTimeout(t);
  }, [show, leaveMs]);
  return { mounted: mounted || show, leaving: !show && mounted };
}
