import { createClient, type Session } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";

// Navegador real contra o app em modo Supabase + Supabase LOCAL. Chaves só do ambiente; recusa alvo que não seja local.
const URL = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
test.skip(!URL || !PUB || !SVC || !/127\.0\.0\.1|localhost/.test(URL), "precisa de Supabase local e das chaves no ambiente");
const mk = (k = PUB) => createClient(URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = URL ? mk(SVC) : (undefined as never); // sem ambiente local o arquivo todo é pulado
const tag = Math.random().toString(36).slice(2, 8);
const refName = () => `sb-${new globalThis.URL(URL).hostname.split(".")[0]}-auth-token`;

/** Injeta a sessão no formato do @supabase/ssr (cookie base64url, em pedaços de 3180) para o servidor Next reconhecer. */
async function login(ctx: BrowserContext, s: Session, base: string) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const parts = v.match(/.{1,3180}/g)!;
  const host = new globalThis.URL(base).hostname;
  await ctx.addCookies(parts.map((p, i) => ({ name: parts.length === 1 ? refName() : `${refName()}.${i}`, value: p, domain: host, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const })));
}
async function user(kind: "master" | "master-sem-linha" | "organizador") {
  const email = `${kind}-${tag}-${Math.random().toString(36).slice(2, 6)}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: kind === "organizador" ? {} : { role: "master" } });
  expect(u.error).toBeNull();
  if (kind === "master") expect((await admin.from("platform_roles").insert({ user_id: u.data.user!.id, role: "master", granted_by: u.data.user!.id })).error).toBeNull();
  const c = mk(); const s = await c.auth.signInWithPassword({ email, password });
  return { id: u.data.user!.id, session: s.data.session!, client: c };
}
const cleanup: (() => Promise<unknown>)[] = [];
test.afterAll(async () => { for (const f of cleanup.reverse()) await f().catch(() => undefined); });

test.describe("console master: autorização no servidor", () => {
  test("master com claim e papel ativo vê os 12 módulos (Impressões só com a chave) e as páginas carregam", async ({ browser, baseURL }) => {
    const m = await user("master");
    cleanup.push(async () => { await admin.from("platform_roles").update({ revoked_at: new Date().toISOString() }).eq("user_id", m.id); });
    const ctx = await browser.newContext(); await login(ctx, m.session, baseURL!);
    const page = await ctx.newPage();
    await page.goto("/master");
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    await expect(page.locator("aside.mside a.mnav")).toHaveCount(12);
    for (const rota of ["eventos", "pessoas", "revelacoes", "moderacao", "auditoria", "pagamentos", "planos", "codigos", "configuracoes", "lgpd", "saude"]) {
      const r = await page.goto(`/master/${rota}`);
      expect(r?.status(), rota).toBe(200);
      await expect(page.locator("h1").first(), rota).toBeVisible();
      await expect(page.getByText("Sem permissão para ver estes dados."), rota).toHaveCount(0);
      await expect(page.getByText(/Não foi possível carregar/), rota).toHaveCount(0);
    }
    await ctx.close();
  });

  test("organizador comum e claim sem papel ativo são negados; sem sessão e convidado pedem login", async ({ browser, baseURL }) => {
    const org = await user("organizador"), semLinha = await user("master-sem-linha");
    const guestClient = mk(); const g = await guestClient.auth.signInAnonymously();
    for (const [who, session, esperado] of [["organizador", org.session, "Sem permissão."], ["claim sem linha", semLinha.session, "Sem permissão."], ["convidado", g.data.session!, "Entre com sua conta de operador."], ["sem sessão", null, "Entre com sua conta de operador."]] as const) {
      const ctx = await browser.newContext(); if (session) await login(ctx, session, baseURL!);
      const page = await ctx.newPage();
      for (const rota of ["/master", "/master/eventos", "/master/auditoria"]) {
        await page.goto(rota);
        await expect(page.getByRole("heading", { name: esperado }), `${who} ${rota}`).toBeVisible();
        await expect(page.locator("aside.mside"), `${who} ${rota}`).toHaveCount(0);
        await expect(page.locator(".mtable, .mtr"), `${who} ${rota}`).toHaveCount(0);
      }
      await ctx.close();
    }
  });
});

test("tema do evento fica isolado: nunca em :root, nem em outro evento; mensagem só no evento certo", async ({ browser }) => {
  const org = await user("organizador");
  const mkEvent = async (title: string) => (await org.client.from("events").insert({ title, category: "casamento", host_id: org.id, host_name: "Emy", duration_hours: 6, reveal_enabled: true, reveal_anchor: "fim" }).select().single()).data!;
  const A = await mkEvent(`TemaA ${tag}`), B = await mkEvent(`TemaB ${tag}`);
  cleanup.push(async () => { await admin.from("events").delete().in("id", [A.id, B.id]); });
  const oceano = { superficie: "#E2ECF1", grafismo: "#9DB8C6", controle: "#6F8F9F", texto: "#3F6275", profundo: "#2F4C5C" };
  expect((await org.client.from("event_themes").insert({ event_id: A.id, preset: "oceano", colors: oceano, font: "pinyon", welcome_message: `Boas-vindas ${tag}`, qr_style: "pontos" })).error).toBeNull();
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const probe = () => page.evaluate(() => ({
    wrapper: document.querySelector("[data-event-theme]")?.getAttribute("data-event-theme"),
    superficie: getComputedStyle(document.querySelector("[data-event-theme]")!).getPropertyValue("--evento-superficie").trim().toUpperCase(),
    root: getComputedStyle(document.documentElement).getPropertyValue("--evento-superficie").trim(),
    body: document.body.innerText,
  }));
  await page.goto(`/e/${A.code}`); await expect(page.getByText(`TemaA ${tag}`)).toBeVisible();
  const a = await probe();
  expect(a.wrapper).toBe("custom"); expect(a.superficie).toBe(oceano.superficie);
  expect(a.root.toUpperCase()).not.toBe(oceano.superficie); // :root guarda só o padrão da plataforma, nunca o tema do evento
  expect(a.body).toContain(`Boas-vindas ${tag}`);
  await page.goto(`/e/${B.code}`); await expect(page.getByText(`TemaB ${tag}`)).toBeVisible();
  const b = await probe();
  expect(b.wrapper).toBe("palette"); expect(b.superficie).not.toBe(oceano.superficie);
  expect(b.root).toBe(a.root); // abrir o evento A não alterou nada fora do wrapper
  expect(b.body).not.toContain(`Boas-vindas ${tag}`);
  await ctx.close();
});
