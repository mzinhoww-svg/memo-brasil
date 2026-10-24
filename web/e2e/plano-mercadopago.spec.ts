import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { MP_CHECKOUT_URL, SB_READY, admin, makeEvent, makeUser, newOrder, openPlano, type TestUser } from "./payments-sim";

// COM-006 (Mercado Pago, Checkout Pro) na página /painel/[id]/plano, modo Supabase LOCAL.
// REAL: login, evento, RLS, effective_entitlement. SIMULADO (page.route): catálogo, quote, payments-checkout, payments-status,
// leitura de payment_orders e o domínio do Mercado Pago. O E2E contra o backend e o fake do provedor roda em payments.spec.ts
// (depende da branch de backend). Nenhuma requisição real ao Mercado Pago.
test.skip(!SB_READY, "precisa de Supabase local e das chaves no ambiente (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_KEY)");
test.describe.configure({ mode: "serial" });

let owner: TestUser;
let eventId: string;

test.beforeAll(async () => {
  owner = await makeUser("mp");
  eventId = await makeEvent(owner, "Plano MP");
});
test.afterAll(async () => {
  if (eventId) await admin.from("events").delete().eq("id", eventId);
});

const PAY = { name: "Pagar R$ 189,00" } as const;
const ACTIVE = /Plano .* ativo\./;

test("Pagar cria o pedido e abre o Checkout Pro no checkoutUrl esperado (navegação de página inteira)", async ({ browser, baseURL }) => {
  const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!);
  await goto();
  await expect(page.getByRole("heading", { level: 1, name: "De que tamanho é a festa?" })).toBeVisible();
  await expect(page.getByText("Pix ou cartão, pagamento único por evento, no Mercado Pago. Sem assinatura.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Casamento/ })).toBeChecked();
  await page.getByRole("button", PAY).click();
  await page.waitForURL(MP_CHECKOUT_URL);
  await expect(page.getByRole("heading", { name: "Mercado Pago (simulado)" })).toBeVisible();
  expect(sim.checkoutBodies).toHaveLength(1);
  expect(sim.checkoutBodies[0]).toMatchObject({ eventId, planCode: "casamento" });
  expect(String(sim.checkoutBodies[0].idempotencyKey)).toMatch(/^[0-9a-f-]{36}$/);
  expect(sim.mpRequests).toEqual([MP_CHECKOUT_URL]);
  // voltar do checkout sem pagar: pedido guardado, link para continuar, nada liberado
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Pagamento em andamento" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar para o Mercado Pago" })).toHaveAttribute("href", MP_CHECKOUT_URL);
  await expect(page.getByText(ACTIVE)).toHaveCount(0);
  expect(sim.checkoutBodies).toHaveLength(1);
  await ctx.close();
});

test("clique duplo em Pagar = 1 pedido e 1 navegação", async ({ browser, baseURL }) => {
  const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!);
  await goto();
  await page.getByRole("button", PAY).dblclick();
  await page.waitForURL(MP_CHECKOUT_URL);
  expect(sim.checkoutBodies).toHaveLength(1);
  expect(sim.mpRequests).toHaveLength(1);
  await ctx.close();
});

test("retomar pedido: abrir /plano de novo mostra o pedido aberto e não cria outro", async ({ browser, baseURL }) => {
  const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!);
  sim.order = newOrder();
  await goto();
  await expect(page.getByRole("heading", { name: "Pagamento em andamento" })).toBeVisible();
  await expect(page.getByText(/^(29|30):\d\d$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar para o Mercado Pago" })).toHaveAttribute("href", MP_CHECKOUT_URL);
  expect(sim.checkoutBodies).toHaveLength(0);
  expect(sim.mpRequests).toHaveLength(0); // abrir a página nunca navega sozinho
  await ctx.close();
});

test("pedido aberto de OUTRO plano: mostra o pedido existente com aviso e não navega", async ({ browser, baseURL }) => {
  const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!);
  await goto();
  await expect(page.getByRole("button", PAY)).toBeVisible();
  sim.order = newOrder({ planCode: "festa", amountCents: 2900 }); // criado em outra aba depois de a página carregar
  await page.getByRole("button", PAY).click();
  await expect(page.getByTestId("aviso-outro-plano")).toContainText("Você já tem um pagamento aberto do plano Festa.");
  await expect(page.getByText("Plano Festa · R$ 29,00")).toBeVisible();
  expect(sim.mpRequests).toHaveLength(0);
  await ctx.close();
});

test("expirado: nada liberado, orienta a não pagar de novo e Pagar de novo é intenção nova (chave nova)", async ({ browser, baseURL }) => {
  const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!);
  sim.order = newOrder({ status: "expirado", expiresAt: new Date(Date.now() - 60_000).toISOString() });
  await goto();
  await expect(page.getByRole("heading", { name: "Este pagamento expirou." })).toBeVisible();
  await expect(page.getByText("Pagou agora há pouco? O plano libera sozinho. Não pague de novo.")).toBeVisible();
  await expect(page.getByText(ACTIVE)).toHaveCount(0);
  expect(sim.checkoutBodies).toHaveLength(0);
  await page.getByRole("button", { name: "Pagar de novo" }).click();
  await page.waitForURL(MP_CHECKOUT_URL);
  expect(sim.checkoutBodies).toHaveLength(1);
  await ctx.close();
});

test("falhou/cancelado: Nada foi cobrado e Tentar de novo; estornado e em análise têm texto próprio", async ({ browser, baseURL }) => {
  const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!);
  for (const [status, heading] of [["falhou", "O pagamento não foi concluído."], ["cancelado", "O pagamento não foi concluído."], ["estornado", "Pagamento devolvido."], ["em_disputa", "Pagamento em análise."]] as const) {
    sim.order = newOrder({ status });
    await goto();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText(ACTIVE)).toHaveCount(0);
  }
  await ctx.close();
});

test("provedor fora (502 com pedido guardado): B6 com botão travado e nenhuma navegação", async ({ browser, baseURL }) => {
  const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!);
  sim.failCheckout = true;
  await goto();
  await page.getByRole("button", PAY).click();
  await expect(page.getByRole("heading", { name: "O sistema de pagamento não respondeu." })).toBeVisible();
  await expect(page.getByText("Seu pedido está guardado; tente de novo em 1 minuto.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Tentar de novo em/ })).toBeDisabled();
  expect(sim.mpRequests).toHaveLength(0);
  await ctx.close();
});

test("pago: comprovante com valor, forma de pagamento, data e pedido", async ({ browser, baseURL }) => {
  const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!);
  sim.order = newOrder({ status: "pago", paidAt: "2026-10-22T17:32:00Z", paymentMethod: "card", expiresAt: null });
  await goto();
  await expect(page.getByRole("heading", { name: "Plano Casamento ativo." })).toBeVisible();
  await expect(page.getByText("R$ 189,00 · Cartão")).toBeVisible();
  await expect(page.getByText("#7F3A-21C9")).toBeVisible();
  await ctx.close();
});

test("retorno ?retorno=sucesso com pedido ainda pendente: confirma sem liberar nada, limpa a URL e vira pago quando o servidor confirmar", async ({ browser, baseURL }) => {
  const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!, "?retorno=sucesso&payment_id=999&status=approved&collection_status=approved&external_reference=x&preference_id=p&payment_type=credit_card&merchant_order_id=1");
  sim.order = newOrder();
  await goto();
  await expect(page.getByText("Estamos confirmando seu pagamento…")).toBeVisible();
  await expect(page.getByText(ACTIVE)).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).search).toBe("");
  sim.order = newOrder({ status: "pago", paidAt: new Date().toISOString(), paymentMethod: "pix" });
  await expect(page.getByRole("heading", { name: "Plano Casamento ativo." })).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test("retorno ?retorno=sucesso SEM nenhum pedido pago no servidor não mostra plano ativo", async ({ browser, baseURL }) => {
  const { ctx, page, goto } = await openPlano(browser, owner, eventId, baseURL!, "?retorno=sucesso&status=approved&payment_id=1");
  await goto();
  await expect(page.getByRole("heading", { level: 1, name: "De que tamanho é a festa?" })).toBeVisible();
  await expect(page.getByText(ACTIVE)).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await ctx.close();
});

test("retorno ?retorno=falha com pedido pendente: pode continuar de onde parou", async ({ browser, baseURL }) => {
  const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!, "?retorno=falha&status=rejected");
  sim.order = newOrder();
  await goto();
  await expect(page.getByText(/Você voltou sem concluir o pagamento/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar para o Mercado Pago" })).toBeVisible();
  await ctx.close();
});

test("sem sessão do dono: outro organizador não vê o plano nem o pedido do evento", async ({ browser, baseURL }) => {
  const other = await makeUser("outro");
  const { ctx, page, sim, goto } = await openPlano(browser, other, eventId, baseURL!);
  sim.order = newOrder(); // mesmo que a simulação devolvesse um pedido, a página nem abre: o evento é do outro
  await goto();
  await expect(page.getByText(/Só o anfitrião abre o painel|Não achamos este evento/)).toBeVisible();
  await expect(page.getByText("De que tamanho é a festa?")).toHaveCount(0);
  await expect(page.getByText("Pagamento em andamento")).toHaveCount(0);
  await ctx.close();
});

async function axeProblems(page: Page, label: string): Promise<string[]> {
  await page.evaluate(() => document.fonts.ready);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${label} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const width of [390, 1280]) {
  test(`axe: 0 violações em B1, pendente, retorno, pago, expirado, falhou, estornado, em análise e provedor fora a ${width}px`, async ({ browser, baseURL }) => {
    const { ctx, page, sim, goto } = await openPlano(browser, owner, eventId, baseURL!);
    await page.setViewportSize({ width, height: 900 });
    const problems: string[] = [];
    const states: [string, () => void, string | RegExp][] = [
      ["B1", () => { sim.order = null; }, "De que tamanho é a festa?"],
      ["pendente", () => { sim.order = newOrder(); }, "Pagamento em andamento"],
      ["pago", () => { sim.order = newOrder({ status: "pago", paidAt: new Date().toISOString(), paymentMethod: "pix" }); }, /Plano Casamento ativo/],
      ["expirado", () => { sim.order = newOrder({ status: "expirado" }); }, "Este pagamento expirou."],
      ["falhou", () => { sim.order = newOrder({ status: "falhou" }); }, "O pagamento não foi concluído."],
      ["estornado", () => { sim.order = newOrder({ status: "estornado" }); }, "Pagamento devolvido."],
      ["em_disputa", () => { sim.order = newOrder({ status: "em_disputa" }); }, "Pagamento em análise."],
    ];
    for (const [label, set, heading] of states) {
      set();
      await goto();
      await page.getByRole("heading", { level: 1, name: heading }).waitFor();
      problems.push(...(await axeProblems(page, `${label}@${width}`)));
    }
    // retorno do checkout (confirmando)
    sim.order = newOrder();
    await page.goto(`/painel/${eventId}/plano?retorno=sucesso&status=approved`);
    await page.getByText("Estamos confirmando seu pagamento…").waitFor();
    problems.push(...(await axeProblems(page, `retorno@${width}`)));
    // provedor fora
    sim.order = null; sim.failCheckout = true;
    await goto();
    await page.getByRole("button", PAY).click();
    await page.getByRole("heading", { level: 1, name: "O sistema de pagamento não respondeu." }).waitFor();
    problems.push(...(await axeProblems(page, `provedor-fora@${width}`)));
    expect(problems, problems.join("\n")).toEqual([]);
    await ctx.close();
  });
}
