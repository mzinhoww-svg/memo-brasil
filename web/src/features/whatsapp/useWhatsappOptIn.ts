"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backendMode } from "@/lib/supabase/env";
import { getWhatsappStatus, requestWhatsappOptin, WhatsappError, type WhatsappStatus } from "./api";
import { WA_COPY } from "./copy";

export type OptInPhase = "idle" | "opening" | "waiting" | "error";
export const POLL_MS = 4000;
export const WAIT_MS = 15 * 60_000; // validade do código de uso único

/**
 * Estado e ações do aviso por WhatsApp. Ao tocar: abre a aba na hora do toque (senão o navegador bloqueia), pede um código NOVO,
 * leva a aba ao wa.me e faz polling leve (só com a aba visível, até 15 min) até o webhook gravar o opt-in. Revalida ao voltar o foco.
 */
export function useWhatsappOptIn(eventId: string) {
  const live = backendMode() === "supabase";
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [phase, setPhase] = useState<OptInPhase>("idle");
  const [error, setError] = useState<string | undefined>();
  const [fallbackLink, setFallbackLink] = useState<string | undefined>();
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
  useEffect(() => {
    if (phase !== "waiting" || optin) return; // ativado: acabou a espera, para de consultar
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() > until.current) { setPhase("idle"); return; }
      void refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); window.removeEventListener("focus", tick); };
  }, [phase, optin, refresh]);

  const start = useCallback(async () => {
    if (phase === "opening") return;
    setError(undefined);
    setFallbackLink(undefined);
    setPhase("opening");
    let win: Window | null = null;
    try { win = window.open("", "_blank"); if (win) win.opener = null; } catch { win = null; }
    try {
      const link = await requestWhatsappOptin(eventId);
      if (!alive.current) { win?.close(); return; }
      if (win && !win.closed) win.location.href = link; else setFallbackLink(link);
      until.current = Date.now() + WAIT_MS;
      setPhase("waiting");
    } catch (e) {
      win?.close();
      if (!alive.current) return;
      setError(WA_COPY.errors[e instanceof WhatsappError ? e.kind : "rede"]);
      setPhase("error");
    }
  }, [eventId, phase]);

  return { live, status, phase: optin ? ("idle" as OptInPhase) : phase, error, fallbackLink: optin ? undefined : fallbackLink, optin, start, refresh };
}
