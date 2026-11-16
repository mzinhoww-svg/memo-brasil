/** Contrato do gateway: `x-wa-signature: sha256=<hex>`, HMAC-SHA256 do corpo BRUTO com o segredo do webhook. */
export async function verifyWaSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!secret || !header || header.length > 100) return false;
  const m = /^sha256=([a-fA-F0-9]{64})$/.exec(header.trim());
  if (!m) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signature = Uint8Array.from(m[1].match(/../g)!, (pair) => parseInt(pair, 16));
  // crypto.subtle.verify compara em tempo constante
  return crypto.subtle.verify("HMAC", key, signature, enc.encode(rawBody));
}
