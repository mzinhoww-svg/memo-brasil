import JSZip from "jszip";
import type { MemoEvent } from "@/domain/event";
import type { Photo } from "@/domain/photo";
import type { Participant, Repositories } from "@/repositories";

/** Célula CSV segura: aspas escapadas e prefixo contra fórmulas em planilhas (=, +, -, @). */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function guestsCsv(rows: { participant: Participant; photos: number }[]): string {
  const head = ["Nome", "Mesa ou origem", "Fotos", "Entrou em"].map(csvCell).join(",");
  const lines = rows.map(({ participant: p, photos }) => [p.name, p.tableLabel ?? "", photos, new Date(p.joinedAt).toISOString()].map(csvCell).join(","));
  return "﻿" + [head, ...lines].join("\r\n");
}

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "evento";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };

export interface ZipResult {
  blob: Blob;
  filename: string;
  saved: number;
  missing: number;
}

/** Álbum em ZIP: fotos não removidas, em ordem de postagem. Foto sem bytes entra na contagem de ausentes. */
export async function zipAlbum(repos: Repositories, event: MemoEvent, photos: Photo[], onProgress?: (done: number, total: number) => void): Promise<ZipResult> {
  const list = photos.filter((p) => p.status !== "removida").sort((a, b) => a.createdAt - b.createdAt);
  const zip = new JSZip();
  let saved = 0;
  let missing = 0;
  for (const [i, p] of list.entries()) {
    const d = await repos.photos.getData(p.id).catch(() => undefined);
    if (!d) missing++;
    else {
      zip.file(`${slug(event.title)}-${String(i + 1).padStart(3, "0")}-${slug(p.moment)}.${EXT[d.type] ?? "jpg"}`, d.bytes);
      saved++;
    }
    onProgress?.(i + 1, list.length);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, filename: `memoriesmt-${slug(event.title)}.zip`, saved, missing };
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
