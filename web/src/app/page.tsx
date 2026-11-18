import type { Metadata } from "next";
import { HomeHero } from "@/features/home/HomeHero";
import { Landing } from "@/features/marketing/Landing";
import { loadPublicTiers } from "@/features/marketing/pricing";

const DESCRIPTION = "Os convidados fotografam pelo celular, sem app, e as fotos se revelam juntas na hora marcada. Grátis até 10 convidados; R$ 147 até 150.";

export const metadata: Metadata = {
  title: { absolute: "Fotos do casamento tiradas pelos convidados | Revela" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "pt_BR", siteName: "Revela", title: "Fotos do casamento tiradas pelos convidados", description: DESCRIPTION, url: "/" },
};

/** Catálogo público relido a cada hora (preços na página que o Google indexa). */
export const revalidate = 3600;

/** Home: o topo do app (entrada do anfitrião) e, abaixo, as seções de texto renderizadas no servidor. */
export default async function Home() {
  const tiers = await loadPublicTiers();
  return (
    <>
      <HomeHero />
      <Landing tiers={tiers} />
    </>
  );
}
