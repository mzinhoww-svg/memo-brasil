import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/revela/ScreenSkeleton";
import { OfertaFromUrl } from "./OfertaFromUrl";

export const metadata: Metadata = {
  title: { absolute: "Seu resultado | Revela" },
  description: "O resultado do seu teste e a câmera do casamento para até 50 convidados.",
  robots: { index: false, follow: false },
};

export default function OfertaPage() {
  return (
    <main className="app-col app-col--card app-fluid">
      <Suspense fallback={<ScreenSkeleton variant="camera" label="Abrindo o seu resultado…" />}>
        <OfertaFromUrl />
      </Suspense>
    </main>
  );
}
