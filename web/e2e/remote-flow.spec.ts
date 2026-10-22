import { createClient, type Session } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Homologação ponta a ponta no PREVIEW REMOTO: organizador (usuário de teste isolado) cria evento, convidado entra, posta, o servidor revela
// (pg_cron), álbum liberado; permissões de convidado/organizador/master; isolamento entre eventos. Só dados de teste criados aqui, limpos no fim.
// Env: REMOTE_URL (preview), REMOTE_SHARE (query _vercel_share do preview protegido), SUPABASE_URL/PUBLISHABLE_KEY/SERVICE_KEY, ALLOW_REMOTE_TEST=1
const BASE = process.env.REMOTE_URL!, SHARE = process.env.REMOTE_SHARE ?? "";
const SB = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
test.skip(!BASE || !SB || !PUB || !SVC || process.env.ALLOW_REMOTE_TEST !== "1", "precisa do preview, das chaves do projeto de teste e de ALLOW_REMOTE_TEST=1");
test.setTimeout(240_000);
const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
const mk = (k = PUB) => createClient(SB, k, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = SVC ? mk(SVC) : (undefined as never);
const tag = Math.random().toString(36).slice(2, 8);
const cleanup: (() => Promise<unknown>)[] = [];
test.afterAll(async () => { for (const f of cleanup.reverse()) await f().catch(() => undefined); });

async function ctxWith(browser: Browser, session?: Session): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto(`/?_vercel_share=${SHARE}`); // libera o preview protegido (cookie)
  await page.close();
  if (session) {
    const ref = new URL(SB).hostname.split(".")[0];
    const v = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
    const parts = v.match(/.{1,3180}/g)!;
    await ctx.addCookies(parts.map((p, i) => ({ name: parts.length === 1 ? `sb-${ref}-auth-token` : `sb-${ref}-auth-token.${i}`, value: p, domain: new URL(BASE).hostname, path: "/", secure: true, httpOnly: false, sameSite: "Lax" as const })));
  }
  return ctx;
}
async function organizer(label: string) {
  const email = `rt-${label}-${tag}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(u.error).toBeNull();
  cleanup.push(async () => { await admin.auth.admin.deleteUser(u.data.user!.id); });
  const c = mk(); const s = await c.auth.signInWithPassword({ email, password });
  return { id: u.data.user!.id, session: s.data.session!, client: c };
}

test("organizador cria → convidado entra e posta → servidor revela (cron) → álbum; permissões e isolamento", async ({ browser }) => {
  const org = await organizer("a"), orgB = await organizer("b");

  // 1) organizador cria o evento pela interface (sessão de teste injetada; o login Google real foi homologado separadamente)
  const octx = await ctxWith(browser, org.session);
  const op = await octx.newPage();
  await op.goto("/criar");
  await op.getByLabel("Nome do evento").fill(`Homolog ${tag}`);
  await op.getByLabel("Seu nome").fill("Organizadora Teste");
  await op.getByRole("button", { name: "Próximo" }).click();
  await op.getByRole("button", { name: "Próximo" }).click(); // término (6 h)
  await op.getByRole("button", { name: "Próximo" }).click(); // revelação ao terminar
  await op.getByRole("button", { name: "Próximo" }).click(); // identidade
  await op.getByRole("button", { name: "Próximo" }).click(); // convidados
  await op.getByRole("button", { name: /Criar evento/ }).click();
  await op.waitForURL(/criar\/pronto\//);
  const code = (await op.getByTestId("codigo").textContent())!.trim();
  const eventId = (await admin.from("events").select("id,host_id,reveal_status").eq("code", code).single()).data!;
  expect(eventId.host_id).toBe(org.id); expect(eventId.reveal_status).toBe("pendente");
  cleanup.push(async () => { await admin.from("events").delete().eq("id", eventId.id); });
  const link = await op.getByTestId("link-convite").inputValue().catch(() => "");

  // evento de outro organizador (isolamento)
  const evB = (await orgB.client.from("events").insert({ title: `Outro ${tag}`, category: "festa", host_id: orgB.id, host_name: "B", duration_hours: 6, reveal_enabled: true, reveal_anchor: "fim" }).select().single()).data!;
  cleanup.push(async () => { await admin.from("events").delete().eq("id", evB.id); });

  // 2) convidado (contexto independente, anônimo) entra pelo convite e posta
  const gctx = await ctxWith(browser);
  const gp = await gctx.newPage();
  await gp.goto(link ? new URL(link).pathname : `/e/${code}`);
  await gp.getByLabel("Como te chamam na festa?").fill("Convidada Teste");
  await gp.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await gp.getByRole("button", { name: "Entrar na festa" }).click();
  await gp.waitForURL(/agora$/);
  await expect(gp.getByTestId("aguardando-revelacao")).toBeVisible();
  await gp.goto(`/e/${code}/postar`);
  await gp.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await gp.getByRole("button", { name: "Postar", exact: true }).click();
  await expect(gp.getByText("Sua visão entrou na história.")).toBeVisible({ timeout: 30_000 });

  // 3) upload persistido e Storage privado
  const photos = (await admin.from("photos").select("id,storage_path,upload_status").eq("event_id", eventId.id)).data!;
  expect(photos).toHaveLength(1); expect(photos[0].upload_status).toBe("pronta");
  const pub = await fetch(`${SB}/storage/v1/object/public/event-photos/${photos[0].storage_path}`);
  expect(pub.status).not.toBe(200); // bucket privado
  await gp.goto(`/e/${code}/agora`);
  await expect(gp.locator(".mm-post")).toHaveCount(0); // bloqueada: nem a própria antes da revelação

  // 4) permissões: convidado não abre o painel nem o console; organizador comum não abre o console; organizador B não vê a foto
  await gp.goto(`/painel/${eventId.id}`);
  await expect(gp.getByText("Só o anfitrião abre o painel.")).toBeVisible();
  await gp.goto("/master");
  await expect(gp.getByRole("heading", { name: "Entre com sua conta de operador." })).toBeVisible();
  await op.goto("/master");
  await expect(op.getByRole("heading", { name: "Sem permissão." })).toBeVisible();
  expect((await orgB.client.from("photos").select("id").eq("event_id", eventId.id)).data).toHaveLength(0);
  expect((await orgB.client.storage.from("event-photos").createSignedUrl(photos[0].storage_path, 60)).error).toBeTruthy();
  expect((await orgB.client.from("events").select("id").eq("id", eventId.id)).data).toHaveLength(0);

  // 5) revelação pelo servidor com o relógio real do pg_cron: antecipamos o horário do evento de TESTE e esperamos o job (sem chamar a RPC)
  await admin.from("events").update({ start_at: new Date(Date.now() - 7 * 3600_000).toISOString(), duration_hours: 1 }).eq("id", eventId.id);
  await expect.poll(async () => (await admin.from("events").select("reveal_status").eq("id", eventId.id).single()).data?.reveal_status, { timeout: 150_000, intervals: [5_000] }).toBe("revelada");
  await gp.goto(`/e/${code}/agora`);
  const ev = (await admin.from("events").select("reveal_status,revealed_at,reveal_at,start_at,duration_hours,reveal_enabled").eq("id", eventId.id).single()).data;
  const ph = (await admin.from("photos").select("status,upload_status,deleted_at").eq("event_id", eventId.id)).data;
  const diag = JSON.stringify({ ev, ph, now: new Date().toISOString(), url: gp.url(), texto: (await gp.locator("main").first().innerText().catch(() => "")).slice(0, 300) });
  test.info().annotations.push({ type: "diag", description: diag });
  console.log("DIAG", diag);
  await expect(gp.locator(".mm-post"), diag).toHaveCount(1, { timeout: 30_000 });
  // 6) o álbum fica disponível ao participante (URL assinada, só com a sessão dele) e continua fechado ao estranho
  const imgSrc = await gp.locator(".mm-post img").first().getAttribute("src");
  expect(imgSrc).toMatch(/^(blob:|https?:)/);
  expect((await orgB.client.storage.from("event-photos").createSignedUrl(photos[0].storage_path, 60)).error).toBeTruthy(); // outro organizador, mesmo depois da revelação
  const pub2 = await fetch(`${SB}/storage/v1/object/public/event-photos/${photos[0].storage_path}`);
  expect(pub2.status).not.toBe(200);
  await octx.close(); await gctx.close();
});
