"use client";

import { useSearchParams } from "next/navigation";
import { Oferta } from "@/features/funnel/Oferta";

export function OfertaFromUrl() {
  return <Oferta leadParam={useSearchParams().get("l")} />;
}
