"use client";

import { useEffect, useMemo, useState } from "react";
import { usePhotoUrls } from "@/features/app/hooks";
import { shotsLeft } from "@/domain/event";
import { useGuest } from "@/features/events/guest-context";
import { hhmm } from "@/features/guest/format";
import { myPoseTimes } from "@/features/photos/pose-times";
import { useRollPicker } from "@/features/photos/roll-picker";
import { ConvidadoMinhas } from "@/revela/screens/ConvidadoMinhas";
import { WhatsappOptIn } from "@/features/whatsapp/WhatsappOptIn";

/** 23c · Minhas poses */
export default function Minhas() {
  const { event, user, photos, counts, revealStatus } = useGuest();
  const roll = useRollPicker();
  const [times, setTimes] = useState<number[]>([]);
  useEffect(() => {
    let live = true;
    void myPoseTimes(event, user.id, photos).then((t) => { if (live) setTimes(t); });
    return () => { live = false; };
  }, [event, user.id, photos, counts.mine]);
  const taken = times.length ? times.map((t) => hhmm(t, event.timezone)) : Array.from({ length: counts.mine }, () => "");
  // depois da revelação a pessoa vê as próprias fotos (miniaturas), na ordem das poses; antes, só o papel de espera
  const revealed = revealStatus !== "pendente";
  const mine = useMemo(() => photos.filter((p) => p.authorId === user.id && p.status !== "removida" && p.uploadStatus === "pronta").sort((a, b) => a.createdAt - b.createdAt), [photos, user.id]);
  const urls = usePhotoUrls(revealed ? mine : [], "thumb");
  const thumbs = revealed ? mine.map((p) => urls[p.id]) : undefined;
  return <ConvidadoMinhas code={event.code} left={shotsLeft(event, counts.mine)} total={event.shotsPerPerson} taken={taken} thumbs={thumbs} revealed={revealed} onPickRoll={roll.open} extra={<WhatsappOptIn variant="compacta" eventId={event.id} revealed={revealed} />} />;
}
