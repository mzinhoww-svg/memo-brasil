import { describe, expect, it } from "vitest";
import type { Photo, Reaction } from "@/domain/photo";
import { commentsText, firstName, initialOf, likesText, poseLabel, printDate, printStamp, reactionItems } from "./format";

const photo = (id: string, authorId: string, createdAt: number): Photo => ({ id, eventId: "e", authorId, authorName: "Ana Souza", createdAt, moment: "O sim", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta" });

describe("formatos do feed", () => {
  it("carimbo do print no fuso do evento", () => {
    const ts = Date.UTC(2027, 2, 15, 2, 41); // 22:41 em Cuiabá (UTC-4) do dia 14
    expect(printStamp(ts, "America/Cuiaba")).toBe("'27 03 14 · 22:41");
    expect(printDate(ts, "America/Cuiaba")).toBe("'27 03 14");
  });
  it("pose N de M entre as fotos do mesmo autor", () => {
    const a = [photo("1", "a", 100), photo("2", "a", 300), photo("3", "b", 200)];
    expect(poseLabel(a[1], a, { shotsPerPerson: 24 })).toBe("pose 2 de 24");
    expect(poseLabel(a[2], a, { shotsPerPerson: 24 })).toBe("pose 1 de 24");
    expect(poseLabel(a[0], a, { shotsPerPerson: null })).toBe("pose 1");
  });
  it("textos de curtidas e comentários no singular e plural", () => {
    expect(likesText(0)).toBe("Nenhuma curtida ainda");
    expect(likesText(1)).toBe("1 curtida");
    expect(likesText(1204)).toBe("1.204 curtidas");
    expect(commentsText(0)).toBe("Seja o primeiro a comentar");
    expect(commentsText(1)).toBe("Ver o comentário");
    expect(commentsText(14)).toBe("Ver os 14 comentários");
  });
  it("nomes e reações", () => {
    expect(firstName("Ana Souza")).toBe("Ana");
    expect(initialOf(" bia")).toBe("B");
    const r: Reaction[] = [{ eventId: "e", photoId: "1", authorId: "u", kind: "amei" }, { eventId: "e", photoId: "1", authorId: "v", kind: "amei" }, { eventId: "e", photoId: "2", authorId: "u", kind: "uau" }];
    const items = reactionItems("1", r, "u");
    expect(items.map((i) => i.label)).toEqual(["Amei", "Esse momento", "Rachei", "Uau"]);
    expect(items[0]).toMatchObject({ count: 2, on: true });
    expect(items[3]).toMatchObject({ count: 0, on: false });
  });
});
