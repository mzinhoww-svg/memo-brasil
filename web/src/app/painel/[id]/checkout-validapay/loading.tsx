import { ScreenSkeleton } from "@/components/revela/ScreenSkeleton";

/** Esqueleto do pagamento (tela cheia, sem abas). */
export default function Loading() {
  return <ScreenSkeleton variant="lista" label="Abrindo pagamento…" />;
}
