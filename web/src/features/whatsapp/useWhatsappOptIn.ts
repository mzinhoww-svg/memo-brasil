"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backendMode } from "@/lib/supabase/env";
import { getWhatsappStatus, requestWhatsappLink, subscribeWhatsappStatus, WhatsappError, type WhatsappLink, type WhatsappStatus } from "./api";
import { WA_COPY } from "./copy";

export type OptInPhase = "idle" | "opening" | "waiting" | "error";
/** Reserva do Realtime: o webhook chega em segundos e o Realtime avisa na hora; o polling só cobre conexão que caiu. */
export const POLL_MS = 3000;
export const WAIT_MS = 15 * 60_000; // validade do código de uso único
export const OPENING_MS = 1500; // "Abrindo o WhatsApp…" antes de "Aguardando confirmação…"

// Um link por evento, compartilhado entre as variantes da mesma tela (linha, lembrete, passo): pré-gerado ao renderizar, renovado
// antes de vencer. Pedir o código antes do toque é o que deixa o toque instantâneo (sem aba em branco nem espera de rede).
const cache = new Map<string, { value?: WhatsappLink; pending?: Promise<WhatsappLink> }>();
export function __resetWhatsappLinkCache() { cache.clear(); }

function fresh(eventId: string, now = Date.now()): WhatsappLink | undefined {
  const v = cache.get(eventId)?.value;
  return v && v.validUntil > now ? v : undefined;
}
async function ensureLink(eventId: string, force = false): Promise<WhatsappLink> {
  const hit = cache.get(eventId);
  if (!force && fresh(eventId)) return hit!.value!;
  if (hit?.pending) return hit.pending;
  const pending = requestWhatsappLink(eventId).then(
    (value) => { cache.set(eventId, { value }); return value; },
    (e) => { cache.delete(eventId); throw e; },
  );
  cache.set(eventId, { ...hit, pending });
  return pending;
}

/**
 * Estado e ações do aviso por WhatsApp. O link wa.me é pedido em segundo plano assim que o botão aparece (aquece a Edge Function e
 * gera o código) e renovado antes dos 15 min; o toque é um <a href> comum, que abre o WhatsApp na hora, inclusive no iOS. Depois do
 * toque: Realtime da própria linha + revalidação ao voltar o foco + polling de reserva, até o webhook gravar o opt-in.
 */
export function useWhatsappOptIn(eventId: string) {
  const live = backendMode() === "supabase";
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [phase, setPhase] = useState<OptInPhase>("idle");
  const [error, setError] = useState<string | undefined>();
  const [link, setLink] = useState<WhatsappLink | undefined>(() => fresh(eventId));
  const until = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const refresh = useCallback(async () => {
    if (!live) return;
    const s = await getWhatsappStatus(eventId).catch(() => null);
    if (alive.current && s) setStatus(s);
  }, [eventId, live]);

  useEffect(() => { void refresh(); }, [refresh]);

  const optin = status?.optin === true;
  const wants = live && !!status && status.enabled && status.eligible && !optin;

  const load = useCallback(async (force = false) => {
    try {
      const v = await ensureLink(eventId, force);
      if (!alive.current) return;
      setLink(v);
      setError(undefined);
      setPhase((p) => (p === "error" ? "idle" : p));
    } catch (e) {
      if (!alive.current) return;
      setLink(undefined);
      setError(WA_COPY.errors[e instanceof WhatsappError ? e.kind : "rede"]);
      setPhase("error");
    }
  }, [eventId]);

  // pré-gera ao aparecer e renova antes de vencer (e ao voltar para a aba depois de muito tempo)
  useEffect(() => {
    if (!wants) return;
    if (!link || link.validUntil <= Date.now()) {
      const now0 = setTimeout(() => void load(), 0); // fora do corpo do efeito (o estado muda depois da resposta)
      return () => clearTimeout(now0);
    }
    const t = setTimeout(() => void load(true), Math.max(1000, link.validUntil - Date.now()));
    const onVisible = () => { if (document.visibilityState === "visible" && link.validUntil <= Date.now()) void load(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [wants, link, load]);

  // depois do toque: Realtime + foco + polling de reserva, até o opt-in chegar ou o código vencer
  useEffect(() => {
    if ((phase !== "waiting" && phase !== "opening") || optin) return;
    const unsub = subscribeWhatsappStatus(eventId, () => void refresh());
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() > until.current) { setPhase("idle"); return; }
      void refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => { unsub(); clearInterval(id); document.removeEventListener("visibilitychange", tick); window.removeEventListener("focus", tick); };
  }, [phase, optin, refresh, eventId]);

  useEffect(() => {
    if (phase !== "opening") return;
    const t = setTimeout(() => setPhase((p) => (p === "opening" ? "waiting" : p)), OPENING_MS);
    return () => clearTimeout(t);
  }, [phase]);

  /** Chamado no clique do <a href={link}>: o navegador já está abrindo o WhatsApp; aqui só muda o estado da tela. */
  const opened = useCallback(() => {
    until.current = Date.now() + WAIT_MS;
    setError(undefined);
    setPhase("opening");
  }, []);

  return {
    live, status, optin, error, refresh,
    phase: optin ? ("idle" as OptInPhase) : phase,
    /** link pronto para o toque; undefined = preparando (ou erro) */
    link: optin ? undefined : link?.link,
    opened,
    retry: () => void load(true),
  };
}
