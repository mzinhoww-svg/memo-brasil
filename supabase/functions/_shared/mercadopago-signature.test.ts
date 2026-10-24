// Testes puros da validação do x-signature do Mercado Pago. O vetor é calculado com node:crypto (independente da
// implementação, que usa Web Crypto). Rodar: cd web && npx vitest run --config vitest.functions.config.ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildManifest, parseSignatureHeader, verifyMercadoPagoSignature } from "./mercadopago-signature";

const SECRET = "segredo-ficticio-de-teste-0123456789";
const NOW = 1_700_000_000_000;
const tsSec = String(Math.floor(NOW / 1000));
const sign = (manifest: string, key = SECRET) => createHmac("sha256", key).update(manifest).digest("hex");

describe("parseSignatureHeader / buildManifest", () => {
  it("lê ts e v1 em qualquer ordem e com espaços", () => {
    expect(parseSignatureHeader("ts=123, v1=abc")).toEqual({ ts: "123", v1: "abc" });
    expect(parseSignatureHeader("v1=abc,ts=123")).toEqual({ ts: "123", v1: "abc" });
  });
  it("formato inválido ou campo ausente devolve null", () => {
    expect(parseSignatureHeader("")).toBeNull();
    expect(parseSignatureHeader("ts=123")).toBeNull();
    expect(parseSignatureHeader("v1=abc")).toBeNull();
    expect(parseSignatureHeader("lixo")).toBeNull();
  });
  it("manifest: id minúsculo se alfanumérico; campo ausente é removido", () => {
    expect(buildManifest({ dataId: "ABC123", requestId: "req-1", ts: "99" })).toBe("id:abc123;request-id:req-1;ts:99;");
    expect(buildManifest({ dataId: "123456", requestId: null, ts: "99" })).toBe("id:123456;ts:99;");
    expect(buildManifest({ dataId: null, requestId: "req-1", ts: "99" })).toBe("request-id:req-1;ts:99;");
    expect(buildManifest({ dataId: "a-b_c", requestId: "r", ts: "9" })).toBe("id:a-b_c;request-id:r;ts:9;"); // não alfanumérico: mantém
  });
});

describe("verifyMercadoPagoSignature", () => {
  const base = { secret: SECRET, requestId: "req-abc", dataId: "98765", nowMs: NOW };
  const good = () => `ts=${tsSec},v1=${sign(`id:98765;request-id:req-abc;ts:${tsSec};`)}`;

  it("aceita assinatura válida", async () => {
    expect(await verifyMercadoPagoSignature({ ...base, signatureHeader: good() })).toEqual({ ok: true });
  });
  it("aceita data.id com maiúsculas (normalizado) e ausência de request-id quando assinado assim", async () => {
    const h = `ts=${tsSec},v1=${sign(`id:abcd1;ts:${tsSec};`)}`;
    expect(await verifyMercadoPagoSignature({ ...base, dataId: "ABCD1", requestId: null, signatureHeader: h })).toEqual({ ok: true });
  });
  it("recusa segredo errado, corpo/ids adulterados e v1 truncado", async () => {
    expect(await verifyMercadoPagoSignature({ ...base, secret: "outro-segredo", signatureHeader: good() })).toEqual({ ok: false, reason: "assinatura" });
    expect(await verifyMercadoPagoSignature({ ...base, dataId: "98766", signatureHeader: good() })).toEqual({ ok: false, reason: "assinatura" });
    expect(await verifyMercadoPagoSignature({ ...base, requestId: "req-x", signatureHeader: good() })).toEqual({ ok: false, reason: "assinatura" });
    expect(await verifyMercadoPagoSignature({ ...base, signatureHeader: good().slice(0, -2) })).toEqual({ ok: false, reason: "assinatura" });
  });
  it("sem cabeçalho, sem segredo ou formato inválido nunca autentica", async () => {
    expect(await verifyMercadoPagoSignature({ ...base, signatureHeader: null })).toEqual({ ok: false, reason: "ausente" });
    expect(await verifyMercadoPagoSignature({ ...base, secret: "", signatureHeader: good() })).toEqual({ ok: false, reason: "ausente" });
    expect(await verifyMercadoPagoSignature({ ...base, signatureHeader: "ts=1" })).toEqual({ ok: false, reason: "formato" });
  });
  it("tolerância de ts: muito antigo ou muito no futuro é recusado, mesmo com HMAC correto", async () => {
    const old = String(Math.floor((NOW - 11 * 60_000) / 1000));
    const future = String(Math.floor((NOW + 11 * 60_000) / 1000));
    for (const t of [old, future]) {
      const h = `ts=${t},v1=${sign(`id:98765;request-id:req-abc;ts:${t};`)}`;
      expect(await verifyMercadoPagoSignature({ ...base, signatureHeader: h })).toEqual({ ok: false, reason: "ts" });
    }
    const edge = String(Math.floor((NOW - 9 * 60_000) / 1000));
    const h = `ts=${edge},v1=${sign(`id:98765;request-id:req-abc;ts:${edge};`)}`;
    expect(await verifyMercadoPagoSignature({ ...base, signatureHeader: h })).toEqual({ ok: true });
  });
  it("ts em milissegundos também é entendido", async () => {
    const ms = String(NOW);
    const h = `ts=${ms},v1=${sign(`id:98765;request-id:req-abc;ts:${ms};`)}`;
    expect(await verifyMercadoPagoSignature({ ...base, signatureHeader: h })).toEqual({ ok: true });
  });
  it("ts não numérico é recusado", async () => {
    const h = `ts=abc,v1=${sign("id:98765;request-id:req-abc;ts:abc;")}`;
    expect(await verifyMercadoPagoSignature({ ...base, signatureHeader: h })).toEqual({ ok: false, reason: "ts" });
  });
});
