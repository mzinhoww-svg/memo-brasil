import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev-tools";
import { DesignGuide } from "./guide";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Rota técnica: guia vivo dos componentes. Fora do build de desenvolvimento (e em produção) responde 404. */
export default function Design() {
  if (!devToolsEnabled() || process.env.VERCEL_ENV === "production") notFound();
  return <DesignGuide />;
}
