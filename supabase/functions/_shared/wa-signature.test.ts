import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWaSignature } from "./wa-signature";

const secret = "test-only-not-a-real-secret";
const raw = '{"type":"optin.confirmed","project":"revela"}';
const sign = (body = raw, key = secret) => `sha256=${createHmac("sha256", key).update(body).digest("hex")}`;

describe("assinatura do webhook do gateway (HMAC-SHA256 do corpo bruto)", () => {
  it("aceita a assinatura correta", async () => {
    expect(await verifyWaSignature(raw, sign(), secret)).toBe(true);
  });
  it("aceita hexadecimal em maiúsculas", async () => {
    expect(await verifyWaSignature(raw, `sha256=${sign().slice(7).toUpperCase()}`, secret)).toBe(true);
  });
  it("recusa corpo alterado em um byte, inclusive espaço", async () => {
    expect(await verifyWaSignature(raw + " ", sign(), secret)).toBe(false);
    expect(await verifyWaSignature(JSON.stringify(JSON.parse(raw), null, 1), sign(), secret)).toBe(false);
  });
  it("recusa segredo errado", async () => {
    expect(await verifyWaSignature(raw, sign(raw, "outro"), secret)).toBe(false);
  });
  it.each([null, "", "sha256=", "sha256=abc", `sha1=${"a".repeat(64)}`, `SHA256 ${"a".repeat(64)}`, `sha256=${"z".repeat(64)}`, `sha256=${"a".repeat(65)}`, "a".repeat(400)])(
    "recusa cabeçalho malformado %s", async (h) => expect(await verifyWaSignature(raw, h as string | null, secret)).toBe(false),
  );
  it("falha fechada sem segredo configurado", async () => {
    expect(await verifyWaSignature(raw, sign(raw, ""), "")).toBe(false);
  });
});
