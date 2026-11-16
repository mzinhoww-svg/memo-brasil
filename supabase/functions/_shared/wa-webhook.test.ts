import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { handleWaWebhook, type ApplyFn } from "./wa-webhook";

const secret = "test-only-not-a-real-secret";
const EV = "11111111-1111-4111-8111-111111111111";
const US = "22222222-2222-4222-8222-222222222222";
const sign = (raw: string, key = secret) => `sha256=${createHmac("sha256", key).update(raw).digest("hex")}`;
const confirmed = (over: Record<string, unknown> = {}) => JSON.stringify({ type: "optin.confirmed", instanceId: "revela", project: "revela", subjectId: `${EV}.${US}`, phone: "5565999991111", code: "REV-1", at: "2026-11-16T10:00:00.000Z", ...over });
const revoked = (over: Record<string, unknown> = {}) => JSON.stringify({ type: "optin.revoked", instanceId: "revela", project: "revela", subjectId: `${EV}.${US}`, phone: "5565999991111", at: "2026-11-16T11:00:00.000Z", ...over });
const run = (raw: string, header: string | null, apply: ApplyFn, s = secret) => handleWaWebhook({ raw, signature: header, secret: s, apply });

describe("webhook do gateway", () => {
  it("assinatura inválida: 401 e NADA é lido nem gravado", async () => {
    const apply = vi.fn();
    const raw = confirmed();
    for (const h of [null, "", "sha256=" + "0".repeat(64), sign(raw, "outro"), sign(raw + " ")]) {
      expect((await run(raw, h, apply)).status).toBe(401);
    }
    expect(apply).not.toHaveBeenCalled();
  });
  it("a assinatura vem antes do parse: corpo que não é JSON, mas assinado, dá 400; sem assinatura dá 401", async () => {
    const apply = vi.fn();
    expect((await run("{nao json", sign("{nao json"), apply)).status).toBe(400);
    expect((await run("{nao json", null, apply)).status).toBe(401);
  });
  it("sem segredo configurado: 503 (falha fechada)", async () => {
    const raw = confirmed();
    expect((await run(raw, sign(raw, ""), vi.fn(), "")).status).toBe(503);
  });
  it("corpo gigante: 413 sem verificar", async () => {
    expect((await run("x".repeat(70_000), null, vi.fn())).status).toBe(413);
  });
  it("optin.confirmed: aplica com telefone só de dígitos e responde 200", async () => {
    const apply = vi.fn(async () => "applied" as const);
    const raw = confirmed({ phone: "+55 (65) 99999-1111" });
    const r = await run(raw, sign(raw), apply);
    expect(r).toEqual({ status: 200, body: { ok: true, outcome: "applied" } });
    expect(apply).toHaveBeenCalledWith({ type: "optin.confirmed", eventId: EV, userId: US, phone: "5565999991111", at: "2026-11-16T10:00:00.000Z" });
  });
  it("optin.revoked: aplica; telefone é opcional", async () => {
    const apply = vi.fn(async () => "applied" as const);
    const raw = revoked({ phone: undefined });
    expect((await run(raw, sign(raw), apply)).status).toBe(200);
    expect(apply).toHaveBeenCalledWith({ type: "optin.revoked", eventId: EV, userId: US, phone: null, at: "2026-11-16T11:00:00.000Z" });
  });
  it("é idempotente: o mesmo evento duas vezes dá a mesma resposta", async () => {
    const apply = vi.fn(async () => "applied" as const);
    const raw = confirmed();
    expect(await run(raw, sign(raw), apply)).toEqual(await run(raw, sign(raw), apply));
  });
  it("evento fora de ordem repassa o resultado 'stale' como 200 (sem nova tentativa)", async () => {
    const r = await run(confirmed(), sign(confirmed()), vi.fn(async () => "stale" as const));
    expect(r).toEqual({ status: 200, body: { ok: true, outcome: "stale" } });
  });
  it("message.received e tipos desconhecidos são ignorados com 200", async () => {
    const apply = vi.fn();
    for (const type of ["message.received", "algo.novo"]) {
      const raw = JSON.stringify({ type, instanceId: "revela", project: "revela", text: "oi" });
      expect(await run(raw, sign(raw), apply)).toEqual({ status: 200, body: { ok: true, ignored: "type" } });
    }
    expect(apply).not.toHaveBeenCalled();
  });
  it("outro projeto ou outra instância: ignorado com 200, nunca aplicado", async () => {
    const apply = vi.fn();
    for (const over of [{ project: "outro" }, { instanceId: "outra" }, { project: undefined }]) {
      const raw = confirmed(over);
      expect(await run(raw, sign(raw), apply)).toEqual({ status: 200, body: { ok: true, ignored: "project" } });
    }
    expect(apply).not.toHaveBeenCalled();
  });
  it("subjectId que não é nosso: ignorado com 200", async () => {
    const apply = vi.fn();
    const raw = confirmed({ subjectId: "convidado-123" });
    expect(await run(raw, sign(raw), apply)).toEqual({ status: 200, body: { ok: true, ignored: "subject" } });
    expect(apply).not.toHaveBeenCalled();
  });
  it.each([{ phone: "123" }, { phone: undefined }, { phone: 5565999991111 }, { at: "ontem" }, { at: undefined }])("confirmação malformada %j: 400", async (over) => {
    const apply = vi.fn();
    const raw = confirmed(over);
    expect((await run(raw, sign(raw), apply)).status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });
  it("JSON que não é objeto: 400", async () => {
    for (const raw of ["[]", "null", '"x"', "7"]) expect((await run(raw, sign(raw), vi.fn())).status).toBe(400);
  });
  it("falha ao gravar: 500, para o gateway tentar de novo (a gravação é idempotente)", async () => {
    const raw = confirmed();
    expect((await run(raw, sign(raw), vi.fn(async () => { throw new Error("db"); }))).status).toBe(500);
  });
  it("a resposta nunca devolve telefone nem segredo", async () => {
    const raw = confirmed();
    const r = await run(raw, sign(raw), vi.fn(async () => "applied" as const));
    expect(JSON.stringify(r)).not.toMatch(/5565|test-only/);
  });
});
