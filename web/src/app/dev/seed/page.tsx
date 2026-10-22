import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev-tools";
import { Seeder } from "./seeder";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Rota de homologação: grava a festa fictícia no adaptador ativo para os testes E2E. Fora do build de desenvolvimento (e em produção) responde 404. */
export default function DevSeed() {
  if (!devToolsEnabled() || process.env.VERCEL_ENV === "production") notFound();
  return <Seeder />;
}
