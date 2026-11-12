import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/features/app/provider";
import { SiteFooter } from "@/components/revela/SiteFooter";
import { StorageBanner } from "@/components/revela/StorageBanner";
import { RegisterServiceWorker } from "@/lib/register-sw";

export const metadata: Metadata = {
  title: { default: "Revela", template: "%s · Revela" },
  description: "A câmera descartável coletiva para eventos. Cada convidado tem suas poses, e a festa revela junta.",
  applicationName: "Revela",
  icons: { icon: "/revela/logos/revela-mark.svg", apple: "/pwa/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Revela", statusBarStyle: "black-translucent" },
};

/** Tema Noite fixo (tokens.css: --bg). A cor da barra do sistema precisa ser literal; ela acompanha `--bg`. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E0C0B",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <body>
        <a className="rv-skip" href="#conteudo">Ir para o conteúdo</a>
        <RegisterServiceWorker />
        <AppProvider>
          <StorageBanner />
          <div id="conteudo">{children}</div>
          <SiteFooter />
        </AppProvider>
      </body>
    </html>
  );
}
