"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/memoriesmt";
import { V3PaymentJourney } from "@/features/billing/V3PaymentJourney";

// Canonical organizer plan route now points to the native V3 checkout.
// Legacy Checkout Pro remains in Git history only; no new external redirects.
export default function PlanoPage() {
  return (
    <Suspense fallback={<Skeleton label="Abrindo seu plano…" />}>
      <V3PaymentJourney />
    </Suspense>
  );
}
