import type { CameraStyle, FilmLook } from "@/domain/options";
import type { PhotoData } from "@/repositories";
import { renderFilm, stampText, type RenderOptions } from "./film/film-canvas";
import { warmFilm } from "./film/film35";

export { stampText };

export const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Ladrilhos de grão fixos: gerar um ladrilho custa caro, então cada foto usa um destes (escolhido pelo horário)
 * deslocado pelo horário do disparo. O grão continua diferente entre fotos sem recalcular o ladrilho a cada disparo.
 */
export const GRAIN_SEEDS = [11, 23, 37, 53] as const;

/** Estilo da câmera/evento → opções do `renderFilm` (look, carimbo só quando o evento usa filme). */
export function filmOptions(style: CameraStyle | FilmLook, takenAt: Date, mirror = false): RenderOptions {
  const t = takenAt.getTime();
  const seed = GRAIN_SEEDS[Math.abs(Math.floor(t)) % GRAIN_SEEDS.length];
  const grain = { seed, grainOffset: t, mirror };
  if (style === "filme35" || style === "vintage") return { look: "filme35", ...grain, stamp: stampText(takenAt) };
  if (style === "preto-e-branco") return { look: "pb", ...grain };
  return { look: "natural", ...grain };
}

type WorkerReply = { id: number; bytes?: ArrayBuffer; error?: string };
let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, { res: (b: ArrayBuffer) => void; rej: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  try {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") return null;
    const w = new Worker(new URL("./film/film.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<WorkerReply>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.bytes) p.res(e.data.bytes); else p.rej(new Error(e.data.error ?? "worker"));
    };
    w.onerror = () => {
      for (const p of pending.values()) p.rej(new Error("worker"));
      pending.clear();
      worker = null; // próxima captura cai no thread principal
    };
    worker = w;
  } catch { worker = null; }
  return worker;
}

/**
 * Pré-aquece ao abrir a câmera: cria o worker e decodifica o LUT/ladrilhos de grão lá e no thread principal (onde roda a
 * prévia pequena), para o primeiro disparo não pagar esse custo. Pode ser chamada várias vezes.
 */
export function prewarmFilm(style: CameraStyle | FilmLook): void {
  const look = filmOptions(style, new Date(0)).look;
  const wk = getWorker();
  if (look === "natural" || look === undefined) return;
  wk?.postMessage({ warm: look, seeds: [...GRAIN_SEEDS] });
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
  idle(() => { try { warmFilm(look, GRAIN_SEEDS); } catch { /* aquecer é opcional */ } });
}

/** Quadro congelado no toque: um ImageBitmap do vídeo (ou, sem suporte, uma cópia num canvas). */
export interface Frame { source: CanvasImageSource; width: number; height: number; close: () => void }

/** Congela o quadro atual do visor sem processar nada: é o que libera o obturador logo depois do toque. */
export async function grabFrame(video: HTMLVideoElement): Promise<Frame> {
  const width = video.videoWidth, height = video.videoHeight;
  if (!width || !height) throw new Error("visor sem imagem");
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(video);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* cai na cópia em canvas */ }
  }
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas 2d indisponível");
  ctx.drawImage(video, 0, 0, width, height);
  return { source: c, width, height, close: () => { c.width = 0; c.height = 0; } };
}

export const PREVIEW_WIDTH = 320;
/** Prévia pequena (~320 px) com o mesmo filme da foto: aparece no canto da câmera na hora do disparo. */
export async function renderPreview(source: CanvasImageSource, width: number, height: number, style: CameraStyle | FilmLook, mirror = false, takenAt: Date = new Date()): Promise<Blob> {
  const scale = Math.min(1, PREVIEW_WIDTH / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  renderFilm(canvas, source, width, height, filmOptions(style, takenAt, mirror));
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.8));
}

/** Processa fora do thread principal (OffscreenCanvas). Devolve undefined se não houver suporte, para cair no thread principal. */
async function renderInWorker(source: CanvasImageSource, w: number, h: number, opts: RenderOptions): Promise<ArrayBuffer | undefined> {
  const wk = getWorker();
  if (!wk) return undefined;
  try {
    const bitmap = await createImageBitmap(source as ImageBitmapSource, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
    const id = nextId++;
    const done = new Promise<ArrayBuffer>((res, rej) => pending.set(id, { res, rej }));
    wk.postMessage({ id, bitmap, w, h, opts, quality: JPEG_QUALITY }, [bitmap]);
    return await done;
  } catch { return undefined; }
}

/** Desenha a fonte (vídeo ou imagem) reduzida, aplica o Filme 35mm (`renderFilm`) e devolve JPEG em bytes. */
export async function renderPhoto(source: CanvasImageSource, width: number, height: number, style: CameraStyle | FilmLook, mirror = false, takenAt: Date = new Date()): Promise<PhotoData> {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const opts = filmOptions(style, takenAt, mirror);
  const viaWorker = await renderInWorker(source, w, h, opts);
  if (viaWorker) return { bytes: viaWorker, type: "image/jpeg" };
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  renderFilm(canvas, source, width, height, opts);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", JPEG_QUALITY));
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
