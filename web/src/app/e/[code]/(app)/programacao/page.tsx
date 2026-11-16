"use client";

import { useGuest } from "@/features/events/guest-context";
import { momentStates } from "@/features/guest/format";
import { useSmartBack } from "@/lib/smart-back";
import { ConvidadoProgramacao } from "@/revela/screens/ConvidadoProgramacao";

/** 23f · Programação */
export default function Programacao() {
  const { event, now } = useGuest();
  const back = useSmartBack(`/e/${event.code}/agora`);
  return <ConvidadoProgramacao place={event.place || "Local a combinar"} address="" moments={momentStates(event, now)} onBack={back} />;
}
