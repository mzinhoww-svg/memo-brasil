import { createClient, type Session } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";

// Sessão no navegador real contra o app em modo Supabase + Supabase LOCAL. Chaves só do ambiente; recusa alvo que não seja local.
const URL = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
test.skip(!URL || !PUB || !SVC || !/127\.0\.0\.1|localhost/.test(URL), "precisa de Supabase local e das chaves no ambiente");
const mk = (k = PUB) => createClient(URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = URL ? mk(SVC) : (undefined as never); // sem ambiente local o arquivo todo é pulado
const tag = Math.random().toString(36).slice(2, 8);
const refName = () => `sb-${new globalThis.URL(URL).hostname.split(".")[0]}-auth-token`;

/** Cookie no formato do @supabase/ssr (base64url, pedaços de 3180). Não é login Google: só fixture de sessão local. */
async function setSession(ctx: BrowserContext, s: Session, base: string) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const parts = v.match(/.{1,3180}/g)!;
  const host = new globalThis.URL(base).hostname;
  await ctx.clearCookies();
  await ctx.addCookies(parts.map((p, i) => ({ name: parts.length === 1 ? refName() : `${refName()}.${i}`, value: p, domain: host, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const })));
}
/** Access token vencido: expires_at no passado e JWT sem assinatura válida; o refresh_token continua o da fixture. */
const vencida = (s: Session, refresh = s.refresh_token): Session => ({ ...s, access_token: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.assinatura-invalida", expires_at: 1, expires_in: 0, refresh_token: refresh });

async function master() {
  const email = `sessao-${tag}-${Math.random().toString(36).slice(2, 6)}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "master" } });
  expect(u.error).toBeNull();
  const id = u.data.user!.id;
  expect((await admin.from("platform_roles").insert({ user_id: id, role: "master", granted_by: id })).error).toBeNull();
  const s = await mk().auth.signInWithPassword({ email, password });
  return { id, session: s.data.session! };
}
const cleanup: (() => Promise<unknown>)[] = [];
test.afterAll(async () => { for (const f of cleanup.reverse()) await f().catch(() => undefined); });

test.describe("sessão: renovação e expiração no servidor", () => {
  test("renova token vencido com refresh válido, também na requisição seguinte", async ({ browser, baseURL }) => {
    const m = await master();
    cleanup.push(async () => { await admin.from("platform_roles").update({ revoked_at: new Date().toISOString() }).eq("user_id", m.id); await admin.auth.admin.deleteUser(m.id); });
    const ctx = await browser.newContext(); await setSession(ctx, vencida(m.session), baseURL!);
    const page = await ctx.newPage();
    await page.goto("/master");
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    // a renovação precisa ter sido gravada no cookie (senão o refresh_token já usado fica para a próxima requisição)
    const accessGravado = async () => {
      const raw = (await ctx.cookies()).filter((c) => c.name.startsWith(refName())).sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.value).join("");
      return (JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString()) as Session).access_token;
    };
    await expect.poll(accessGravado, { timeout: 5000 }).not.toBe(vencida(m.session).access_token);
    await page.waitForTimeout(11_000); // fora da janela de reuso do refresh token do Auth (10 s): token antigo reutilizado seria revogado
    await page.reload();
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    await ctx.close();
  });

  test("sem JavaScript: token vencido continua autenticado na 2ª requisição fora da janela de reuso (SCV-007)", async ({ playwright, baseURL }) => {
    const m = await master();
    cleanup.push(async () => { await admin.from("platform_roles").update({ revoked_at: new Date().toISOString() }).eq("user_id", m.id); await admin.auth.admin.deleteUser(m.id); });
    const v = "base64-" + Buffer.from(JSON.stringify(vencida(m.session))).toString("base64url");
    const parts = v.match(/.{1,3180}/g)!;
    const cookie = parts.map((p, i) => `${parts.length === 1 ? refName() : `${refName()}.${i}`}=${p}`).join("; ");
    const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie } });
    const visaoGeral = async () => (await (await api.get("/master")).text()).includes("Visão geral");
    // controle negativo: o critério precisa distinguir autenticado de negado
    const vz = "base64-" + Buffer.from(JSON.stringify(vencida(m.session, "refresh-que-nao-existe"))).toString("base64url");
    const negado = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: vz.match(/.{1,3180}/g)!.map((p, i, a) => `${a.length === 1 ? refName() : `${refName()}.${i}`}=${p}`).join("; ") } });
    expect((await (await negado.get("/master")).text()).includes("Visão geral"), "controle negativo").toBe(false);
    await negado.dispose();
    expect(await visaoGeral()).toBe(true); // 1ª: o servidor renova (e não consegue gravar o cookie em Server Component)
    await new Promise((r) => setTimeout(r, 11_000)); // fora da janela de reuso do refresh token
    expect(await visaoGeral()).toBe(true); // 2ª: com o mesmo cookie; sem refresh no servidor, o token antigo já foi consumido
    await api.dispose();
  });

  test("refresh inválido encerra o acesso protegido, sem falso sucesso", async ({ browser, baseURL }) => {
    const m = await master();
    cleanup.push(async () => { await admin.from("platform_roles").update({ revoked_at: new Date().toISOString() }).eq("user_id", m.id); await admin.auth.admin.deleteUser(m.id); });
    const ctx = await browser.newContext(); await setSession(ctx, vencida(m.session, "refresh-que-nao-existe"), baseURL!);
    const page = await ctx.newPage();
    await page.goto("/master");
    await expect(page.getByRole("heading", { name: "Visão geral" })).toHaveCount(0);
    await expect(page.locator("aside.mside")).toHaveCount(0);
    await ctx.close();
  });
});
