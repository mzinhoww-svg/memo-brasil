import { ScreenSkeleton } from "@/components/revela/ScreenSkeleton";

/** Esqueleto enquanto a rota chega (mesmo quadro da tela final). */
export default function Loading() {
  return <main className="app-col app-col--card app-fluid"><ScreenSkeleton variant="camera" label="Abrindo o assistente…" /></main>;
}
