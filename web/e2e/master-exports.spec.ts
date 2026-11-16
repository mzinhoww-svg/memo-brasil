import { createClient, type Session } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";

// Botões "Exportar" do Master no navegador real contra o app em modo Supabase + Supabase LOCAL (mesmo esquema de master-payments.spec.ts).
// Sem as chaves no ambiente o teste é pulado; o formato do CSV e a auditoria são cobertos por pgTAP (31_admin_export_csv) e vitest (export-csv.test.ts).
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

test("master exporta Eventos, Auditoria e Impressões em CSV com BOM e a exportação fica na auditoria", async ({ browser, baseURL }) => {
  const email = `master-exp-${tag}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "master" } });
  expect(u.error).toBeNull();
  expect((await admin.from("platform_roles").insert({ user_id: u.data.user!.id, role: "master", granted_by: u.data.user!.id })).error).toBeNull();
  const s = (await mk().auth.signInWithPassword({ email, password })).data.session!;
  const ctx = await browser.newContext({ acceptDownloads: true });
  await login(ctx, s, baseURL!);
  const page = await ctx.newPage();
  for (const [path, screen] of [["/master/eventos", "eventos"], ["/master/auditoria", "auditoria"], ["/master/impressoes", "impressoes"]] as const) {
    await page.goto(path);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /^Exportar/ }).click()]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`^revela-${screen}-\\d{8}-\\d{4}\\.csv$`));
    const file = await download.path();
    const head = (await import("node:fs")).readFileSync(file!).subarray(0, 3);
    expect([...head]).toEqual([0xef, 0xbb, 0xbf]);
  }
  const { data } = await admin.from("audit_logs").select("target_id").eq("action", "export.csv").eq("actor_id", u.data.user!.id);
  expect((data ?? []).map((r) => r.target_id).sort()).toEqual(["auditoria", "eventos", "impressoes"]);
});
