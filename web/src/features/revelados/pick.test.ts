import { describe, expect, it } from "vitest";
import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import { pickGallery, revealedEvents, whenLabel } from "./pick";

const photo = (id: string, authorId: string, createdAt: number, extra: Partial<Photo> = {}): Photo => ({ id, eventId: "e", authorId, authorName: authorId, createdAt, moment: "m", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta", ...extra });
const react = (photoId: string): Reaction => ({ eventId: "e", photoId, authorId: "x" + Math.random(), kind: "amei" });

describe("galeria dos revelados", () => {
  it("destaques, depois os mais reagidos, depois os mais recentes; sem removidas nem inacabadas", () => {
    const ps = [photo("a", "u", 1), photo("b", "u", 2), photo("c", "v", 3, { highlighted: true }), photo("d", "v", 4, { status: "removida" }), photo("e", "u", 5, { uploadStatus: "enviando" }), photo("f", "u", 0)];
    const out = pickGallery(ps, [react("a"), react("a"), react("b")], { n: 4 });
    expect(out.map((p) => p.id)).toEqual(["c", "a", "b", "f"]);
  });
  it("filtra por convidado", () => {
    const ps = [photo("a", "u", 1), photo("b", "v", 2)];
    expect(pickGallery(ps, [], { authorId: "v" }).map((p) => p.id)).toEqual(["b"]);
  });
  it("eventos revelados do mais novo para o mais antigo", () => {
    const ev = (id: string, revealedAt: number | null, enabled = true): MemoEvent => ({ id, startAt: 0, revealEnabled: enabled, revealAt: revealedAt, revealedAt } as unknown as MemoEvent);
    expect(revealedEvents([ev("a", 100), ev("b", 300), ev("c", null, true), ev("d", 200, false)], 1000).map((e) => e.id)).toEqual(["b", "d", "a"]);
  });
  it("hoje, ontem e data", () => {
    const now = Date.UTC(2027, 2, 15, 16, 0); // 12:00 em Cuiabá
    expect(whenLabel(now, now, "America/Cuiaba")).toBe("hoje, 12:00");
    expect(whenLabel(now - 86_400_000, now, "America/Cuiaba")).toBe("ontem, 12:00");
    expect(whenLabel(now - 5 * 86_400_000, now, "America/Cuiaba")).toBe("10 mar, 12:00");
  });
});
