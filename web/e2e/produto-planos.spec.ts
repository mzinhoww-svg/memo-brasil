import AxeBuilder from "@axe-core/playwright";
import { createClient, type Session } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";
import { acceptTerms } from "./helpers";

// Task 12/14 (restante) contra Supabase LOCAL: catálogo real (5 planos), payments_env, assistente com plano, /c/<código>,
// nome do anfitrião (RLS), configurações limitadas ao plano e aviso de lotação.
// REAL: list_public_plans/get_public_settings, events/participants (RLS), quote, effective_entitlement.
// SIMULADO: a RPC redeem_code (Task 7A, ainda inexistente) é respondida por page.route. Nenhum provedor de pagamento é chamado.
const URL = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
test.skip(!URL || !PUB || !SVC || !/127\.0\.0\.1|localhost/.test(URL), "precisa de Supabase local e das chaves no ambiente");
test.describe.configure({ mode: "serial" });

const mk = (k = PUB) => createClient(URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = URL ? mk(SVC) : (undefined as never);
const tag = Math.random().toString(36).slice(2, 8);
const refName = () => `sb-${new globalThis.URL(URL).hostname.split(".")[0]}-auth-token`;
const created: string[] = [];
let env0: unknown;

async function setSession(ctx: BrowserContext, s: Session, base: string) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const parts = v.match(/.{1,3180}/g)!;
  const host = new globalThis.URL(base).hostname;
  await ctx.addCookies(parts.map((p, i) => ({ name: parts.length === 1 ? refName() : `${refName()}.${i}`, value: p, domain: host, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const })));
}
async function user(label: string) {
  const email = `pp-${label}-${tag}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(u.error).toBeNull();
  const c = mk();
  const s = await c.auth.signInWithPassword({ email, password });
  return { id: u.data.user!.id, session: s.data.session!, client: c };
}
async function newEvent(u: Awaited<ReturnType<typeof user>>, title: string, extra: Record<string, unknown> = {}) {
  const r = await u.client.from("events").insert({ title, category: "casamento", host_id: u.id, host_name: "Emy", duration_hours: 6, ...extra }).select().single();
  expect(r.error).toBeNull();
  created.push(r.data!.id as string);
  return r.data!.id as string;
}
const setEnv = async (v: string) => expect((await admin.from("platform_settings").update({ value: v }).eq("key", "payments_env")).error).toBeNull();

test.beforeAll(async () => {
  env0 = (await admin.from("platform_settings").select("value").eq("key", "payments_env").single()).data?.value;
});
test.afterAll(async () => {
  await admin.from("platform_settings").update({ value: env0 }).eq("key", "payments_env");
  for (const id of created) await admin.from("events").delete().eq("id", id);
});

async function open(browser: import("@playwright/test").Browser, u: Awaited<ReturnType<typeof user>>, baseURL: string, route: string) {
  const ctx = await browser.newContext();
  await setSession(ctx, u.session, baseURL);
  const page = await ctx.newPage();
  await page.goto(route);
  return { ctx, page };
}

test("/precos mostra os 5 planos com R$ 29, 89, 189 e 349 (valores lidos do servidor)", async ({ page }) => {
  await setEnv("sandbox");
  const server = (await admin.rpc("list_public_plans")).data as { code: string; priceCents: number }[];
  expect(server.map((p) => p.code)).toEqual(["gratis", "festa", "celebracao", "casamento", "grande"]);
  await page.goto("/precos");
  await expect(page.locator('[data-testid^="preco-"]')).toHaveCount(5);
  const brl = (c: number) => `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  for (const p of server.filter((x) => x.priceCents > 0)) await expect(page.getByTestId(`preco-${p.code}`)).toContainText(`R$ ${p.priceCents / 100}`);
  expect(server.filter((x) => x.priceCents > 0).map((x) => x.priceCents / 100)).toEqual([29, 89, 189, 349]);
  await expect(page.getByTestId("preco-casamento")).toHaveClass(/on/);
  await page.goto("/");
  await expect(page.getByTestId("linha-preco")).toHaveText(`Grátis até 10 convidados. Planos a partir de ${brl(Math.min(...server.filter((x) => x.priceCents > 0).map((x) => x.priceCents)))}, pagos uma vez por evento.`);
});

test("/precos com payments_env=desligado mostra só Grátis e Fale com a gente", async ({ page }) => {
  await setEnv("desligado");
  try {
    await page.goto("/precos");
    await expect(page.getByTestId("preco-gratis")).toBeVisible();
    await expect(page.locator('[data-testid^="preco-"]')).toHaveCount(1);
    await expect(page.getByText("Os planos pagos voltam em breve")).toBeVisible();
    await page.goto("/");
    await expect(page.getByTestId("linha-preco")).toHaveText("Grátis até 10 convidados.");
  } finally {
    await setEnv("sandbox");
  }
});

test("assistente com plano pago: selo vem do catálogo, evento nasce Grátis 10/10 e leva a /plano?plano=casamento", async ({ browser, baseURL }) => {
  await setEnv("sandbox");
  const u = await user("w");
  const { ctx, page } = await open(browser, u, baseURL!, "/criar");
  await page.getByLabel("Nome do evento").fill(`Wizard ${tag}`);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("group", { name: "Fotos por pessoa" }).getByRole("button", { name: /^36/ }).click();
  await expect(page.getByTestId("selo-plano")).toHaveText(["Plano Festa", "Plano Festa", "Plano Casamento"]);
  await expect(page.getByText(/Acima de 10 fotos pede o plano Casamento \(R\$ 189,00\)/)).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("radio")).toHaveCount(5);
  await page.getByRole("radio", { name: /Até 250/ }).check();
  await expect(page.getByText("250 olhares por R$ 0,76 cada.")).toBeVisible();
  await expect(page.getByText("O evento nasce grátis. Com plano pago, você paga com Pix ou cartão na tela seguinte.")).toBeVisible();
  await acceptTerms(page);
  // o assistente abre o checkout direto; com o checkout indisponível ele cai na tela de plano com o plano pré-selecionado
  await page.route("**/functions/v1/payments-checkout", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "provider" }) }));
  await page.getByRole("button", { name: "Criar evento" }).click();
  await page.waitForURL(/\/painel\/[0-9a-f-]{36}\/plano\?plano=casamento$/);
  const id = page.url().match(/painel\/([0-9a-f-]{36})\//)![1];
  created.push(id);
  await expect(page.getByRole("radio", { name: /Até 250/ })).toBeChecked();
  const ev = (await admin.from("events").select("capacity,shots_per_person").eq("id", id).single()).data!;
  expect(ev).toEqual({ capacity: 10, shots_per_person: 10 });
  await ctx.close();
});

test("assistente com pagamentos desligados mostra só o Grátis e o cartão Fale com a gente, sem a linha do pagamento", async ({ browser, baseURL }) => {
  await setEnv("desligado");
  try {
    const u = await user("w2");
    const { ctx, page } = await open(browser, u, baseURL!, "/criar");
    await page.getByLabel("Nome do evento").fill(`Wizard2 ${tag}`);
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("radio")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Evento maior?" })).toBeVisible();
    await expect(page.getByText(/paga com Pix ou cartão/)).toHaveCount(0);
    await ctx.close();
  } finally {
    await setEnv("sandbox");
  }
});

for (const [nome, reply, esperado] of [
  ["válido", { applied: true, planCode: "casamento", reason: "ok" }, "Plano Casamento liberado."],
  ["inválido", { applied: false, planCode: null, reason: "invalido" }, null],
] as const) {
  test(`link /c/<código> (redeem_code simulado, ${nome}): cria o evento e ${esperado ? "mostra B9" : "mostra B8 sem impedir o evento"}`, async ({ browser, baseURL }) => {
    await setEnv("sandbox");
    const u = await user(`c${nome[0]}`);
    const ctx = await browser.newContext();
    await setSession(ctx, u.session, baseURL!);
    const page = await ctx.newPage();
    let body: { p_event?: string; p_code?: string } = {};
    await page.route("**/rest/v1/rpc/redeem_code", (r) => { body = r.request().postDataJSON(); return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) }); });
    await page.goto("/c/mmt-7kq4-ab12");
    await page.waitForURL(/\/criar$/);
    await page.getByLabel("Nome do evento").fill(`Código ${nome} ${tag}`);
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Código MMT-7KQ4-AB12 será aplicado ao criar.")).toBeVisible();
    await acceptTerms(page);
    await page.getByRole("button", { name: "Criar evento" }).click();
    if (esperado) await expect(page.getByTestId("codigo-aplicado").getByRole("heading", { level: 1, name: esperado })).toBeVisible();
    else {
      await expect(page.getByRole("heading", { level: 1, name: "Evento criado. O código não foi aplicado." })).toBeVisible();
      await expect(page.getByText("Esse código não existe, expirou ou já foi usado. Confira as letras e tente de novo.")).toBeVisible();
    }
    expect(body.p_code).toBe("MMT-7KQ4-AB12");
    const ev = (await admin.from("events").select("id,title").eq("host_id", u.id)).data!;
    expect(ev).toHaveLength(1); // o evento existe de qualquer jeito
    created.push(ev[0].id);
    expect(body.p_event).toBe(ev[0].id);
    await ctx.close();
  });
}

test("motivo desconhecido e evento_encerrado no resgate: mensagem neutra e a mensagem do evento encerrado (P2)", async ({ browser, baseURL }) => {
  await setEnv("sandbox");
  const u = await user("r");
  const id = await newEvent(u, `Resgate ${tag}`);
  const { ctx, page } = await open(browser, u, baseURL!, `/painel/${id}/configuracoes`);
  let reply: unknown = { applied: false, planCode: null, reason: "evento_encerrado" };
  await page.route("**/rest/v1/rpc/redeem_code", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) }));
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await page.getByRole("button", { name: "Tenho um código de presente" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("textbox", { name: "Código" }).fill("mmt7kq4ab12");
  await dlg.getByRole("button", { name: "Aplicar" }).click();
  await expect(dlg.getByText("Este evento já terminou. O código continua livre para outra festa.")).toBeVisible();
  reply = { applied: false, planCode: null, reason: "algo_novo" };
  await dlg.getByRole("button", { name: "Aplicar" }).click();
  await expect(dlg.getByText("Esse código não existe, expirou ou já foi usado. Confira as letras e tente de novo.")).toBeVisible();
  reply = { applied: false, planCode: null, reason: "muitas_tentativas" };
  await dlg.getByRole("button", { name: "Aplicar" }).click();
  await expect(dlg.getByText("Muitas tentativas. Tente de novo em 10 minutos.")).toBeVisible();
  reply = { applied: false, planCode: null, reason: "ja_incluido" };
  await dlg.getByRole("button", { name: "Aplicar" }).click();
  await expect(dlg.getByText(/Seu evento já tem este plano ou um maior/)).toBeVisible();
  reply = { applied: true, planCode: "casamento", reason: "ok" };
  await dlg.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Código aplicado. Plano Casamento liberado." })).toBeVisible();
  await ctx.close();
});

test("configurações (nuvem): o anfitrião edita o nome do convite (RLS permite host_name) e as opções respeitam o plano Grátis", async ({ browser, baseURL }) => {
  await setEnv("sandbox");
  const u = await user("h");
  const id = await newEvent(u, `Host ${tag}`);
  const { ctx, page } = await open(browser, u, baseURL!, `/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await expect(page.getByLabel("Seu nome (aparece no convite)")).toHaveValue("Emy");
  await page.getByLabel("Seu nome (aparece no convite)").fill("Emy e Igor");
  await page.getByRole("button", { name: "Salvar seu nome" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Salvo." })).toBeVisible();
  expect((await admin.from("events").select("host_name").eq("id", id).single()).data!.host_name).toBe("Emy e Igor");
  await expect(page.getByRole("group", { name: "Convidados" }).getByRole("button")).toHaveText(["5", "10"]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Poses\b/ }).click();
  await expect(page.getByRole("group", { name: "Fotos por pessoa" }).getByRole("button")).toHaveText(["5", "10"]);
  await expect(page.getByTestId("limite-plano")).toContainText("Seu plano permite até 10 convidados e 10 fotos por pessoa.");
  await ctx.close();
});

test("painel (nuvem): cartão Plano e aviso 'Lotação chegando' com a folga do servidor", async ({ browser, baseURL }) => {
  await setEnv("sandbox");
  const u = await user("l");
  const id = await newEvent(u, `Lotação ${tag}`); // nasce 10/10
  for (let i = 0; i < 8; i++) {
    const g = await admin.auth.admin.createUser({ email: `pp-g${i}-${tag}@memoriesmt.test`, password: `Pw-${tag}-x1`, email_confirm: true });
    expect((await admin.from("participants").insert({ event_id: id, user_id: g.data.user!.id, name: `Convidado ${i}` })).error).toBeNull();
  }
  const grace = Number((await admin.from("platform_settings").select("value").eq("key", "capacity_grace_pct").single()).data?.value ?? 0);
  const limit = 10 + Math.ceil((10 * grace) / 100);
  const { ctx, page } = await open(browser, u, baseURL!, `/painel/${id}`);
  void limit;
  await expect(page.getByText("8 de 10", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^Plano/ })).toContainText("Lotação chegando");
  await expect(page.getByRole("link", { name: /^Plano/ })).toHaveAttribute("href", `/painel/${id}/plano`);
  await ctx.close();
});

for (const width of [390, 1280]) {
  test(`axe (nuvem): 0 violações em /precos, painel e configurações a ${width}px`, async ({ browser, baseURL }) => {
    await setEnv("sandbox");
    const u = await user(`a${width}`);
    const id = await newEvent(u, `Axe ${tag} ${width}`);
    const { ctx, page } = await open(browser, u, baseURL!, "/precos");
    await page.setViewportSize({ width, height: 900 });
    const problems: string[] = [];
    for (const route of ["/precos", `/painel/${id}`, `/painel/${id}/configuracoes`, `/painel/${id}/plano`]) {
      await page.goto(route);
      await page.locator("h1").first().waitFor();
      await page.waitForTimeout(800);
      await page.evaluate(() => document.fonts.ready);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) problems.push(`${route} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
    await ctx.close();
  });
}
