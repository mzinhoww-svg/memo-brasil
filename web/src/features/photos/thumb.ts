import type { PhotoData } from "@/repositories/types";

/** Lado maior da miniatura: a grade e o feed mostram as fotos em ~1/3 da largura do celular (até ~430 px em tela 3x). */
export const THUMB_MAX = 480;
const THUMB_QUALITY = 0.72;

/**
 * Miniatura JPEG da foto JÁ revelada (mesmo filme da original, só reduzida). Roda no aparelho, a partir dos bytes que vão
 * para o servidor: a câmera e a galeria passam pelo mesmo caminho. Sem suporte no navegador ou em qualquer erro devolve
 * `undefined` e a foto segue sem miniatura (quem exibe cai na original).
 */
export async function makeThumb(data: PhotoData, max = THUMB_MAX): Promise<PhotoData | undefined> {
  try {
    if (typeof createImageBitmap !== "function") return undefined;
    const src = await createImageBitmap(new Blob([data.bytes], { type: data.type }));
    const scale = Math.min(1, max / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * scale)), h = Math.max(1, Math.round(src.height * scale));
    let blob: Blob | null = null;
    if (typeof OffscreenCanvas === "function") {
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext("2d");
      if (!ctx) { src.close?.(); return undefined; }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, w, h);
      blob = await c.convertToBlob({ type: "image/jpeg", quality: THUMB_QUALITY });
    } else if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) { src.close?.(); return undefined; }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, w, h);
      blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", THUMB_QUALITY));
    }
    src.close?.();
    if (!blob || blob.size === 0) return undefined;
    return { bytes: await blob.arrayBuffer(), type: "image/jpeg" };
  } catch {
    return undefined;
  }
}
