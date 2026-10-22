import type { MemoEvent } from "@/domain/event";
import { formatInZone } from "@/domain/reveal";
import { plural } from "@/lib/plural";

/** Linha do card A6: "Cada um tem {n} fotos. Revelamos {quando}." (UXA-124). */
export function qrRollLine(e: Pick<MemoEvent, "shotsPerPerson" | "revealEnabled" | "revealAt" | "timezone">): string {
  const shots = e.shotsPerPerson === null ? "Fotos sem limite" : `Cada um tem ${e.shotsPerPerson} ${plural(e.shotsPerPerson, "foto", "fotos")}`;
  if (!e.revealEnabled || e.revealAt === null) return `${shots}. Revelamos na hora.`;
  const at = formatInZone(e.revealAt, e.timezone);
  return `${shots}. Revelamos em ${at.date} às ${at.time}.`;
}
