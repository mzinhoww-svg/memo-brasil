// Autenticação do webhook da AbacatePay. Módulo puro (Web Crypto + btoa), sem APIs de Deno, para rodar na Edge Function e nos testes.
// A documentação exige os dois mecanismos juntos:
//   1) `?webhookSecret=` na URL igual ao secret definido ao criar o webhook (prova a origem);
//   2) `X-Webhook-Signature` = base64(HMAC-SHA256(chave publicada da AbacatePay, corpo bruto em UTF-8)) (prova a integridade).

const enc = new TextEncoder();

/** Comparação em tempo constante para strings de mesmo comprimento; comprimentos diferentes recusam sem comparar conteúdo. */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function hmacSha256Base64(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
  let bin = "";
  for (const b of mac) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function verifyWebhookRequest(input: {
  url: string;
  rawBody: string;
  signatureHeader: string | null;
  expectedSecret: string;
  hmacKey: string;
}): Promise<boolean> {
  const { url, rawBody, signatureHeader, expectedSecret, hmacKey } = input;
  // Configuração ausente nunca autentica.
  if (!expectedSecret || !hmacKey || !signatureHeader) return false;

  let secret: string | null;
  try {
    secret = new URL(url).searchParams.get("webhookSecret");
  } catch {
    return false;
  }
  // Os dois testes sempre rodam (sem curto-circuito), para não revelar qual falhou pelo tempo de resposta.
  const secretOk = timingSafeEqual(secret ?? "", expectedSecret);
  const expectedSig = await hmacSha256Base64(hmacKey, rawBody);
  const sigOk = timingSafeEqual(signatureHeader.trim(), expectedSig);
  return secretOk && sigOk;
}
