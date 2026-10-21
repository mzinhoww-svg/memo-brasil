import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { MemoEvent } from "@/domain/event";
import type { Photo } from "@/domain/photo";
import { createMemoryRepositories } from "@/repositories";
import { csvCell, guestsCsv, zipAlbum } from "./export";

describe("CSV", () => {
  it("escapa aspas, vírgulas e neutraliza fórmulas", () => {
    expect(csvCell('Ana "A", Silva')).toBe('"Ana ""A"", Silva"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+55")).toBe("'+55");
    expect(csvCell("normal")).toBe("normal");
  });
  it("monta a lista de convidados com BOM", () => {
    const csv = guestsCsv([{ participant: { eventId: "e", userId: "u", name: "=cmd", joinedAt: 0, tableLabel: "Mesa 8" }, photos: 3 }]);
    expect(csv.startsWith("﻿Nome,Mesa ou origem,Fotos,Entrou em")).toBe(true);
    expect(csv).toContain("'=cmd,Mesa 8,3,1970-01-01T00:00:00.000Z");
  });
});

describe("ZIP do álbum", () => {
  it("inclui só fotos não removidas e conta as sem bytes", async () => {
    const repos = createMemoryRepositories();
    const ev = { title: "Emy & Igor" } as MemoEvent;
    const mk = (id: string, status: Photo["status"], t: number): Photo => ({ id, eventId: "e", authorId: "a", authorName: "Ana", createdAt: t, moment: "O sim", status, reports: 0, highlighted: false, version: 1 });
    const photos = [mk("1", "visivel", 1), mk("2", "removida", 2), mk("3", "oculta", 3), mk("4", "visivel", 4)];
    for (const p of photos.slice(0, 3)) await repos.photos.add(p, { bytes: new Uint8Array([1, 2]).buffer, type: "image/jpeg" });
    const r = await zipAlbum(repos, ev, photos);
    expect(r.saved).toBe(2);
    expect(r.missing).toBe(1);
    expect(r.filename).toBe("memoriesmt-emy-igor.zip");
    const zip = await JSZip.loadAsync(await r.blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(["emy-igor-001-o-sim.jpg", "emy-igor-002-o-sim.jpg"]);
  });
});

describe("CSV: espaço antes da fórmula", () => {
  it("neutraliza ' =cmd' e quebra de linha antes de '='", () => {
    expect(csvCell(" =1+1")).toBe("' =1+1");
    expect(csvCell("\t@x")).toBe("'\t@x");
  });
});
