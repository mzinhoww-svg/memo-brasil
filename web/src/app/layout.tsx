import type { Metadata, Viewport } from "next";
import { Birthstone_Bounce, Great_Vibes, Pinyon_Script } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/theme";
import { paletteCss } from "@/lib/event-theme";

// Fontes do evento (só no nome do evento). Bricolage e Instrument Serif são locais (tokens.css).
const birthstone = Birthstone_Bounce({ weight: "400", subsets: ["latin"], variable: "--fonte-birthstone", display: "swap" });
const pinyon = Pinyon_Script({ weight: "400", subsets: ["latin"], variable: "--fonte-pinyon", display: "swap" });
const vibes = Great_Vibes({ weight: "400", subsets: ["latin"], variable: "--fonte-vibes", display: "swap" });

export const metadata: Metadata = {
  title: { default: "MemoriesMT", template: "%s · MemoriesMT" },
  description: "A festa vista por todo mundo.",
  applicationName: "MemoriesMT",
  icons: { icon: "/brand/memoriesmt-selo.svg", apple: "/pwa/icon-192.png" },
  appleWebApp: { capable: true, title: "MemoriesMT", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#141211" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dia" suppressHydrationWarning className={`${birthstone.variable} ${pinyon.variable} ${vibes.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: paletteCss() }} />
      </head>
      <body>
        <a className="mm-skip" href="#conteudo">Ir para o conteúdo</a>
        <ThemeProvider>
          <div id="conteudo">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
