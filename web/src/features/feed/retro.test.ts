import { describe, expect, it } from "vitest";
import type { Photo, Reaction } from "@/domain/photo";
import { retrospective } from "./retro";

const at = (h: number, m: number) => Date.UTC(2027, 2, 15, h, m); // UTC; o fuso do teste é UTC
const photo = (id: string, authorId: string, ts: number, moment = "Festa"): Photo => ({ id, eventId: "e", authorId, authorName: authorId.toUpperCase(), createdAt: ts, moment, status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta" });

describe("retrospectiva", () => {
  const photos = [
    photo("1", "bia", at(21, 2)), photo("2", "bia", at(21, 4), "Primeira dança"), photo("3", "bia", at(21, 8), "Primeira dança"), photo("4", "rafa", at(19, 30)), photo("5", "lu", at(22, 15)),
  ];
  const reactions: Reaction[] = [{ eventId: "e", photoId: "1", authorId: "x", kind: "amei" }, { eventId: "e", photoId: "2", authorId: "x", kind: "uau" }];
  const r = retrospective(photos, reactions, { tz: "UTC", shotsPerPerson: 36 });

  it("conta fotógrafos e reações e acha o pico de 10 minutos com o momento mais fotografado", () => {
    expect(r.tiles).toEqual([
      { label: "Fotógrafos", value: "3" },
      { label: "Reações", value: "2" },
      { label: "Pico", value: "21:00", note: "Primeira dança" },
    ]);
  });
  it("fotos por hora em ordem do tempo, a mais cheia marcada e proporcional", () => {
    expect(r.bars.map((b) => b.label)).toEqual(["19h", "21h", "22h"]);
    expect(r.bars.map((b) => b.on)).toEqual([false, true, false]);
    expect(r.bars[1].pct).toBe(100);
    expect(r.bars[0].pct).toBe(33);
  });
  it("quem mais fotografou, com o rolo do evento", () => {
    expect(r.shooters[0]).toEqual({ avatar: "B", name: "BIA", n: 3, total: 36 });
    expect(r.shooters).toHaveLength(3);
  });
  it("sem fotos não quebra", () => {
    const e = retrospective([], [], { tz: "UTC", shotsPerPerson: null });
    expect(e.tiles[2].value).toBe("–");
    expect(e.bars).toEqual([]);
  });
});
