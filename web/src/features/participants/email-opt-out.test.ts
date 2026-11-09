import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let mode: "local" | "supabase" = "supabase";
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ rpc }) }));
vi.mock("@/lib/supabase/env", () => ({ backendMode: () => mode }));

import { isOptOutToken, leaveByToken, resubscribeByToken } from "./email-opt-out";
import { getMyEmail, optOutMine, setMyEmail } from "./guest-email";

const TOKEN = "0b9a5c2e-6f0e-4e7e-9f55-1d8c2d2f7a10";
beforeEach(() => { rpc.mockReset(); mode = "supabase"; });

describe("24j · sair pelo link do e-mail", () => {
  it("só aceita o token no formato do link (UUID)", () => {
    expect(isOptOutToken(TOKEN)).toBe(true);
    expect(isOptOutToken("abc")).toBe(false);
    expect(isOptOutToken(null)).toBe(false);
  });
  it("lê o evento e o e-mail antes e tira da lista", async () => {
    rpc.mockImplementation(async (fn: string) => (fn === "email_opt_out_preview" ? { data: { title: "Ana & Leo", code: "ABC123", email: "bia@exemplo.com", optedOut: false }, error: null } : { data: true, error: null }));
    expect(await leaveByToken(TOKEN)).toEqual({ state: "ok", title: "Ana & Leo", code: "ABC123", email: "bia@exemplo.com" });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["email_opt_out_preview", "email_opt_out"]);
    expect(rpc).toHaveBeenLastCalledWith("email_opt_out", { p_token: TOKEN });
  });
  it("token desconhecido, sem token e modo local são inválidos; falha de rede é indisponível", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await leaveByToken(TOKEN)).toEqual({ state: "invalid" });
    expect(await leaveByToken(null)).toEqual({ state: "invalid" });
    mode = "local";
    expect(await leaveByToken(TOKEN)).toEqual({ state: "invalid" });
    mode = "supabase";
    rpc.mockResolvedValueOnce({ data: null, error: { code: "x" } });
    expect(await leaveByToken(TOKEN)).toEqual({ state: "unavailable" });
    rpc.mockRejectedValueOnce(new Error("offline"));
    expect(await leaveByToken(TOKEN)).toEqual({ state: "unavailable" });
  });
  it("voltar a receber reativa com o e-mail guardado", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await resubscribeByToken(TOKEN, "bia@exemplo.com")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("email_resubscribe", { p_token: TOKEN, p_email: "bia@exemplo.com" });
    expect(await resubscribeByToken(TOKEN, "isso-nao-e-email")).toBe(false);
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await resubscribeByToken(TOKEN, "bia@exemplo.com")).toBe(false);
  });
});

describe("24i · e-mail do convidado", () => {
  it("lê e grava com consentimento; vazio remove", async () => {
    rpc.mockResolvedValueOnce({ data: { email: "bia@exemplo.com", consent: true, optedOut: false }, error: null });
    expect(await getMyEmail("e1")).toEqual({ email: "bia@exemplo.com", consent: true, optedOut: false });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await setMyEmail("e1", " bia@exemplo.com ")).toBe("ok");
    expect(rpc).toHaveBeenLastCalledWith("set_my_email", { p_event: "e1", p_email: "bia@exemplo.com", p_consent: true });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await setMyEmail("e1", "  ");
    expect(rpc).toHaveBeenLastCalledWith("set_my_email", { p_event: "e1", p_email: null, p_consent: false });
  });
  it("traduz MM005, MM006, MM004 e MM018; e-mail torto nem sai do aparelho", async () => {
    expect(await setMyEmail("e1", "torto")).toBe("invalid");
    expect(rpc).not.toHaveBeenCalled();
    for (const [code, out] of [["MM005", "invalid"], ["MM006", "rate-limited"], ["MM004", "forbidden"], ["MM018", "consent"], ["XX", "unavailable"]] as const) {
      rpc.mockResolvedValueOnce({ data: null, error: { code } });
      expect(await setMyEmail("e1", "a@b.co")).toBe(out);
    }
  });
  it("sair dentro do app e modo local sem servidor", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await optOutMine("e1")).toBe(true);
    mode = "local";
    expect(await optOutMine("e1")).toBe(false);
    expect(await getMyEmail("e1")).toBeUndefined();
    expect(await setMyEmail("e1", "a@b.co")).toBe("unavailable");
  });
});
