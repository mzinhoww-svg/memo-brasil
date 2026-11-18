import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/features/app/provider";
import { SiteFooter } from "@/components/revela/SiteFooter";
import { StorageBanner } from "@/components/revela/StorageBanner";
import { AccessTracker } from "@/lib/access/Tracker";
import { RegisterServiceWorker } from "@/lib/register-sw";
import { siteOrigin } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "Revela", template: "%s · Revela" },
  description: "Os convidados fotografam pelo celular, sem app, e as fotos se revelam juntas na hora marcada. Grátis até 10 convidados; R$ 147 até 150.",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Revela", url: "/" },
  applicationName: "Revela",
  icons: { icon: "/revela/logos/revela-mark.svg", apple: "/pwa/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Revela", statusBarStyle: "black-translucent" },
};

/** Tema Noite fixo (tokens.css: --bg). A cor da barra do sistema precisa ser literal; ela acompanha `--bg`. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content", // o teclado virtual encolhe a página (folhas e formulários não ficam por baixo dele)
  themeColor: "#0E0C0B",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <body>
        <a className="rv-skip" href="#conteudo">Ir para o conteúdo</a>
        <RegisterServiceWorker />
        <AccessTracker />
        <AppProvider>
          <StorageBanner />
          <div id="conteudo">{children}</div>
          <SiteFooter />
        </AppProvider>
      </body>
    </html>
  );
}
