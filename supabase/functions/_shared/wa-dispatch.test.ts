import { describe, expect, it, vi } from "vitest";
import { WaGatewayError } from "./wa-gateway";
import { buildMessage, runDispatch, type ClaimedItem, type DispatchDeps } from "./wa-dispatch";

const item = (over: Partial<ClaimedItem> = {}): ClaimedItem => ({
  event_id: "11111111-1111-4111-8111-111111111111", user_id: "22222222-2222-4222-8222-222222222222",
  kind: "revealed", phone: "5565999991111", title: "Casamento Ana e Beto", code: "AB23CD45", attempts: 1, ...over,
});
const mk = (items: ClaimedItem[], over: Partial<DispatchDeps> = {}): DispatchDeps => ({
  enabled: vi.fn(async () => true),
  claim: vi.fn(async () => items),
  send: vi.fn(async () => ({ id: "gw-1" })),
  mark: vi.fn(async () => undefined),
  revoke: vi.fn(async () => undefined),
  sleep: vi.fn(async () => undefined),
  siteOrigin: "https://app.example.test",
  batch: 4, hourlyCap: 55, maxAttempts: 5,
  ...over,
});

describe("buildMessage", () => {
  it("aviso de revelação: curto, com o link do álbum e a saída", () => {
    const t = buildMessage(item(), "https://app.example.test")!;
    expect(t).toContain("Casamento Ana e Beto");
    expect(t).toContain("https://app.example.test/e/AB23CD45/agora");
    expect(t).toContain("SAIR");
    expect(t.length).toBeLessThan(400);
  });
  it("título gigante ou com quebras é aparado", () => {
    const t = buildMessage(item({ title: "A\n\n" + "x".repeat(200) }), "https://app.example.test")!;
    expect(t).not.toMatch(/\n\n\n/);
    expect(t.length).toBeLessThan(400);
  });
  it("tipo desconhecido não gera texto", () => {
    expect(buildMessage(item({ kind: "outro" }))).toBeNull();
  });
});

describe("runDispatch", () => {
  it("com o recurso desligado não retira nada da fila", async () => {
    const d = mk([item()], { enabled: vi.fn(async () => false) });
    expect(await runDispatch(d)).toMatchObject({ sent: 0, skipped: "desligado" });
    expect(d.claim).not.toHaveBeenCalled();
  });
  it("envia e marca como enviado, com o id do gateway", async () => {
    const d = mk([item()]);
    const r = await runDispatch(d);
    expect(r).toMatchObject({ sent: 1, failed: 0, retried: 0, revoked: 0 });
    expect(d.send).toHaveBeenCalledWith({ phone: "5565999991111", text: expect.stringContaining("Casamento Ana e Beto") });
    expect(d.mark).toHaveBeenCalledWith(expect.objectContaining({ kind: "revealed" }), "enviado", { gatewayId: "gw-1" });
  });
  it("pede o lote com o tamanho e o teto por hora configurados", async () => {
    const d = mk([]);
    await runDispatch(d);
    expect(d.claim).toHaveBeenCalledWith(4, 55);
  });
  it("409 NO_OPT_IN: marca revogado, registra a saída e NUNCA reenvia", async () => {
    const d = mk([item()], { send: vi.fn(async () => { throw new WaGatewayError("no_optin", 409); }) });
    const r = await runDispatch(d);
    expect(r).toMatchObject({ sent: 0, revoked: 1 });
    expect(d.mark).toHaveBeenCalledWith(expect.anything(), "revogado", { error: "no_optin" });
    expect(d.revoke).toHaveBeenCalledTimes(1);
    expect(d.send).toHaveBeenCalledTimes(1);
  });
  it("erro passageiro: reagenda com espera crescente", async () => {
    const d = mk([item({ attempts: 2 })], { send: vi.fn(async () => { throw new WaGatewayError("unavailable", 503); }) });
    const r = await runDispatch(d);
    expect(r).toMatchObject({ retried: 1, failed: 0 });
    expect(d.mark).toHaveBeenCalledWith(expect.anything(), "pendente", { error: "unavailable", retryInS: 600 });
  });
  it("na última tentativa vira falhou", async () => {
    const d = mk([item({ attempts: 5 })], { send: vi.fn(async () => { throw new WaGatewayError("timeout"); }) });
    expect(await runDispatch(d)).toMatchObject({ failed: 1, retried: 0 });
    expect(d.mark).toHaveBeenCalledWith(expect.anything(), "falhou", { error: "timeout" });
  });
  it("limite do gateway (429): reagenda e PARA o lote, sem martelar", async () => {
    const d = mk([item(), item({ user_id: "33333333-3333-4333-8333-333333333333" })], { send: vi.fn(async () => { throw new WaGatewayError("rate_limited", 429); }) });
    const r = await runDispatch(d);
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(r.stoppedEarly).toBe(true);
  });
  it("chave recusada (401/403): para o lote e não gasta tentativa dos demais", async () => {
    const d = mk([item(), item({ user_id: "33333333-3333-4333-8333-333333333333" })], { send: vi.fn(async () => { throw new WaGatewayError("unauthorized", 401); }) });
    const r = await runDispatch(d);
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(r.stoppedEarly).toBe(true);
  });
  it("telefone ausente ou tipo desconhecido: não envia, marca revogado/falhou", async () => {
    const d = mk([item({ phone: null }), item({ kind: "outro", user_id: "33333333-3333-4333-8333-333333333333" })]);
    const r = await runDispatch(d);
    expect(d.send).not.toHaveBeenCalled();
    expect(r).toMatchObject({ revoked: 1, failed: 1 });
  });
  it("espaça os envios do lote (nunca em loop apertado)", async () => {
    const d = mk([item(), item({ user_id: "33333333-3333-4333-8333-333333333333" }), item({ user_id: "44444444-4444-4444-8444-444444444444" })]);
    await runDispatch(d);
    expect(d.sleep).toHaveBeenCalledTimes(2);
    expect(d.sleep).toHaveBeenCalledWith(1500);
  });
  it("o relatório não carrega telefone", async () => {
    expect(JSON.stringify(await runDispatch(mk([item()])))).not.toContain("5565");
  });
});
