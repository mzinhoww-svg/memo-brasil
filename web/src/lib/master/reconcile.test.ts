import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureSecondFactor, reconcileNow, reconcileText } from "./reconcile";

const invoke = vi.fn();
const mfa = { getAuthenticatorAssuranceLevel: vi.fn(), listFactors: vi.fn(), challengeAndVerify: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ functions: { invoke }, auth: { mfa } }) }));
afterEach(() => { invoke.mockReset(); Object.values(mfa).forEach((f) => f.mockReset()); });
const failWith = (error: string) => ({ data: null, error: { context: { json: async () => ({ error }) } } });

describe("Conciliar agora", () => {
  it("sucesso devolve os totais", async () => {
    invoke.mockResolvedValue({ data: { ok: true, confirmed: 2, failed: 1 }, error: null });
    expect(await reconcileNow()).toEqual({ kind: "ok", confirmed: 2, failed: 1 });
    expect(invoke).toHaveBeenCalledWith("payments-reconcile-now", { body: {} });
  });
  it("devolve também 'sem mudança' e as falhas por pedido (função estendida)", async () => {
    invoke.mockResolvedValue({ data: { ok: true, confirmed: 12, failed: 1, unchanged: 58, failures: [{ label: "#RV-2039 · Formatura Medicina", message: "O provedor respondeu com erro (503). A rotina tenta de novo." }] }, error: null });
    expect(await reconcileNow()).toEqual({ kind: "ok", confirmed: 12, failed: 1, unchanged: 58, failures: [{ label: "#RV-2039 · Formatura Medicina", message: "O provedor respondeu com erro (503). A rotina tenta de novo." }] });
    invoke.mockResolvedValue({ data: { ok: true, confirmed: 0, failed: 0, unchanged: 0, failures: [] }, error: null });
    expect(await reconcileNow()).toMatchObject({ unchanged: 0, failures: [] });
  });
  it("traduz as recusas da função", async () => {
    invoke.mockResolvedValue(failWith("stepup"));
    expect(await reconcileNow()).toEqual({ kind: "stepup" });
    invoke.mockResolvedValue(failWith("ratelimited"));
    expect(await reconcileNow()).toEqual({ kind: "ratelimited" });
    invoke.mockResolvedValue(failWith("forbidden"));
    expect(await reconcileNow()).toEqual({ kind: "forbidden" });
    invoke.mockResolvedValue(failWith("indisponivel"));
    expect(await reconcileNow()).toEqual({ kind: "unavailable" });
    invoke.mockResolvedValue({ data: null, error: {} });
    expect(await reconcileNow()).toEqual({ kind: "unavailable" });
  });
  it("textos para a pessoa", () => {
    expect(reconcileText({ kind: "ok", confirmed: 0, failed: 0 })).toMatch(/nada pendente/);
    expect(reconcileText({ kind: "ok", confirmed: 3, failed: 0 })).toBe("Conciliação feita: 3 confirmados.");
    expect(reconcileText({ kind: "unavailable" })).toMatch(/5 minutos/);
  });
  it("segundo fator: já em aal2, sem autenticador, código errado e certo", async () => {
    const ask = vi.fn();
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2" } });
    expect(await ensureSecondFactor(ask)).toBe("ok");
    expect(ask).not.toHaveBeenCalled();
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1" } });
    mfa.listFactors.mockResolvedValue({ data: { totp: [] } });
    expect(await ensureSecondFactor(ask)).toBe("no-factor");
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f1", status: "verified" }] } });
    ask.mockReturnValue(null);
    expect(await ensureSecondFactor(ask)).toBe("cancelled");
    ask.mockReturnValue("123 456");
    mfa.challengeAndVerify.mockResolvedValue({ error: {} });
    expect(await ensureSecondFactor(ask)).toBe("wrong-code");
    mfa.challengeAndVerify.mockResolvedValue({ error: null });
    expect(await ensureSecondFactor(ask)).toBe("ok");
    expect(mfa.challengeAndVerify).toHaveBeenLastCalledWith({ factorId: "f1", code: "123456" });
  });
});
