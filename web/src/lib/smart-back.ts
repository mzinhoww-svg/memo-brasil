"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { normalizeShareCode } from "@/domain/share-code";

/**
 * Voltar "de verdade" na área do convidado. O App Router não expõe um `history.length` confiável (conta entradas de
 * outras origens), então cada evento mantém a pilha das rotas internas visitadas: com rota anterior, `router.back()`;
 * sem ela (link direto, notificação, recarga numa tela funda), `router.replace(fallback)` uma única vez. Nunca sai do app.
 */

const MAX = 60;
/** Cópia em memória: vale mesmo sem `sessionStorage`. O armazenamento só atravessa uma recarga da aba. */
const mem = new Map<string, string[]>();
/** Eventos cuja próxima mudança de rota veio de um `replace` nosso (troca a entrada do topo em vez de empilhar). */
const replacing = new Set<string>();

export const navKey = (code: string) => `rv:nav:${code}`;

function load(code: string): string[] {
  const cached = mem.get(code);
  if (cached) return cached;
  try {
    const raw = window.sessionStorage.getItem(navKey(code));
    if (raw) {
      const v: unknown = JSON.parse(raw);
      const stack = v && typeof v === "object" ? (v as { stack?: unknown }).stack : undefined;
      if (Array.isArray(stack) && stack.every((s) => typeof s === "string")) {
        const clean = (stack as string[]).slice(-MAX);
        mem.set(code, clean);
        return clean;
      }
    }
  } catch { /* sem armazenamento: a pilha vive só na memória */ }
  return [];
}

function save(code: string, stack: string[]): void {
  mem.set(code, stack);
  try {
    window.sessionStorage.setItem(navKey(code), JSON.stringify({ depth: stack.length, prev: stack.length > 1 ? stack[stack.length - 2] : null, stack }));
  } catch { /* cota cheia ou bloqueado: segue só em memória */ }
}

/** Esquece a pilha do evento (a pessoa saiu da área do convidado). */
export function clearNav(code: string): void {
  mem.delete(code);
  replacing.delete(code);
  try { window.sessionStorage.removeItem(navKey(code)); } catch { /* ignora */ }
}

/** Registra a rota atual. `popped`: a mudança veio do histórico (voltar/avançar), então desempilha em vez de empilhar. */
export function recordNav(code: string, path: string, popped = false): { depth: number; prev: string | null } {
  const stack = load(code).slice();
  const top = stack[stack.length - 1];
  if (top !== path) {
    if (replacing.delete(code) && stack.length > 0) stack[stack.length - 1] = path;
    else if (popped && stack.length > 1 && stack[stack.length - 2] === path) stack.pop();
    else stack.push(path);
    if (stack.length > MAX) stack.splice(0, stack.length - MAX);
    save(code, stack);
  }
  return { depth: stack.length, prev: stack.length > 1 ? stack[stack.length - 2] : null };
}

/** Profundidade (rotas internas visitadas) e rota anterior do evento. */
export function readNav(code: string): { depth: number; prev: string | null } {
  const stack = load(code);
  return { depth: stack.length, prev: stack.length > 1 ? stack[stack.length - 2] : null };
}

export interface BackRouter { back(): void; replace(href: string): void }

/** Volta pelo histórico quando há rota interna anterior; senão vai ao `fallback` trocando a entrada atual. */
export function smartBack(code: string, router: BackRouter, fallback: string, current?: string): "back" | "fallback" | "stay" {
  if (readNav(code).depth > 1) { router.back(); return "back"; }
  if (current !== undefined && current === fallback) return "stay"; // já está no destino: nada de loop
  replacing.add(code);
  router.replace(fallback);
  return "fallback";
}

/**
 * Carga nova do documento (link digitado ou aberto de fora): a pilha de antes não vale, mesmo com a aba e o
 * `sessionStorage` iguais. Recarregar (`reload`) e voltar/avançar (`back_forward`) mantêm a pilha, o histórico segue o mesmo.
 */
export function startNav(code: string, navigationType: string | undefined): void {
  if (navigationType === "navigate") clearNav(code);
}
let booted = false;
const documentNavigationType = (): string | undefined => {
  try {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return entry?.type;
  } catch { return undefined; }
};

/** Acompanha as rotas internas do evento (uma vez, no layout do convidado). */
export function useNavTracker(code: string): void {
  const path = usePathname();
  const popped = useRef(false);
  useEffect(() => {
    const onPop = () => { popped.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (!code || !path) return;
    if (!booted) { booted = true; startNav(code, documentNavigationType()); }
    recordNav(code, path, popped.current);
    popped.current = false;
  }, [code, path]);
  useEffect(() => () => { if (code) clearNav(code); }, [code]);
}

/** Retorna a função de voltar da tela: histórico quando existe, `fallbackHref` quando a pessoa chegou direto. */
export function useSmartBack(fallbackHref: string): () => void {
  const params = useParams<{ code?: string }>();
  const code = normalizeShareCode(params.code ?? "") ?? "";
  const router = useRouter();
  const path = usePathname();
  return useCallback(() => { smartBack(code, router, fallbackHref, path); }, [code, router, fallbackHref, path]);
}
