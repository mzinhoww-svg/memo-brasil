"use client";

import Link from "next/link";
import { useHostNav } from "@/features/events/guest-context";

/** Faixa do anfitrião no Feed: ele está vendo a festa como convidado e tem como voltar ao painel. Nada para quem não é anfitrião. */
export function HostBar() {
  const host = useHostNav();
  if (!host) return null;
  return (
    <p className="rv-caption" data-testid="host-bar" style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
      <span>Você está vendo como convidado.</span>
      <Link href={host.panelHref} className="link" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>Voltar ao painel</Link>
    </p>
  );
}
