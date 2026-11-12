import { ScreenSkeleton } from "@/components/revela/ScreenSkeleton";

/** Esqueleto enquanto a rota chega (mesmo quadro da tela final). */
export default function Loading() {
  return <ScreenSkeleton variant="grade" label="Carregando a galeria…" />;
}
