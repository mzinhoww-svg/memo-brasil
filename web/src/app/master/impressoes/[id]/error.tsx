"use client";

import { MasterStatePage } from "@/revela/master/MasterState";

/** M30.e: erro inesperado, com "Tentar de novo". */
export default function ErrorState({ reset }: { error: Error; reset: () => void }) {
  return <MasterStatePage area="Impressões" variant="error" onRetry={reset} />;
}
