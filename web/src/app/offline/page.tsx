import type { Metadata } from "next";

import { OfflineRetry } from "./Retry";

export const metadata: Metadata = { title: "Sem sinal" };

/** 28 · Sem internet (fallback do service worker). Sem contagem de fotos na fila: o fallback estático não conhece o evento. */
export default function Offline() {
  return (
    <main>
      <OfflineRetry message="Sem sinal agora. Toque aqui para tentar de novo." />
    </main>
  );
}
