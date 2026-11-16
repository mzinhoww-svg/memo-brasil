import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev-tools";
import { COMPONENTS } from "@/revela/screens";
import { SCREENS } from "@/revela/registry";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Comparação com a referência: cada tela com os dados do desenho (fixture), no quadro do aparelho. Só no build de desenvolvimento. */
export default async function DevRevelaScreen({ params }: { params: Promise<{ screen: string }> }) {
  if (!devToolsEnabled() || process.env.VERCEL_ENV === "production") notFound();
  const { screen } = await params;
  const C = COMPONENTS[screen];
  if (!C) notFound();
  const meta = SCREENS.find((s) => s.html === screen);
  return <div className="dev-frame" data-screen={meta?.id}><C /></div>;
}
