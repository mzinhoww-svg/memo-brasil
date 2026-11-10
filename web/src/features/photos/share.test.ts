import { describe, expect, it, vi } from "vitest";
import type { Photo } from "@/domain/photo";
import type { Repositories } from "@/repositories";
import { canDownloadOriginal, downloadPhoto, DownloadNotAllowedError } from "./share";

const photo = { id: "p1", authorId: "autor" } as Photo;

describe("canDownloadOriginal", () => {
  it("permitido (ou ausente): todos baixam", () => {
    expect(canDownloadOriginal({}, { host: false, userId: "x" }, photo)).toBe(true);
    expect(canDownloadOriginal({ guestDownloadHigh: true }, { host: false, userId: "x" }, photo)).toBe(true);
  });
  it("desligado: convidado não baixa foto de outro; anfitrião e autor sim", () => {
    const e = { guestDownloadHigh: false };
    expect(canDownloadOriginal(e, { host: false, userId: "x" }, photo)).toBe(false);
    expect(canDownloadOriginal(e, { host: false, userId: "autor" }, photo)).toBe(true);
    expect(canDownloadOriginal(e, { host: true, userId: "h" }, photo)).toBe(true);
  });
});

describe("downloadPhoto", () => {
  it("o servidor recusou: lança sem ler os bytes", async () => {
    const getData = vi.fn();
    const repos = { photos: { downloadAllowed: vi.fn(async () => false), getData } } as unknown as Repositories;
    await expect(downloadPhoto(repos, photo)).rejects.toBeInstanceOf(DownloadNotAllowedError);
    expect(getData).not.toHaveBeenCalled();
  });
  it("o servidor permitiu: segue para o arquivo original", async () => {
    const getData = vi.fn(async () => undefined);
    const repos = { photos: { downloadAllowed: vi.fn(async () => true), getData } } as unknown as Repositories;
    expect(await downloadPhoto(repos, photo)).toBe(false); // sem bytes guardados
    expect(getData).toHaveBeenCalledWith("p1");
  });
});
