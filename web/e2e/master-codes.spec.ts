import { createClient, type Session } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";

// M3 no navegador real contra o app em modo Supabase + Supabase LOCAL. Chaves só do ambiente; recusa alvo não local.
// O Master gera o código (aparece inteiro uma vez), a tabela mostra só o começo, o organizador resgata pela RPC
// (a tela do organizador é de outra sessão) e o Master revoga com motivo.
const URL = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
test.skip(!URL || !PUB || !SVC || !/127\.0\.0\.1|localhost/.test(URL), "precisa de Supabase local e das chaves no ambiente");
const mk = (k = PUB) => createClient(URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = URL ? mk(SVC) : (undefined as never);
const tag = Math.random().toString(36).slice(2, 8);
const refName = () => `sb-${new globalThis.URL(URL).hostname.split(".")[0]}-auth-token`;

async function login(ctx: BrowserContext, s: Session, base: string) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const parts = v.match(/.{1,3180}/g)!;
  const host = new globalThis.URL(base).hostname;
  await ctx.addCookies(parts.map((p, i) => ({ name: parts.length === 1 ? refName() : `${refName()}.${i}`, value: p, domain: host, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const })));
}
async function user(kind: string, role?: "master") {
  const email = `${kind}-code-${tag}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: role ? { role } : {} });
  expect(u.error).toBeNull();
  if (role) expect((await admin.from("platform_roles").insert({ user_id: u.data.user!.id, role, granted_by: u.data.user!.id })).error).toBeNull();
  const c = mk();
  const s = await c.auth.signInWithPassword({ email, password });
  return { id: u.data.user!.id, session: s.data.session!, client: c };
}

test("master gera código, organizador resgata e master revoga com motivo", async ({ browser, baseURL }) => {
  const m = await user("master", "master");
  const org = await user("org");
  const ev = await admin.from("events").insert({ title: `Código ${tag}`, category: "festa", host_id: org.id, host_name: "Org", duration_hours: 6, capacity: 10, shots_per_person: 10, start_at: new Date().toISOString() }).select("id").single();
  expect(ev.error).toBeNull();
  try {
    const ctx = await browser.newContext(); await login(ctx, m.session, baseURL!);
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await ctx.newPage();
    await page.goto("/master/codigos");
    await expect(page.getByRole("heading", { name: "Códigos de cortesia" })).toBeVisible();
    await expect(page.getByText("Libera um plano sem pagamento, para teste ou presente.", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Gerar código" }).click();
    const sheet = page.getByRole("dialog", { name: "Gerar código" });
    await expect(sheet.getByText("Depois disso o código para de funcionar. Planos já liberados continuam.")).toBeVisible();
    await sheet.getByRole("button", { name: "Casamento" }).click();
    await sheet.getByRole("button", { name: "Gerar código" }).click();
    await expect(sheet.getByText("Escreva para quem é o código, com pelo menos 3 caracteres.")).toBeVisible(); // nota obrigatória
    const note = `Teste e2e ${tag}`;
    await sheet.getByLabel("Para quem / nota (obrigatório)").fill(note);
    await sheet.getByRole("button", { name: "Gerar código" }).click();
    await expect(sheet.getByText("Código gerado · copie agora")).toBeVisible();
    await expect(sheet.getByText("Por segurança ele aparece inteiro só agora; depois, só o começo.")).toBeVisible();
    const code = (await sheet.locator(".adm-code").textContent())!.trim();
    expect(code).toMatch(/^MMT-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/);
    await sheet.getByRole("button", { name: "Copiar link" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${new globalThis.URL(baseURL!).origin}/c/${code}`);
    await expect(sheet.getByRole("button", { name: "Gerar outro" })).toBeVisible();
    await sheet.getByRole("button", { name: "Fechar" }).click();

    const row = page.getByRole("row", { name: new RegExp(note) });
    await expect(row).toContainText(`${code.slice(0, 8)}-…`);
    await expect(row).not.toContainText(code);
    await expect(row).toContainText("Casamento");
    await expect(row).toContainText("0 de 1");
    await expect(row).toContainText("ativo");

    // organizador resgata (código em minúsculas, sem hífens)
    const r = await org.client.rpc("redeem_code", { p_event: ev.data!.id, p_code: code.toLowerCase().replace(/-/g, "") });
    expect(r.error).toBeNull();
    expect(r.data).toEqual({ applied: true, planCode: "casamento", reason: "ok" });
    await page.reload();
    await expect(row).toContainText("1 de 1");
    await expect(row).toContainText("usado");

    // um segundo código, revogado com motivo
    await page.getByRole("button", { name: "Gerar código" }).click();
    await sheet.getByLabel("Para quem / nota (obrigatório)").fill(`Revogar ${tag}`);
    await sheet.getByRole("button", { name: "Gerar código" }).click();
    await expect(sheet.getByText("Código gerado · copie agora")).toBeVisible();
    await sheet.getByRole("button", { name: "Fechar" }).click();
    const row2 = page.getByRole("row", { name: new RegExp(`Revogar ${tag}`) });
    await row2.getByRole("button", { name: /^Revogar MMT-/ }).click();
    const rv = page.getByRole("dialog", { name: "Revogar código" });
    await rv.getByLabel("Motivo (obrigatório, 10 a 500 caracteres)").fill("Teste automatizado de revogação");
    await rv.getByRole("button", { name: "Revogar código" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row2).toContainText("revogado");
    await ctx.close();
  } finally {
    await admin.from("events").delete().eq("id", ev.data!.id);
    await admin.from("platform_roles").update({ revoked_at: new Date().toISOString() }).eq("user_id", m.id);
  }
});
