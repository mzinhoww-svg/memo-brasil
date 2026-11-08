import type { CameraStyle } from "@/domain/options";
import type { PhotoData } from "@/repositories";

/** Estilo da câmera aplicado nos pixels (RGBA). Funciona em todos os navegadores (sem ctx.filter). */
export function applyStylePixels(px: Uint8ClampedArray, style: CameraStyle): void {
  if (style === "original") return;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    if (style === "preto-e-branco") {
      const v = (gray - 128) * 1.1 + 128;
      px[i] = px[i + 1] = px[i + 2] = v;
    } else {
      // vintage: dessatura 35%, tom quente, contraste suave e pretos levantados
      const mix = (c: number) => gray * 0.35 + c * 0.65;
      px[i] = (mix(r) - 128) * 1.05 + 128 + 14;
      px[i + 1] = (mix(g) - 128) * 1.05 + 128 + 4;
      px[i + 2] = (mix(b) - 128) * 1.05 + 128 - 12;
      for (let k = 0; k < 3; k++) px[i + k] = px[i + k] * 0.94 + 10;
    }
  }
}

export const MAX_SIDE = 1600;

/** Desenha a fonte (vídeo ou imagem) num canvas reduzido, aplica o estilo e devolve JPEG em bytes. */
export async function renderPhoto(source: CanvasImageSource, width: number, height: number, style: CameraStyle, mirror = false): Promise<PhotoData> {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponivel");
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, w, h);
  if (style !== "original") {
    const img = ctx.getImageData(0, 0, w, h);
    applyStylePixels(img.data, style);
    ctx.putImageData(img, 0, 0);
  }
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.85));
  return { bytes: await blob.arrayBuffer(), type: "image/jpeg" };
}

export function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagem invalida"));
    };
    img.src = url;
  });
}

/** Navegadores embutidos de apps (Instagram, Facebook, WhatsApp) costumam negar a câmera: a saída é abrir no navegador. */
export function isEmbeddedBrowser(ua: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|WhatsApp/i.test(ua);
}

/** Passos para liberar a câmera depois de negada, conforme o navegador. */
export function cameraHelp(ua: string): { browser: string; steps: [string, string, string] } {
  const ios = /iPhone|iPad|iPod/i.test(ua);
  if (ios) return { browser: "Safari no iPhone", steps: ["Toque em aA ao lado do endereço.", "Ajustes do site › Câmera › Permitir.", "Volte aqui e toque abaixo."] };
  const android = /Android/i.test(ua);
  return { browser: android ? "Chrome no Android" : "Chrome", steps: ["Toque no cadeado ao lado do endereço.", "Permissões › Câmera › Permitir.", "Volte aqui e toque abaixo."] };
}

export function cameraFailure(error: unknown): "negada" | "sem-camera" | "camera-ocupada" | "camera-interrompida" {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "negada";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "sem-camera";
  if (name === "NotReadableError" || name === "TrackStartError") return "camera-ocupada";
  return "camera-interrompida";
}

export function photoAudienceCopy(everyoneSeesAll: boolean, revealed: boolean): string {
  const audience = everyoneSeesAll ? "todos do evento" : "você e o organizador";
  return revealed ? `A foto pode ser vista por ${audience}.` : `A foto fica guardada até a revelação, inclusive para você. Na revelação, pode ser vista por ${audience}.`;
}
