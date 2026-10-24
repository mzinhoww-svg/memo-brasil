// Validação do x-signature do webhook do Mercado Pago. Módulo puro (Web Crypto), sem APIs de Deno.
// Cabeçalho: `ts=<unix>,v1=<hex>`. Manifest: `id:<data.id da query>;request-id:<x-request-id>;ts:<ts>;` (campo ausente é
// removido; data.id alfanumérico em minúsculas). v1 = HMAC-SHA256 hex do manifest com MERCADOPAGO_WEBHOOK_SECRET.
// Além do HMAC: tolerância de ts (±10 min) e comparação em tempo constante. Ver design §6 (incertezas 3 e 4).

const enc = new TextEncoder();
export const SIGNATURE_TOLERANCE_MS = 10 * 60_000;

export function parseSignatureHeader(h: string | null | undefined): { ts: string; v1: string } | null {
  if (!h) return null;
  let ts = "", v1 = "";
  for (const part of h.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "ts") ts = v;
    else if (k === "v1") v1 = v;
  }
  return ts && v1 ? { ts, v1 } : null;
}

export function buildManifest(i: { dataId: string | null | undefined; requestId: string | null | undefined; ts: string }): string {
  let out = "";
  if (i.dataId) out += `id:${/^[A-Za-z0-9]+$/.test(i.dataId) ? i.dataId.toLowerCase() : i.dataId};`;
  if (i.requestId) out += `request-id:${i.requestId};`;
  return `${out}ts:${i.ts};`;
}

function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type SignatureResult = { ok: true } | { ok: false; reason: "ausente" | "formato" | "ts" | "assinatura" };

export async function verifyMercadoPagoSignature(input: {
  secret: string;
  signatureHeader: string | null | undefined;
  requestId: string | null | undefined;
  dataId: string | null | undefined;
  nowMs: number;
  toleranceMs?: number;
}): Promise<SignatureResult> {
  if (!input.secret || !input.signatureHeader) return { ok: false, reason: "ausente" };
  const sig = parseSignatureHeader(input.signatureHeader);
  if (!sig) return { ok: false, reason: "formato" };
  // HMAC sempre calculado (sem curto-circuito), para não revelar pelo tempo qual verificação falhou
  const expected = await hmacHex(input.secret, buildManifest({ dataId: input.dataId, requestId: input.requestId, ts: sig.ts }));
  const sigOk = timingSafeEqual(sig.v1.toLowerCase(), expected);
  let tsOk = false;
  if (/^\d{1,16}$/.test(sig.ts)) {
    const n = Number(sig.ts);
    const ms = n > 1e12 ? n : n * 1000; // segundos (padrão); milissegundos por heurística
    tsOk = Math.abs(input.nowMs - ms) <= (input.toleranceMs ?? SIGNATURE_TOLERANCE_MS);
  }
  if (!tsOk) return { ok: false, reason: "ts" };
  return sigOk ? { ok: true } : { ok: false, reason: "assinatura" };
}
