import { describe, expect, it } from "vitest";
import { MERCADOPAGO_DEFAULT_BASE_URL, resolveMercadoPagoConfig } from "./mercadopago-config";

const TOKEN = "TOKEN-FICTICIO-DE-TESTE"; // valor fictício

describe("resolveMercadoPagoConfig", () => {
  it("token presente usa a URL oficial", () => {
    expect(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: TOKEN })).toEqual({ ok: true, config: { accessToken: TOKEN, baseUrl: MERCADOPAGO_DEFAULT_BASE_URL } });
    expect(MERCADOPAGO_DEFAULT_BASE_URL).toBe("https://api.mercadopago.com");
  });
  it("token ausente ou em branco recusa", () => {
    expect(resolveMercadoPagoConfig({})).toEqual({ ok: false, reason: "token" });
    expect(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: "   " })).toEqual({ ok: false, reason: "token" });
  });
  it("MERCADOPAGO_BASE_URL só aceita localhost, 127.0.0.1 e host.docker.internal (fake local)", () => {
    for (const u of ["http://localhost:55999", "http://127.0.0.1:55999/", "http://host.docker.internal:55999"]) {
      expect(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: TOKEN, MERCADOPAGO_BASE_URL: u })).toEqual({
        ok: true, config: { accessToken: TOKEN, baseUrl: u.replace(/\/+$/, "") },
      });
    }
    for (const u of ["https://evil.example.com", "http://localhost.evil.com", "http://user@evil.com", "http://localhost@evil.com", "ftp://localhost", "nao-e-url"]) {
      expect(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: TOKEN, MERCADOPAGO_BASE_URL: u })).toEqual({ ok: false, reason: "base_url" });
    }
  });
  it("o motivo de recusa nunca carrega o token", () => {
    expect(JSON.stringify(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: TOKEN, MERCADOPAGO_BASE_URL: "https://x.test" }))).not.toContain(TOKEN);
  });

  describe("isolamento por ambiente (token de sandbox nunca cai no de produção)", () => {
    const P = "PROD-FICTICIO", S = "SBX-FICTICIO";
    it("sem env: comportamento legado (token principal)", () => {
      expect(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: P })).toMatchObject({ ok: true, config: { accessToken: P } });
    });
    it("production usa SEMPRE o token principal, mesmo com o de sandbox presente", () => {
      expect(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: P, MERCADOPAGO_ACCESS_TOKEN_SANDBOX: S }, "production")).toMatchObject({ ok: true, config: { accessToken: P } });
    });
    it("sandbox usa o token de sandbox", () => {
      expect(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: P, MERCADOPAGO_ACCESS_TOKEN_SANDBOX: S }, "sandbox")).toMatchObject({ ok: true, config: { accessToken: S } });
    });
    it("sandbox SEM token de sandbox recusa (nunca usa o de produção na API real)", () => {
      expect(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: P }, "sandbox")).toEqual({ ok: false, reason: "token" });
      expect(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: P, MERCADOPAGO_ACCESS_TOKEN_SANDBOX: "  " }, "sandbox")).toEqual({ ok: false, reason: "token" });
    });
    it("sandbox contra o fake local (BASE_URL local) pode reutilizar o token único do teste", () => {
      expect(resolveMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: "FAKE-1", MERCADOPAGO_BASE_URL: "http://127.0.0.1:9" }, "sandbox")).toMatchObject({ ok: true, config: { accessToken: "FAKE-1" } });
    });
  });
});
