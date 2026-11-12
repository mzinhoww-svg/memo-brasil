import { afterEach, describe, expect, it, vi } from "vitest";
import { hasRememberedConsent, rememberConsent } from "./consent";

afterEach(() => { window.localStorage.clear(); vi.restoreAllMocks(); });

describe("aceite lembrado neste aparelho", () => {
  it("depois de aceitar, a mesma pessoa não é perguntada de novo; outra pessoa é", () => {
    expect(hasRememberedConsent("u1")).toBe(false);
    rememberConsent("u1");
    expect(hasRememberedConsent("u1")).toBe(true);
    expect(hasRememberedConsent("u2")).toBe(false);
  });
  it("sem pessoa identificada nunca vale", () => {
    rememberConsent(null);
    expect(hasRememberedConsent(null)).toBe(false);
    expect(hasRememberedConsent(undefined)).toBe(false);
  });
  it("sem armazenamento (modo privado) não quebra e volta a perguntar", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("cheio"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(() => rememberConsent("u1")).not.toThrow();
    expect(hasRememberedConsent("u1")).toBe(false);
  });
});
