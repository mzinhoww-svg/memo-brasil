import { describe, expect, it, vi } from "vitest";
import { sha256Hex } from "./wa-optin";
import { handleReturn, isTechnicalEmail, technicalEmail, type ReturnDeps } from "./wa-return";

const US = "22222222-2222-4222-8222-222222222222";
const TOKEN = "B".repeat(43);
const deps = (over: Partial<ReturnDeps> = {}): ReturnDeps => ({
  callerUserId: null,
  consume: vi.fn(async () => ({ status: "ok" as const, userId: US, code: "AB23CD45", title: "Casamento" })),
  getUser: vi.fn(async () => ({ email: null, isAnonymous: true })),
  setTechnicalEmail: vi.fn(async () => undefined),
  restoreAnonymous: vi.fn(async () => true),
  magicLink: vi.fn(async () => "hash-do-link"),
  ...over,
});

describe("troca do token de volta", () => {
  it("convidado anônimo sem sessão: e-mail técnico, continua anônimo, link mágico do MESMO usuário", async () => {
    const d = deps();
    expect(await handleReturn({ token: TOKEN }, d)).toEqual({ status: 200, body: { status: "ok", tokenHash: "hash-do-link", code: "AB23CD45", title: "Casamento" } });
    expect(d.consume).toHaveBeenCalledWith(await sha256Hex(TOKEN)); // só o hash vai ao banco
    expect(d.setTechnicalEmail).toHaveBeenCalledWith(US, technicalEmail(US));
    expect(d.restoreAnonymous).toHaveBeenCalledWith(US);
    expect(d.magicLink).toHaveBeenCalledWith(`wa-${US}@retorno.invalid`);
  });
  it("conta com e-mail de verdade: usa o próprio e-mail, não mexe em nada", async () => {
    const d = deps({ getUser: vi.fn(async () => ({ email: "ana@exemplo.com", isAnonymous: false })) });
    await handleReturn({ token: TOKEN }, d);
    expect(d.setTechnicalEmail).not.toHaveBeenCalled();
    expect(d.restoreAnonymous).not.toHaveBeenCalled();
    expect(d.magicLink).toHaveBeenCalledWith("ana@exemplo.com");
  });
  it("o navegador já é desse convidado: só volta, sem emitir link", async () => {
    const d = deps({ callerUserId: US });
    expect((await handleReturn({ token: TOKEN }, d)).body).toEqual({ status: "ok", same: true, code: "AB23CD45", title: "Casamento" });
    expect(d.magicLink).not.toHaveBeenCalled();
  });
  it.each(["used", "expired", "blocked"] as const)("token %s: explica e devolve o código do evento para entrar de novo", async (status) => {
    const d = deps({ consume: vi.fn(async () => ({ status, code: "AB23CD45", title: "Casamento" })) });
    expect((await handleReturn({ token: TOKEN }, d)).body).toEqual({ status, code: "AB23CD45", title: "Casamento" });
    expect(d.magicLink).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "curto", "B".repeat(44), "B".repeat(42) + "!"])("formato inválido (%s): nem consulta o banco", async (token) => {
    const d = deps();
    expect((await handleReturn({ token }, d)).body).toEqual({ status: "invalid" });
    expect(d.consume).not.toHaveBeenCalled();
  });
  it("não conseguiu manter anônimo: falha (não entrega sessão que viraria conta)", async () => {
    await expect(handleReturn({ token: TOKEN }, deps({ restoreAnonymous: vi.fn(async () => false) }))).rejects.toThrow("restore");
  });
  it("e-mail técnico é reconhecido (para nunca aparecer na tela)", () => {
    expect(isTechnicalEmail(technicalEmail(US))).toBe(true);
    expect(isTechnicalEmail("ana@exemplo.com")).toBe(false);
    expect(isTechnicalEmail(undefined)).toBe(false);
  });
});
