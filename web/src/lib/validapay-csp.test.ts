import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => vi.unstubAllEnvs());
describe("sandbox preview CSP", () => {
  it("does not permit payment SDK hosts by default", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_VALIDAPAY_SANDBOX_PREVIEW", "0"); vi.resetModules();
    const { default: cfg } = await import("../../next.config");
    const rules = await cfg.headers!();
    expect(JSON.stringify(rules)).not.toContain("marlim.co");
    expect(JSON.stringify(rules)).not.toContain("sandbox.validapay.com.br");
  });
  it("allows only sandbox SDK endpoints when the explicit preview flag is on", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_VALIDAPAY_SANDBOX_PREVIEW", "1"); vi.resetModules();
    const { default: cfg } = await import("../../next.config");
    const rules = await cfg.headers!();
    const encoded = JSON.stringify(rules);
    expect(encoded).toContain("https://sandbox.validapay.com.br");
    expect(encoded).toContain("https://cdn.marlim.co");
    expect(encoded).toContain("https://h.online-metrix.net");
    expect(encoded).not.toContain("https://api.validapay.com.br");
    expect(encoded).not.toContain("https://api.marlim.co");
  });
});

it("permits production endpoints only for the generic checkout flag", async () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_VALIDAPAY_CHECKOUT", "1"); vi.stubEnv("NEXT_PUBLIC_VALIDAPAY_SANDBOX_PREVIEW", "0"); vi.resetModules();
  const { default: cfg } = await import("../../next.config");
  const encoded = JSON.stringify(await cfg.headers!());
  for (const host of ["https://api.validapay.com.br", "https://api.marlim.co", "https://cdn.marlim.co", "https://h.online-metrix.net", "https://centinelapi.cardinalcommerce.com", "https://geo.cardinalcommerce.com", "https://cas.client.cardinaltrusted.com"]) expect(encoded).toContain(host);
  expect(encoded).not.toContain("sandbox."); expect(encoded).not.toContain("geostag."); expect(encoded).not.toContain("centinelapistag.");
});
