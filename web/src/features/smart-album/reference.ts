import { sniffImage } from "../../../../supabase/functions/_shared/image-sniff";

/**
 * Preparo da foto de referência NO APARELHO, antes de qualquer envio:
 *   1. valida pelo conteúdo (assinatura real), não pelo nome/tipo declarado;
 *   2. decodifica e recomprime em JPEG (lado maior ≤ 1280 px): o arquivo novo não leva EXIF, GPS, nem dados do aparelho;
 *   3. confere tamanho mínimo e, quando o navegador oferece `FaceDetector`, quantos rostos aparecem.
 * Nada aqui é persistido (sem localStorage/IndexedDB): o Blob vive só na memória da tela até o envio ou o descarte.
 */
export const INPUT_MAX_BYTES = 15 * 1024 * 1024;
export const MIN_SIDE = 320;
export const OUT_MAX_SIDE = 1280;
export const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export type ReferenceProblem = "too-large" | "unsupported" | "undecodable" | "too-small" | "no-face" | "many-faces";
export type FaceCheck = "one" | "none" | "many" | "unchecked";
export interface PreparedReference { blob: Blob; width: number; height: number; faces: FaceCheck }

/** HEIC/HEIF não têm assinatura em `sniffImage`: só o Safari decodifica; o passo de decodificação decide. */
export function isHeic(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const brand = String.fromCharCode(...b.slice(4, 12));
  return /^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)/.test(brand);
}

export function checkInput(bytes: Uint8Array): ReferenceProblem | null {
  if (bytes.length > INPUT_MAX_BYTES) return "too-large";
  if (!sniffImage(bytes) && !isHeic(bytes)) return "unsupported";
  return null;
}

export function fitInside(w: number, h: number, max = OUT_MAX_SIDE): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

export function problemFor(width: number, height: number, faces: FaceCheck): ReferenceProblem | null {
  if (Math.min(width, height) < MIN_SIDE) return "too-small";
  if (faces === "none") return "no-face";
  if (faces === "many") return "many-faces";
  return null;
}

type Detector = { detect: (src: CanvasImageSource) => Promise<unknown[]> };
/** Detector do navegador quando existe (Chrome com Shape Detection). Não identifica ninguém: só conta rostos, e nada sai do aparelho. */
export async function countFaces(src: CanvasImageSource, make: (() => Detector | null) | undefined = defaultDetector): Promise<FaceCheck> {
  const d = make?.();
  if (!d) return "unchecked";
  try {
    const n = (await d.detect(src)).length;
    return n === 0 ? "none" : n === 1 ? "one" : "many";
  } catch {
    return "unchecked";
  }
}
function defaultDetector(): Detector | null {
  const FD = (globalThis as { FaceDetector?: new (o: { maxDetectedFaces: number; fastMode: boolean }) => Detector }).FaceDetector;
  return FD ? new FD({ maxDetectedFaces: 3, fastMode: true }) : null;
}

async function decode(blob: Blob): Promise<{ src: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return { src: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { src: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareReference(file: Blob): Promise<PreparedReference | ReferenceProblem> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const bad = checkInput(bytes);
  if (bad) return bad;
  let img;
  try { img = await decode(new Blob([bytes], { type: file.type || "application/octet-stream" })); } catch { return "undecodable"; }
  try {
    const { width, height } = fitInside(img.width, img.height);
    if (Math.min(img.width, img.height) < MIN_SIDE) return "too-small";
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d");
    if (!g) return "undecodable";
    g.drawImage(img.src, 0, 0, width, height);
    const faces = await countFaces(canvas);
    const p = problemFor(width, height, faces);
    if (p) return p;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
    if (!blob) return "undecodable";
    return { blob, width, height, faces };
  } finally {
    img.close();
  }
}

/**
 * URL da foto do Google, só para PRÉVIA e só se for HTTPS num host do Google (`*.googleusercontent.com`). O campo `picture` é opcional no
 * OpenID Connect e pode vencer; nunca é usado sem a pessoa escolher e confirmar que a foto é dela e mostra o rosto.
 */
export function googlePictureUrl(meta: unknown): string | null {
  const m = (meta ?? {}) as { picture?: unknown; avatar_url?: unknown };
  const raw = typeof m.picture === "string" ? m.picture : typeof m.avatar_url === "string" ? m.avatar_url : null;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !/(^|\.)googleusercontent\.com$/.test(u.hostname) || u.username || u.password || u.port) return null;
    // pede uma versão maior (o padrão costuma ser 96 px, abaixo do mínimo de referência)
    return u.toString().replace(/=s\d+-c$/, "=s640-c");
  } catch {
    return null;
  }
}

/** Baixa a foto do Google (só depois da escolha da pessoa): sem credenciais, sem seguir para outro host, com teto de bytes e tempo. */
export async function fetchGooglePicture(url: string, fetchFn: typeof fetch = fetch, timeoutMs = 8000): Promise<Blob | null> {
  if (!googlePictureUrl({ picture: url })) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchFn(url, { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: ctl.signal, cache: "no-store" });
    if (!r.ok) return null;
    const len = Number(r.headers.get("content-length") ?? "0");
    if (len > INPUT_MAX_BYTES) return null;
    const b = await r.blob();
    return b.size > INPUT_MAX_BYTES ? null : b;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
