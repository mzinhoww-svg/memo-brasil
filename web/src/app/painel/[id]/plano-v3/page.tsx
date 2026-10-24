"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/memoriesmt";
import { V3PaymentJourney } from "@/features/billing/V3PaymentJourney";

/**
 * V3 preview route. The event owner remains protected by the existing
 * /painel/[id] layout. Financial authority continues in existing RPCs/functions.
 *
 * No production pricing changes, new credentials or provider switching here.
 */
export default function PaymentV3Page() {
  return (
    <Suspense fallback={<Skeleton label="Carregando checkout…" />}>
      <V3PaymentJourney />
    </Suspense>
  );
}
