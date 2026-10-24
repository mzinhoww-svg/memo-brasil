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
});
