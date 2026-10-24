import { describe, expect, it } from "vitest";
import type { MercadoPagoConfig, MpPayment } from "./mercadopago";
import { buildBackUrls, collectPayments, notificationEventKey, parseNotification, pickOrigin, PREFERENCE_TTL_MIN, refundBlocker } from "./mercadopago-flow";

describe("pickOrigin / buildBackUrls", () => {
  const EV = "22222222-2222-4222-8222-222222222222";
  it("produção: só o domínio oficial ou ALLOWED_ORIGINS extra; preview e localhost caem no oficial", () => {
    expect(pickOrigin("https://newmemocuiaba.vercel.app", "", "production")).toBe("https://newmemocuiaba.vercel.app");
    expect(pickOrigin("https://newmemocuiaba-abc-mzinhoww-gmailcoms-projects.vercel.app", "", "production")).toBe("https://newmemocuiaba.vercel.app");
    expect(pickOrigin("http://localhost:3000", "", "production")).toBe("https://newmemocuiaba.vercel.app");
    expect(pickOrigin("https://app.exemplo.com.br", "https://app.exemplo.com.br", "production")).toBe("https://app.exemplo.com.br");
    expect(pickOrigin("https://evil.example.com", "", "production")).toBe("https://newmemocuiaba.vercel.app");
    expect(pickOrigin(null, "", "production")).toBe("https://newmemocuiaba.vercel.app");
  });
  it("sandbox aceita previews e localhost permitidos", () => {
    expect(pickOrigin("http://localhost:3000", "", "sandbox")).toBe("http://localhost:3000");
    expect(pickOrigin("https://evil.example.com", "", "sandbox")).toBe("https://newmemocuiaba.vercel.app");
  });
  it("back_urls fixas com retorno=sucesso|pendente|falha", () => {
    expect(buildBackUrls("https://newmemocuiaba.vercel.app", EV)).toEqual({
      success: `https://newmemocuiaba.vercel.app/painel/${EV}/plano?retorno=sucesso`,
      pending: `https://newmemocuiaba.vercel.app/painel/${EV}/plano?retorno=pendente`,
      failure: `https://newmemocuiaba.vercel.app/painel/${EV}/plano?retorno=falha`,
    });
  });
  it("expiração da preferência é 60 min", () => expect(PREFERENCE_TTL_MIN).toBe(60));
});

describe("parseNotification / notificationEventKey", () => {
  const body = JSON.stringify({ action: "payment.updated", api_version: "v1", data: { id: "999" }, date_created: "2026-10-23T12:00:00Z", id: 12345, live_mode: false, type: "payment", user_id: 900 });
  it("lê tipo, ação e data.id do corpo, com a query como fonte preferida do data.id", () => {
    expect(parseNotification(body, "https://x.test/f?data.id=ABC1&type=payment")).toMatchObject({ type: "payment", action: "payment.updated", dataId: "ABC1", liveMode: false });
    expect(parseNotification(body, "https://x.test/f")).toMatchObject({ dataId: "999" });
  });
  it("aceita notificação de formato antigo (topic/id na query)", () => {
    expect(parseNotification("", "https://x.test/f?topic=payment&id=555")).toMatchObject({ type: "payment", dataId: "555", action: null });
  });
  it("corpo inválido não lança", () => {
    expect(parseNotification("{{", "https://x.test/f")).toMatchObject({ type: null, dataId: null });
  });
  it("chave do evento é estável e depende de tipo, id, ação e data", () => {
    const n = parseNotification(body, "https://x.test/f?data.id=999");
    expect(notificationEventKey(n, "req-1")).toBe("mp:payment:999:payment.updated:2026-10-23T12:00:00Z");
    expect(notificationEventKey({ ...n, dateCreated: null }, "req-1")).toBe("mp:payment:999:payment.updated:req-1");
    expect(notificationEventKey({ ...n, dateCreated: null }, null)).toBe("mp:payment:999:payment.updated:x");
  });
});

describe("collectPayments (conciliação: paginação limitada)", () => {
  const mkPay = (id: string): MpPayment => ({ id, status: "approved", amountCents: 2900, currency: "BRL", liveMode: false, collectorId: "900", externalReference: "o", method: "pix", updatedAt: null, refundedCents: 0 });
  function cfgWith(pages: Record<number, { total: number; ids: string[] }>, seen: number[] = []) {
    const fetchImpl = (async (url: string) => {
      const u = new URL(url);
      const off = Number(u.searchParams.get("offset"));
      seen.push(off);
      const p = pages[off] ?? { total: 0, ids: [] };
      return new Response(JSON.stringify({ paging: { total: p.total, limit: 2, offset: off }, results: p.ids.map((id) => ({ id, status: "approved" })) }), { status: 200 });
    }) as unknown as typeof fetch;
    return { accessToken: "t", baseUrl: "https://mp.test", fetchImpl } as MercadoPagoConfig;
  }
  it("percorre até o total e marca completo", async () => {
    const seen: number[] = [];
    const r = await collectPayments(cfgWith({ 0: { total: 3, ids: ["1", "2"] }, 2: { total: 3, ids: ["3"] } }, seen), "o", { pageSize: 50, maxPages: 5 });
    expect(seen).toEqual([0, 2]);
    expect(r.payments.map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(r.complete).toBe(true);
  });
  it("para no teto de páginas e marca incompleto", async () => {
    const seen: number[] = [];
    const pages: Record<number, { total: number; ids: string[] }> = {};
    for (let i = 0; i < 10; i++) pages[i * 2] = { total: 100, ids: [`a${i}`, `b${i}`] };
    const r = await collectPayments(cfgWith(pages, seen), "o", { pageSize: 2, maxPages: 3 });
    expect(seen).toEqual([0, 2, 4]);
    expect(r.payments).toHaveLength(6);
    expect(r.complete).toBe(false);
  });
  it("página vazia encerra", async () => {
    const r = await collectPayments(cfgWith({ 0: { total: 0, ids: [] } }), "o", { pageSize: 2, maxPages: 3 });
    expect(r).toEqual({ payments: [], complete: true });
  });
  it("erro do provedor propaga (o chamador decide)", async () => {
    const cfg = { accessToken: "t", baseUrl: "https://mp.test", fetchImpl: (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch } as MercadoPagoConfig;
    await expect(collectPayments(cfg, "o", { pageSize: 2, maxPages: 3 })).rejects.toMatchObject({ kind: "provider" });
  });
});

describe("refundBlocker (payments-refund)", () => {
  const order = { id: "o1", provider: "mercadopago", status: "pago", provider_env: "sandbox" as const, amount_cents: 2900 };
  const pay: MpPayment = { id: "p1", status: "approved", amountCents: 2900, currency: "BRL", liveMode: false, collectorId: "900", externalReference: "o1", method: "pix", updatedAt: null, refundedCents: 0 };
  const primary = { kind: "primary" as const, requestedAt: "2026-10-23T12:00:00Z" };
  const extra = { kind: "extra" as const, requestedAt: "2026-10-23T12:00:00Z" };
  it("sem solicitação gravada não reembolsa", () => {
    expect(refundBlocker(order, { kind: "primary", requestedAt: null })).toBe("reembolso_nao_solicitado");
  });
  it("histórico AbacatePay não é reembolsado por aqui", () => {
    expect(refundBlocker({ ...order, provider: "abacatepay" }, primary)).toBe("provedor_historico");
  });
  it("primário exige pedido pago; extra não", () => {
    expect(refundBlocker({ ...order, status: "em_disputa" }, primary)).toBe("estado_invalido");
    expect(refundBlocker({ ...order, status: "cancelado" }, extra)).toBeNull();
  });
  it("reconsulta: aprovado, do pedido, recebedor, ambiente e (só no primário) valor", () => {
    expect(refundBlocker(order, primary, pay, "900")).toBeNull();
    expect(refundBlocker(order, primary, { ...pay, status: "refunded" }, "900")).toBe("cobranca_nao_paga");
    expect(refundBlocker(order, primary, { ...pay, externalReference: "outro" }, "900")).toBe("cobranca_nao_confere");
    expect(refundBlocker(order, primary, { ...pay, amountCents: 100 }, "900")).toBe("cobranca_nao_confere");
    expect(refundBlocker(order, primary, pay, "777")).toBe("recebedor_divergente");
    expect(refundBlocker(order, primary, pay, null)).toBe("recebedor_divergente");
    expect(refundBlocker(order, primary, { ...pay, liveMode: true }, "900")).toBe("ambiente_divergente");
    expect(refundBlocker(order, primary, { ...pay, liveMode: null }, "900")).toBe("ambiente_divergente");
    // extra: valor divergente é justamente o caso; identidade, recebedor e ambiente nunca são dispensados
    expect(refundBlocker({ ...order, status: "cancelado" }, extra, { ...pay, amountCents: 100 }, "900")).toBeNull();
    expect(refundBlocker({ ...order, status: "cancelado" }, extra, { ...pay, externalReference: "outro" }, "900")).toBe("cobranca_nao_confere");
  });
});
