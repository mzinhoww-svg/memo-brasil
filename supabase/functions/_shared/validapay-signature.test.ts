import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyValidaPaySignature } from "./validapay-signature";

const secret = "test-only-not-a-real-secret";
const now = 1793925600000;
const raw = '{ "event": "payment.success", "chargeId": "cha_test" }';
const sign = (body = raw, time = now) => `t=${time},v1=${createHmac("sha256", secret).update(`${time}.${body}`).digest("hex")}`;

describe("ValidaPay signed raw webhook", () => {
  it("accepts the documented timestamp + raw-body HMAC", async () => {
    expect(await verifyValidaPaySignature(raw, sign(), secret, now)).toBe(true);
  });
  it("rejects changes to bytes, secret and timestamp", async () => {
    expect(await verifyValidaPaySignature(JSON.stringify(JSON.parse(raw)), sign(), secret, now)).toBe(false);
    expect(await verifyValidaPaySignature(raw, sign(), "wrong", now)).toBe(false);
    expect(await verifyValidaPaySignature(raw, sign().replace(String(now), String(now + 1)), secret, now)).toBe(false);
  });
  it("rejects replay outside five minutes and future timestamps", async () => {
    expect(await verifyValidaPaySignature(raw, sign(raw, now - 300001), secret, now)).toBe(false);
    expect(await verifyValidaPaySignature(raw, sign(raw, now + 300001), secret, now)).toBe(false);
  });
  it.each([null, "", "v1=abc", `t=${now},v1=abc`, `t=${now},t=${now},v1=${"a".repeat(64)}`, `t=NaN,v1=${"a".repeat(64)}`])(
    "rejects malformed signatures %s", async (header) => expect(await verifyValidaPaySignature(raw, header, secret, now)).toBe(false),
  );
  it("fails closed without a signing secret", async () => {
    expect(await verifyValidaPaySignature(raw, sign(), "", now)).toBe(false);
  });
});
