import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { SB_READY, admin, installSim, makeEvent, makeUser, setSession, type TestUser } from "./payments-sim";

// COM-006 (Mercado Pago, Checkout Pro) contra Supabase LOCAL. Duas partes:
//
// 1) Sempre que há Supabase local (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_KEY): isolamento entre organizadores (REAL, RLS)
//    e resgate de código (RPC redeem_code SIMULADA por page.route; catálogo simulado por installSim, sem gravar platform_settings).
//
// 2) Só com PAYMENTS_MP_FAKE=1: ciclo completo com o BACKEND novo e o fake do provedor (e2e/fixtures/fake-mercadopago.mjs), que
//    pertencem à branch de backend (feat/mercadopago) e ainda não existem aqui. Estes testes ficam em `test.skip` até o merge.
//    Variáveis: PAYMENTS_MP_FAKE=1, PAYMENTS_MP_FAKE_URL (ex.: http://127.0.0.1:55491). Contrato ASSUMIDO do fake (ajustar após o merge,
//    se o nome real divergir): GET /__control/calls -> { create: number }; POST /__control/reset; POST /__control/config { failCreate: 500 };
//    POST /__control/pay { externalReference } -> cria e aprova o pagamento do pedido e dispara o webhook assinado para payments-webhook.
//    O navegador nunca vai ao domínio real: a navegação para o checkoutUrl é interceptada por page.route.
test.skip(!SB_READY, "precisa de Supabase local e das chaves no ambiente");
test.describe.configure({ mode: "serial" });

const created: string[] = [];
const FAKE_ON = process.env.PAYMENTS_MP_FAKE === "1";
const FAKE = process.env.PAYMENTS_MP_FAKE_URL ?? "";

async function open(browser: Browser, u: TestUser, id: string, baseURL: string, simulate = false) {
  const ctx = await browser.newContext();
  await setSession(ctx, u.session, baseURL);
  const page = await ctx.newPage();
  const sim = simulate ? await installSim(page) : null;
  await page.goto(`/painel/${id}/plano`);
  return { ctx, page, sim };
}

test("evento de outro organizador: 'Só o anfitrião abre o painel' / sem painel", async ({ browser, baseURL }) => {
  const owner = await makeUser("f"), other = await makeUser("g"), id = await makeEvent(owner, `Pay F ${tag()}`); created.push(id);
  const a = await open(browser, other, id, baseURL!);
  await expect(a.page.getByText(/Só o anfitrião abre o painel|Não achamos este evento/)).toBeVisible();
  await expect(a.page.getByText("De que tamanho é a festa?")).toHaveCount(0);
  await a.ctx.close();
});

test("código (RPC redeem_code SIMULADA por page.route): válido mostra B9; inválido, a mensagem neutra", async ({ browser, baseURL }) => {
  const u = await makeUser("h"), id = await makeEvent(u, `Pay H ${tag()}`); created.push(id);
  const a = await open(browser, u, id, baseURL!, true);
  let reply: object = { applied: false, planCode: null, reason: "invalido" };
  await a.page.route("**/rest/v1/rpc/redeem_code", (r) => r.request().method() === "OPTIONS"
    ? r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile", "access-control-allow-methods": "POST, OPTIONS" } })
    : r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: JSON.stringify(reply) }));
  await a.page.reload();
  await a.page.getByRole("button", { name: "Tenho um código" }).click();
  await a.page.getByRole("textbox", { name: "Código" }).fill("mmt 7kq4-xr2p");
  await a.page.getByRole("button", { name: "Aplicar" }).click();
  await expect(a.page.getByText("Esse código não existe, expirou ou já foi usado. Confira as letras e tente de novo.")).toBeVisible();
  reply = { applied: true, planCode: "casamento", reason: "ok" };
  await a.page.getByRole("button", { name: "Aplicar" }).click();
  await expect(a.page.getByRole("heading", { name: "Plano Casamento liberado." })).toBeVisible();
  await expect(a.page.getByText("MMT-7KQ4-XR2P")).toBeVisible();
  await a.ctx.close();
});

test.afterAll(async () => {
  for (const id of created) await admin.from("events").delete().eq("id", id);
});

function tag() { return Math.random().toString(36).slice(2, 8); }

// ---------------------------------------------------------------- parte 2: backend novo + fake Mercado Pago
test.describe("com backend novo + fake Mercado Pago (PAYMENTS_MP_FAKE=1)", () => {
  test.skip(!FAKE_ON || !FAKE, "aguarda a branch de backend (payments-checkout/status/webhook do Mercado Pago e fake-mercadopago.mjs); defina PAYMENTS_MP_FAKE=1 e PAYMENTS_MP_FAKE_URL");

  const control = async (path: string, body?: unknown) => (await fetch(`${FAKE}/__control/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();
  const plan = async (id: string) => ((await admin.rpc("effective_entitlement", { p_event: id })).data as { plan_code: string }[])[0].plan_code;
  const orders = async (id: string) => (await admin.from("payment_orders").select("id,status,plan_code,checkout_url,provider").eq("event_id", id).order("created_at")).data ?? [];
  let env0: unknown;
  const stubCheckout = (page: Page) => page.route(/^https?:\/\/(?!127\.0\.0\.1:55|localhost:55|127\.0\.0\.1:31|localhost:31).*\/.*/, (r) => r.request().resourceType() === "document" ? r.fulfill({ status: 200, contentType: "text/html", body: "<title>Checkout simulado</title><h1>Checkout simulado</h1>" }) : r.continue());

  test.beforeAll(async () => {
    env0 = (await admin.from("platform_settings").select("value").eq("key", "payments_env").single()).data?.value;
    expect((await admin.from("platform_settings").update({ value: "sandbox" }).eq("key", "payments_env")).error).toBeNull();
  });
  test.afterAll(async () => { await admin.from("platform_settings").update({ value: env0 }).eq("key", "payments_env"); });
  test.beforeEach(async () => { await control("reset", {}); });

  test("escolhe Casamento, vai ao checkout (checkoutUrl do pedido); fake aprova; tela mostra plano ativo sem recarregar", async ({ browser, baseURL }) => {
    const u = await makeUser("a"), id = await makeEvent(u, `Pay A ${tag()}`); created.push(id);
    const a = await open(browser, u, id, baseURL!);
    await stubCheckout(a.page);
    await expect(a.page.getByRole("radio", { name: /Casamento/ })).toBeChecked();
    await a.page.getByRole("button", { name: "Pagar R$ 189,00" }).click();
    await expect.poll(async () => (await orders(id)).length).toBe(1);
    const [row] = await orders(id);
    expect(row.provider).toBe("mercadopago");
    await a.page.waitForURL(row.checkout_url!);
    expect(await plan(id)).toBe("gratis"); // nada liberado antes do pagamento aprovado
    await a.page.goBack();
    await expect(a.page.getByRole("heading", { name: "Pagamento em andamento" })).toBeVisible();
    await control("pay", { externalReference: row.id });
    await expect(a.page.getByRole("heading", { name: "Plano Casamento ativo." })).toBeVisible({ timeout: 20_000 });
    expect(await plan(id)).toBe("casamento");
    await a.ctx.close();
  });

  test("retomar pedido: outro contexto abre /plano e vê o mesmo pedido, sem novo create no fake", async ({ browser, baseURL }) => {
    const u = await makeUser("b"), id = await makeEvent(u, `Pay B ${tag()}`); created.push(id);
    const first = await open(browser, u, id, baseURL!);
    await stubCheckout(first.page);
    await first.page.getByRole("button", { name: "Pagar R$ 189,00" }).click();
    await expect.poll(async () => (await orders(id)).length).toBe(1);
    await first.ctx.close();
    const second = await open(browser, u, id, baseURL!);
    await expect(second.page.getByRole("heading", { name: "Pagamento em andamento" })).toBeVisible();
    await expect(second.page.getByRole("link", { name: "Continuar para o Mercado Pago" })).toBeVisible();
    expect((await control("calls")).create).toBe(1);
    expect((await orders(id)).length).toBe(1);
    await second.ctx.close();
  });

  test("expirado não libera plano; Pagar de novo cria outro pedido", async ({ browser, baseURL }) => {
    const u = await makeUser("c"), id = await makeEvent(u, `Pay C ${tag()}`); created.push(id);
    const a = await open(browser, u, id, baseURL!);
    await stubCheckout(a.page);
    await a.page.getByRole("button", { name: "Pagar R$ 189,00" }).click();
    await expect.poll(async () => (await orders(id)).length).toBe(1);
    const [row] = await orders(id);
    await a.page.waitForURL(row.checkout_url!); // a página já foi para o checkout simulado: espera antes de navegar de novo
    await admin.from("payment_orders").update({ status: "expirado", expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", row.id);
    await a.page.goto(`/painel/${id}/plano`);
    await expect(a.page.getByRole("heading", { name: "Este pagamento expirou." })).toBeVisible();
    expect(await plan(id)).toBe("gratis");
    await a.page.getByRole("button", { name: "Pagar de novo" }).click();
    await expect.poll(async () => (await orders(id)).length).toBe(2);
    await a.ctx.close();
  });

  test("clique duplo em Pagar gera um pedido só", async ({ browser, baseURL }) => {
    const u = await makeUser("d"), id = await makeEvent(u, `Pay D ${tag()}`); created.push(id);
    const a = await open(browser, u, id, baseURL!);
    await stubCheckout(a.page);
    await a.page.getByRole("button", { name: "Pagar R$ 189,00" }).dblclick();
    await expect.poll(async () => (await orders(id)).length).toBe(1);
    expect((await control("calls")).create).toBe(1);
    await a.ctx.close();
  });

  test("provedor fora: mensagem de recuperação e nenhum plano liberado", async ({ browser, baseURL }) => {
    const u = await makeUser("e"), id = await makeEvent(u, `Pay E ${tag()}`); created.push(id);
    await control("config", { failCreate: 500 });
    const a = await open(browser, u, id, baseURL!);
    await a.page.getByRole("button", { name: "Pagar R$ 189,00" }).click();
    await expect(a.page.getByRole("heading", { name: "O sistema de pagamento não respondeu." })).toBeVisible({ timeout: 30_000 });
    await expect(a.page.getByRole("button", { name: /Tentar de novo em/ })).toBeDisabled();
    expect(await plan(id)).toBe("gratis");
    await a.ctx.close();
  });

  test("axe: 0 violações em B1 e no pedido em andamento (390 e 1280 px)", async ({ browser, baseURL }) => {
    const u = await makeUser("i"), id = await makeEvent(u, `Pay I ${tag()}`); created.push(id);
    const problems: string[] = [];
    for (const width of [390, 1280]) {
      const a = await open(browser, u, id, baseURL!);
      await stubCheckout(a.page);
      await a.page.setViewportSize({ width, height: 900 });
      await a.page.getByRole("button", { name: /Pagar R\$/ }).waitFor();
      for (const stage of ["B1", "B2"]) {
        if (stage === "B2") { await a.page.getByRole("button", { name: /Pagar R\$/ }).click(); await expect.poll(async () => (await orders(id)).length).toBe(1); await a.page.waitForURL((await orders(id))[0].checkout_url!); await a.page.goBack(); await a.page.getByRole("heading", { name: "Pagamento em andamento" }).waitFor(); }
        await a.page.evaluate(() => document.fonts.ready);
        const r = await new AxeBuilder({ page: a.page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        for (const v of r.violations) problems.push(`${stage}@${width} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      }
      await a.ctx.close();
      await control("reset", {});
      await admin.from("payment_orders").delete().eq("event_id", id);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
