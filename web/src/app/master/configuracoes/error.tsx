"use client";

import { MasterStatePage } from "@/revela/master/MasterState";

/** M31.e: erro inesperado, com "Tentar de novo". */
export default function ErrorState({ reset }: { error: Error; reset: () => void }) {
  return <MasterStatePage area="Configurações" variant="error" onRetry={reset} />;
}
