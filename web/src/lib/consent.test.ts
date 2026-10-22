import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ConsentError, currentConsent, PRIVACY_VERSION, recordConsent, TERMS_VERSION } from "./consent";

const fake = (error: { message: string; code?: string } | null = null) => ({ rpc: vi.fn().mockResolvedValue({ data: null, error }) });

describe("recordConsent", () => {
  it("chama a RPC record_consent com versões, papel e evento", async () => {
    const c = fake();
    await recordConsent({ termsVersion: "v1", privacyVersion: "v2", role: "convidado", eventId: "e-1" }, c as never);
    expect(c.rpc).toHaveBeenCalledWith("record_consent", { p_terms_version: "v1", p_privacy_version: "v2", p_role: "convidado", p_event_id: "e-1" });
  });
  it("evento ausente vai como null", async () => {
    const c = fake();
    await recordConsent({ termsVersion: "v1", privacyVersion: "v1", role: "organizador", eventId: null }, c as never);
    expect(c.rpc).toHaveBeenCalledWith("record_consent", expect.objectContaining({ p_event_id: null }));
  });
  it("falha de gravação vira ConsentError: nunca falso sucesso", async () => {
    const c = fake({ message: "forbidden", code: "MM004" });
    await expect(recordConsent(currentConsent("organizador", null), c as never)).rejects.toBeInstanceOf(ConsentError);
  });
  it("papel inválido nem chega ao servidor", async () => {
    const c = fake();
    await expect(recordConsent({ termsVersion: "v1", privacyVersion: "v1", role: "master" as never, eventId: null }, c as never)).rejects.toBeInstanceOf(ConsentError);
    expect(c.rpc).not.toHaveBeenCalled();
  });
});

describe("versões vigentes", () => {
  it("currentConsent usa as versões publicadas", () => {
    expect(currentConsent("convidado", "e-9")).toEqual({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, role: "convidado", eventId: "e-9" });
  });
  it("as versões do código existem na migration que as publica (sem divergência)", () => {
    const sql = readFileSync(resolve(__dirname, "../../../supabase/migrations/20261022001100_user_consents.sql"), "utf8");
    expect(sql).toContain(`('terms', '${TERMS_VERSION}')`);
    expect(sql).toContain(`('privacy', '${PRIVACY_VERSION}')`);
  });
});
