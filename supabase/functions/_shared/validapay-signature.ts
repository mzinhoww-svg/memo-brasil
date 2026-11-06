/** Official contract: HMAC-SHA256(secret, `${timestampMs}.${rawBody}`). */
export async function verifyValidaPaySignature(
  rawBody: string, header: string | null, secret: string, now = Date.now(),
): Promise<boolean> {
  if (!secret || !header || header.length > 256 || !Number.isSafeInteger(now)) return false;
  const parts = header.split(",").map((p) => p.trim());
  if (parts.length !== 2) return false;
  const timestamp = parts.find((p) => /^t=\d{13}$/.test(p))?.slice(2);
  const hex = parts.find((p) => /^v1=[a-fA-F0-9]{64}$/.test(p))?.slice(3);
  if (!timestamp || !hex || Math.abs(now - Number(timestamp)) > 300_000) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signature = Uint8Array.from(hex.match(/../g)!, (pair) => parseInt(pair, 16));
  return crypto.subtle.verify("HMAC", key, signature, enc.encode(`${timestamp}.${rawBody}`));
}
