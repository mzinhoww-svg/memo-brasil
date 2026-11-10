import QRCode from "qrcode";

/** Margem de silêncio do QR exportado, em módulos (mínimo da norma ISO/IEC 18004). */
export const QR_QUIET = 4;
/** Lado do PNG exportado, em pixels. */
export const QR_PNG_SIZE = 2048;
/** Correção de erro Q (~25%): robusta para impressão sem engordar a matriz como o H. */
const LEVEL = "Q" as const;

export type QrKind = "svg" | "png" | "png-transparente";

/** Matriz do QR; `true` = módulo escuro. Desenhado como vetor, nunca como imagem. */
export function qrMatrix(text: string): boolean[][] {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: LEVEL });
  return Array.from({ length: modules.size }, (_, r) => Array.from({ length: modules.size }, (_, c) => Boolean(modules.get(r, c))));
}

/** SVG puro do QR (preto, sem fundo, sem logotipo nem texto), com a margem de silêncio dentro do `viewBox`. */
export function qrSvg(text: string): string {
  const m = qrMatrix(text);
  const total = m.length + 2 * QR_QUIET;
  let d = "";
  m.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) { c++; continue; }
      let end = c;
      while (end + 1 < row.length && row[end + 1]) end++;
      d += `M${c + QR_QUIET} ${r + QR_QUIET}h${end - c + 1}v1h-${end - c + 1}z`;
      c = end + 1;
    }
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${total * 10}" height="${total * 10}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><path fill="#000000" d="${d}"/></svg>\n`;
}

export interface QrRaster { width: number; height: number; data: Uint8ClampedArray }

/**
 * Pixels RGBA do QR: preto sobre branco opaco ou sobre transparente. Cada módulo ocupa um retângulo de pixels inteiros
 * (bordas arredondadas, sem suavização), então a imagem fica nítida mesmo quando 2048 não divide o total de módulos.
 */
export function qrRaster(text: string, opts: { transparent?: boolean; size?: number } = {}): QrRaster {
  const size = opts.size ?? QR_PNG_SIZE;
  const m = qrMatrix(text);
  const total = m.length + 2 * QR_QUIET;
  const data = new Uint8ClampedArray(size * size * 4);
  if (!opts.transparent) data.fill(255);
  const edge = (i: number) => Math.round((i * size) / total);
  m.forEach((row, r) => {
    const y0 = edge(r + QR_QUIET), y1 = edge(r + QR_QUIET + 1);
    row.forEach((on, c) => {
      if (!on) return;
      const x0 = edge(c + QR_QUIET), x1 = edge(c + QR_QUIET + 1);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * size + x) * 4; data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; }
    });
  });
  return { width: size, height: size, data };
}

/** Parte do nome de arquivo: sem acento, espaço ou caractere de caminho. */
export function fileSlug(text: string): string {
  const s = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " e ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return s || "evento";
}

/** "qr-ana-e-rui.svg" ou, por mesa, "qr-ana-e-rui-mesa-03.svg". */
export function qrFileName(title: string, kind: QrKind, table?: string): string {
  const ext = kind === "svg" ? "svg" : "png";
  const suffix = kind === "png-transparente" ? "-transparente" : "";
  return `qr-${fileSlug(title)}${table ? `-${fileSlug(table)}` : ""}${suffix}.${ext}`;
}

function canvasPng(r: QrRaster): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = r.width;
  canvas.height = r.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas indisponível"));
  ctx.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("png vazio"))), "image/png"));
}

export async function qrBlob(text: string, kind: QrKind): Promise<Blob> {
  if (kind === "svg") return new Blob([qrSvg(text)], { type: "image/svg+xml" });
  return canvasPng(qrRaster(text, { transparent: kind === "png-transparente" }));
}

const isIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

/** Entrega o arquivo: no iOS, folha de compartilhar de arquivo (Salvar em Arquivos); nos demais, `<a download>`. */
export async function saveBlob(blob: Blob, name: string): Promise<void> {
  if (isIos() && typeof navigator.canShare === "function") {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadQr(text: string, kind: QrKind, title: string, table?: string): Promise<void> {
  await saveBlob(await qrBlob(text, kind), qrFileName(title, kind, table));
}
