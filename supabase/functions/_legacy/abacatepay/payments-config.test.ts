// Testes puros da leitura de configuração das funções de pagamento (ambiente, chave e URL base do provedor).
// Rodar: cd web && npx vitest run --config vitest.functions.config.ts
import { describe, expect, it } from "vitest";
import { ABACATEPAY_DEFAULT_BASE_URL, resolveAbacateConfig } from "./payments-config";

// Valores fictícios, só para teste.
const DEV = "abc_dev_fake_config_test";
const PROD = "abc_prod_fake_config_test";

describe("resolveAbacateConfig", () => {
  it("sandbox com chave abc_dev_ usa a URL oficial por padrão", () => {
    expect(resolveAbacateConfig({ ABACATEPAY_ENV: "sandbox", ABACATEPAY_API_KEY: DEV })).toEqual({
      ok: true,
      env: "sandbox",
      config: { apiKey: DEV, baseUrl: ABACATEPAY_DEFAULT_BASE_URL },
    });
    expect(ABACATEPAY_DEFAULT_BASE_URL).toBe("https://api.abacatepay.com/v2");
  });

  it("production exige chave abc_prod_; sandbox exige abc_dev_ (chave trocada recusa)", () => {
    expect(resolveAbacateConfig({ ABACATEPAY_ENV: "production", ABACATEPAY_API_KEY: PROD })).toMatchObject({ ok: true, env: "production" });
    expect(resolveAbacateConfig({ ABACATEPAY_ENV: "production", ABACATEPAY_API_KEY: DEV })).toEqual({ ok: false, reason: "chave_ambiente" });
    expect(resolveAbacateConfig({ ABACATEPAY_ENV: "sandbox", ABACATEPAY_API_KEY: PROD })).toEqual({ ok: false, reason: "chave_ambiente" });
  });

  it("ambiente ausente ou desconhecido, ou chave ausente, recusa", () => {
    expect(resolveAbacateConfig({ ABACATEPAY_API_KEY: DEV })).toEqual({ ok: false, reason: "ambiente" });
    expect(resolveAbacateConfig({ ABACATEPAY_ENV: "desligado", ABACATEPAY_API_KEY: DEV })).toEqual({ ok: false, reason: "ambiente" });
    expect(resolveAbacateConfig({ ABACATEPAY_ENV: "sandbox" })).toEqual({ ok: false, reason: "chave_ambiente" });
  });

  it("ABACATEPAY_BASE_URL só vale em sandbox e com host localhost, 127.0.0.1 ou host.docker.internal", () => {
    for (const u of ["http://localhost:54999/v2", "http://127.0.0.1:54999/v2/", "http://host.docker.internal:54999/v2"]) {
      expect(resolveAbacateConfig({ ABACATEPAY_ENV: "sandbox", ABACATEPAY_API_KEY: DEV, ABACATEPAY_BASE_URL: u })).toEqual({
        ok: true,
        env: "sandbox",
        config: { apiKey: DEV, baseUrl: u.replace(/\/+$/, "") },
      });
    }
    for (const u of ["https://evil.example.com/v2", "http://localhost.evil.com/v2", "http://user@evil.com/v2", "http://localhost@evil.com/v2", "ftp://localhost/v2", "nao-e-url"]) {
      expect(resolveAbacateConfig({ ABACATEPAY_ENV: "sandbox", ABACATEPAY_API_KEY: DEV, ABACATEPAY_BASE_URL: u })).toEqual({ ok: false, reason: "base_url" });
    }
    expect(resolveAbacateConfig({ ABACATEPAY_ENV: "production", ABACATEPAY_API_KEY: PROD, ABACATEPAY_BASE_URL: "http://localhost:54999/v2" })).toEqual({ ok: false, reason: "base_url" });
    expect(resolveAbacateConfig({ ABACATEPAY_ENV: "sandbox", ABACATEPAY_API_KEY: DEV, ABACATEPAY_BASE_URL: "" })).toMatchObject({ ok: true, config: { baseUrl: ABACATEPAY_DEFAULT_BASE_URL } });
  });

  it("o motivo de recusa nunca carrega a chave", () => {
    const r = resolveAbacateConfig({ ABACATEPAY_ENV: "production", ABACATEPAY_API_KEY: DEV });
    expect(JSON.stringify(r)).not.toContain(DEV);
  });
});
