"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ScreenSkeleton } from "@/components/revela/ScreenSkeleton";
import { savePendingCode } from "@/features/events/plan-catalog";

/** Link `/c/<código>`: guarda o código nesta aba e abre o assistente. O código só é aplicado ao criar o evento. */
export default function CodigoLink() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  useEffect(() => {
    savePendingCode(decodeURIComponent(code ?? ""));
    router.replace("/criar");
  }, [code, router]);
  return <main><ScreenSkeleton variant="camera" label="Abrindo o assistente…" /></main>;
}
