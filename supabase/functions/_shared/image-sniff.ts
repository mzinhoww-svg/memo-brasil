// Validação de imagem pelo CONTEÚDO (assinatura e dimensões reais). Módulo puro, sem APIs de Deno, para rodar na Edge Function e nos testes.
// O que o cliente declara (Content-Type, largura, altura) nunca é autoridade.

export type Sniffed = { mime: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number };
export type AssetKind = "logo" | "cover";

export const ASSET_RULES = {
  logo: { maxBytes: 2 * 1024 * 1024 },
  cover: { maxBytes: 5 * 1024 * 1024 },
  minPx: 16,
  maxPx: 8192,
  maxPixels: 36_000_000, // teto contra bomba de descompressão (6000 x 6000)
} as const;

const eq = (b: Uint8Array, off: number, sig: number[]) => sig.every((v, i) => b[off + i] === v);
const ascii = (b: Uint8Array, off: number, s: string) => s.split("").every((c, i) => b[off + i] === c.charCodeAt(0));
const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function png(b: Uint8Array): Sniffed | null {
  if (b.length < 33 || !eq(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) || u32be(b, 8) !== 13 || !ascii(b, 12, "IHDR")) return null;
  return { mime: "image/png", width: u32be(b, 16), height: u32be(b, 20) };
}

function jpeg(b: Uint8Array): Sniffed | null {
  if (b.length < 4 || !eq(b, 0, [0xff, 0xd8, 0xff])) return null;
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i] === 0xff && i + 1 < b.length) i++; // preenchimento
    const m = b[i++];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) continue; // marcadores sem tamanho
    if (m === 0xd9 || m === 0xda) return null; // EOI/SOS antes do SOF
    if (i + 1 >= b.length) return null;
    const len = u16be(b, i);
    if (len < 2) return null;
    const sof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (sof) {
      if (i + 7 > b.length) return null;
      return { mime: "image/jpeg", height: u16be(b, i + 3), width: u16be(b, i + 5) };
    }
    i += len;
  }
  return null;
}

function webp(b: Uint8Array): Sniffed | null {
  if (b.length < 30 || !ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (kind === "VP8X") {
    const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { mime: "image/webp", width: w, height: h };
  }
  if (kind === "VP8 ") {
    if (!eq(b, 23, [0x9d, 0x01, 0x2a])) return null;
    return { mime: "image/webp", width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  if (kind === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] * 2 ** 24);
    return { mime: "image/webp", width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  return null;
}

/** Tipo e dimensões a partir dos bytes; `null` se não for PNG, JPEG ou WebP válidos (SVG, GIF, HTML etc.). */
export function sniffImage(bytes: Uint8Array): Sniffed | null {
  return png(bytes) ?? jpeg(bytes) ?? webp(bytes);
}

export type AssetVerdict =
  | { ok: true; width: number; height: number; mime: Sniffed["mime"] }
  | { ok: false; reason: "assinatura" | "tipo" | "tamanho" | "dimensoes" | "pixels" };

export function validateSniffed(kind: AssetKind, size: number, sniffed: Sniffed | null, declaredMime: string): AssetVerdict {
  if (!sniffed) return { ok: false, reason: "assinatura" };
  if (sniffed.mime !== declaredMime) return { ok: false, reason: "tipo" };
  if (size <= 0 || size > ASSET_RULES[kind].maxBytes) return { ok: false, reason: "tamanho" };
  const { width, height } = sniffed, { minPx, maxPx, maxPixels } = ASSET_RULES;
  if (![width, height].every((n) => Number.isInteger(n) && n >= minPx && n <= maxPx)) return { ok: false, reason: "dimensoes" };
  if (width * height > maxPixels) return { ok: false, reason: "pixels" };
  return { ok: true, width, height, mime: sniffed.mime };
}
