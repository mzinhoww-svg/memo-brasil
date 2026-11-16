import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { devToolsEnabled } from "@/lib/dev-tools";
import { PlanoPainelHarness } from "./harness";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Bancada de homologação: o seletor de planos dentro do quadro do painel com planos de exemplo, sem Supabase nem pagamento.
 * Serve ao E2E de layout (botão no rodapé fixo, erro longo, tela baixa) nos dois ramos do build (com e sem NEXT_PUBLIC_VALIDAPAY_CHECKOUT).
 * Fora do build de desenvolvimento (e em produção) responde 404.
 */
export default function DevPlanoPainel() {
  if (!devToolsEnabled() || process.env.VERCEL_ENV === "production") notFound();
  return <Suspense fallback={null}><PlanoPainelHarness /></Suspense>;
}
