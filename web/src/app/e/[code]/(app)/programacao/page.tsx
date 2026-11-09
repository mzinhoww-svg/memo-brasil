"use client";

import { useRouter } from "next/navigation";
import { useGuest } from "@/features/events/guest-context";
import { momentStates } from "@/features/guest/format";
import { ConvidadoProgramacao } from "@/revela/screens/ConvidadoProgramacao";

/** 23f · Programação */
export default function Programacao() {
  const { event, now } = useGuest();
  const router = useRouter();
  return <ConvidadoProgramacao place={event.place || "Local a combinar"} address="" moments={momentStates(event, now)} onBack={() => router.back()} />;
}
