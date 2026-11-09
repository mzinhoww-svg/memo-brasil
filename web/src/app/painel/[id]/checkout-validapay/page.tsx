"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAdmin } from "@/features/admin/context";
import { Skeleton } from "@/components/revela";
import { ValidaPayCheckout } from "@/features/billing/ValidaPayCheckout";

function Checkout() {
  const { event } = useAdmin();
  const plan = useSearchParams().get("plano") ?? "festa";
  return <ValidaPayCheckout eventId={event.id} planCode={plan} eventTitle={event.title} wrap={event.cameraStyle} />;
}
export default function SandboxCheckoutPage() {
  return <Suspense fallback={<Skeleton label="Abrindo pagamento…" />}><Checkout /></Suspense>;
}
