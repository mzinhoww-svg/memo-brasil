"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { normalizePath } from "./classify";

const SESSION_KEY = "mm-visita";

/** Sinal de "não rastrear" do navegador: nenhuma medição. */
const optedOut = () => navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

/**
 * Mede cada página aberta (caminho normalizado, sem cookies e sem identificar a pessoa). A primeira página da visita (aba) leva a origem:
 * referência e UTM; as seguintes só o caminho. O servidor completa aparelho, país e o "visitante do dia" a partir dos cabeçalhos.
 */
export function AccessTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_MM_BACKEND !== "supabase") return;
      if (!pathname || !normalizePath(pathname) || optedOut()) return;
      let entry = false;
      try { entry = sessionStorage.getItem(SESSION_KEY) !== "1"; sessionStorage.setItem(SESSION_KEY, "1"); } catch { entry = false; }
      const q = new URLSearchParams(window.location.search);
      const body = JSON.stringify({
        path: pathname, entry,
        ...(entry ? { ref: document.referrer || undefined, utm_source: q.get("utm_source") ?? undefined, utm_medium: q.get("utm_medium") ?? undefined, utm_campaign: q.get("utm_campaign") ?? undefined } : {}),
      });
      if (!navigator.sendBeacon?.("/api/acesso", new Blob([body], { type: "text/plain" }))) void fetch("/api/acesso", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => undefined);
    } catch { /* medir é secundário */ }
  }, [pathname]);
  return null;
}
