"use client";

import { useEffect, useState } from "react";
import { shotsLeft } from "@/domain/event";
import { useGuest } from "@/features/events/guest-context";
import { hhmm } from "@/features/guest/format";
import { myPoseTimes } from "@/features/photos/pose-times";
import { useRollPicker } from "@/features/photos/roll-picker";
import { ConvidadoMinhas } from "@/revela/screens/ConvidadoMinhas";

/** 23c · Minhas poses */
export default function Minhas() {
  const { event, user, photos, counts } = useGuest();
  const roll = useRollPicker();
  const [times, setTimes] = useState<number[]>([]);
  useEffect(() => {
    let live = true;
    void myPoseTimes(event, user.id, photos).then((t) => { if (live) setTimes(t); });
    return () => { live = false; };
  }, [event, user.id, photos, counts.mine]);
  const taken = times.length ? times.map((t) => hhmm(t, event.timezone)) : Array.from({ length: counts.mine }, () => "");
  return <ConvidadoMinhas code={event.code} left={shotsLeft(event, counts.mine)} total={event.shotsPerPerson} taken={taken} onPickRoll={roll.open} />;
}
