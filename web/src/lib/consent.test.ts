import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ConsentError, currentConsent, PRIVACY_VERSION, recordConsent, TERMS_VERSION } from "./consent";

const fake = (error: { message: string; code?: string } | null = null) => ({ rpc: vi.fn().mockResolvedValue({ data: null, error }) });

const ACKS = { termsAccepted: true, privacyAcknowledged: true };
const base = { termsVersion: "v1", privacyVersion: "v2", role: "convidado" as const, eventId: "e-1", context: "entrar-evento" as const, ...ACKS };

describe("recordConsent", () => {
  it("chama a RPC record_consent com versões, papel, evento, contexto e as duas confirmações separadas", async () => {
    const c = fake();
    await recordConsent(base, c as never);
    expect(c.rpc).toHaveBeenCalledWith("record_consent", { p_terms_version: "v1", p_privacy_version: "v2", p_role: "convidado", p_event_id: "e-1", p_terms_accepted: true, p_privacy_ack: true, p_context: "entrar-evento" });
  });
  it("evento ausente vai como null", async () => {
    const c = fake();
    await recordConsent({ ...base, role: "organizador", eventId: null, context: "criar-evento" }, c as never);
    expect(c.rpc).toHaveBeenCalledWith("record_consent", expect.objectContaining({ p_event_id: null, p_context: "criar-evento" }));
  });
  it("falha de gravação vira ConsentError: nunca falso sucesso", async () => {
    const c = fake({ message: "forbidden", code: "MM004" });
    await expect(recordConsent(currentConsent("organizador", null, ACKS), c as never)).rejects.toBeInstanceOf(ConsentError);
  });
  it("papel inválido nem chega ao servidor", async () => {
    const c = fake();
    await expect(recordConsent({ ...base, role: "master" as never }, c as never)).rejects.toBeInstanceOf(ConsentError);
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("recusa dos Termos: nada é gravado", async () => {
    const c = fake();
    await expect(recordConsent({ ...base, termsAccepted: false }, c as never)).rejects.toBeInstanceOf(ConsentError);
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("sem a ciência da Política: nada é gravado (uma confirmação não vale pela outra)", async () => {
    const c = fake();
    await expect(recordConsent({ ...base, privacyAcknowledged: false }, c as never)).rejects.toBeInstanceOf(ConsentError);
    expect(c.rpc).not.toHaveBeenCalled();
  });
});

describe("versões vigentes", () => {
  it("currentConsent usa as versões publicadas", () => {
    expect(currentConsent("convidado", "e-9", ACKS)).toEqual({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, role: "convidado", eventId: "e-9", context: "entrar-evento", ...ACKS });
    expect(currentConsent("organizador", null, ACKS)).toMatchObject({ role: "organizador", context: "criar-evento" });
  });
  it("sem confirmações marcadas, currentConsent não as inventa", () => {
    expect(currentConsent("convidado", null, { termsAccepted: false, privacyAcknowledged: false })).toMatchObject({ termsAccepted: false, privacyAcknowledged: false });
  });
  it("a versão vigente é a 2026-10-22-v1", () => {
    expect(TERMS_VERSION).toBe("2026-10-22-v1");
    expect(PRIVACY_VERSION).toBe("2026-10-22-v1");
  });
  it("as versões do código existem na migration que as publica (sem divergência)", () => {
    const sql = readFileSync(resolve(__dirname, "../../../supabase/migrations/20261022001300_legal_v1_retention.sql"), "utf8");
    expect(sql).toContain(`('terms', '${TERMS_VERSION}'`);
    expect(sql).toContain(`('privacy', '${PRIVACY_VERSION}'`);
  });
});
