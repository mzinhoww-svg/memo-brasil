"use client";

import { useEffect } from "react";

/** Registra o service worker só em produção. Falha de registro não quebra o app. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`).catch(() => undefined);
  }, []);
  return null;
}
