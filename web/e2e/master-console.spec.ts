import { readFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Console master redesenhado no navegador real contra o app em modo Supabase + Supabase LOCAL (playwright.supabase.config.ts).
// Semeia com a service key: master, organizador (e-mail comum) com 3 eventos reais e 2 "TESTE – excluir …" marcados pelo servidor, convidados e uma foto.
// Capturas para o PR só com CONSOLE_EVIDENCE_DIR definido (ex.: ../docs/evidence/console-20261024/depois).
const URL = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
test.skip(!URL || !PUB || !SVC || !/127\.0\.0\.1|localhost/.test(URL), "precisa de Supabase local e das chaves no ambiente");
const mk = (k = PUB) => createClient(URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = URL ? mk(SVC) : (undefined as never);
const tag = Math.random().toString(36).slice(2, 8);
const refName = () => `sb-${new globalThis.URL(URL).hostname.split(".")[0]}-auth-token`;
const EVIDENCE = process.env.CONSOLE_EVIDENCE_DIR;
const REASON = `Teste automatizado do console ${tag}`;

async function login(ctx: BrowserContext, s: Session, base: string) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const parts = v.match(/.{1,3180}/g)!;
  const host = new globalThis.URL(base).hostname;
  await ctx.addCookies(parts.map((p, i) => ({ name: parts.length === 1 ? refName() : `${refName()}.${i}`, value: p, domain: host, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const })));
}
async function user(kind: "master" | "org") {
  // organizador com e-mail comum: conta @memoriesmt.test marca todos os eventos dela como teste na criação
  const email = kind === "org" ? `org-console-${tag}@example.com` : `${kind}-console-${tag}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: kind === "master" ? { role: "master" } : {} });
  expect(u.error).toBeNull();
  if (kind === "master") expect((await admin.from("platform_roles").insert({ user_id: u.data.user!.id, role: "master", granted_by: u.data.user!.id })).error).toBeNull();
  const c = mk(); const s = await c.auth.signInWithPassword({ email, password });
  expect(s.error).toBeNull();
  return { id: u.data.user!.id, session: s.data.session!, client: c };
}

type Ev = { id: string; title: string };
const S = {} as { master: Awaited<ReturnType<typeof user>>; org: Awaited<ReturnType<typeof user>>; realA: Ev; realB: Ev; lote: Ev; testA: Ev; testB: Ev; settings0: unknown; hadCnpj: boolean };

const ROTAS = ["", "eventos", "revelacoes", "saude", "usuarios", "organizadores", "participantes", "lgpd", "pagamentos", "planos", "codigos", "analytics", "storage", "auditoria", "configuracoes"] as const;
const slug = (r: string) => r || "visao-geral";
const kpi = (page: Page, label: string) => page.locator(".adm-kpi", { has: page.getByRole("heading", { name: label, exact: true }) }).locator(".adm-kpi-value");
const intOf = (s: string | null) => Number((s ?? "").replace(/\D/g, ""));
const row = (page: Page, title: string) => page.getByRole("row").filter({ has: page.getByRole("link", { name: title, exact: true }) });

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  S.master = await user("master");
  S.org = await user("org");
  const inFuture = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
  const mkEvent = async (title: string, extra: Record<string, unknown> = {}) => {
    // criado pelo próprio organizador (cliente authenticated), como no app
    const r = await S.org.client.from("events").insert({ title, category: "casamento", host_id: S.org.id, host_name: "Org Console", duration_hours: 6, ...extra }).select("id,title,is_test").single();
    expect(r.error, title).toBeNull();
    return r.data as Ev & { is_test: boolean };
  };
  const a = await mkEvent(`Real A ${tag}`, { reveal_enabled: true, reveal_anchor: "data", reveal_at: inFuture(48) });
  const b = await mkEvent(`Real B ${tag}`);
  const l = await mkEvent(`Lote ${tag}`);
  const ta = await mkEvent(`TESTE – excluir A ${tag}`);
  const tb = await mkEvent(`TESTE – excluir B ${tag}`);
  expect([a.is_test, b.is_test, l.is_test]).toEqual([false, false, false]);
  expect([ta.is_test, tb.is_test]).toEqual([false, false]); // título não marca mais na criação (I2)
  // os de teste são marcados pelo servidor (service key), como numa semeadura
  const marked = await admin.from("events").update({ is_test: true }).in("id", [ta.id, tb.id]).select("is_test");
  expect(marked.error).toBeNull();
  expect(marked.data!.map((e) => e.is_test)).toEqual([true, true]);
  Object.assign(S, { realA: a, realB: b, lote: l, testA: ta, testB: tb });
  expect((await admin.from("events").update({ capacity: 30 }).eq("id", a.id)).error).toBeNull();

  // dois convidados anônimos e uma foto pronta (só a linha; sem upload no Storage)
  for (const [i, ev] of [[1, a], [2, a], [3, ta]] as const) {
    const g = mk(); const s = await g.auth.signInAnonymously(); expect(s.error).toBeNull();
    expect((await admin.from("participants").insert({ event_id: ev.id, user_id: s.data.user!.id, name: `Convidado ${i}` })).error).toBeNull();
    if (i === 1) {
      const id = randomUUID();
      expect((await admin.from("photos").insert({ id, event_id: a.id, author_id: s.data.user!.id, author_name: "Convidado 1", storage_path: `${a.id}/${id}`, upload_status: "pronta", mime: "image/jpeg", bytes: 2048 })).error).toBeNull();
    }
  }
  const st = await admin.from("platform_settings").select("value").eq("key", "company_cnpj").maybeSingle();
  S.hadCnpj = !!st.data; S.settings0 = st.data?.value ?? null;
});

test.afterAll(async () => {
  if (!S.master) return;
  if (S.hadCnpj) await admin.from("platform_settings").update({ value: S.settings0 }).eq("key", "company_cnpj");
  else await admin.from("platform_settings").delete().eq("key", "company_cnpj");
  await admin.from("platform_roles").update({ revoked_at: new Date().toISOString() }).eq("user_id", S.master.id);
});

async function masterPage(browser: import("@playwright/test").Browser, baseURL: string, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true }); await login(ctx, S.master.session, baseURL);
  return { ctx, page: await ctx.newPage() };
}
const overview = async (c: SupabaseClient, includeTests: boolean) => {
  const r = await c.rpc("admin_overview", { p_days: 30, p_include_tests: includeTests });
  expect(r.error).toBeNull();
  return (r.data as { kpis: { activeEvents: { value: number } } }).kpis.activeEvents.value;
};

test("(a) Visão geral: Ocultar testes conta só eventos reais; desligado inclui os testes", async ({ browser, baseURL }) => {
  const { ctx, page } = await masterPage(browser, baseURL!);
  await page.goto("/master");
  await expect(page.getByRole("heading", { name: "Visão geral", level: 1 })).toBeVisible();
  const toggle = page.getByRole("switch", { name: "Ocultar testes" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("sem eventos de teste", { exact: false })).toBeVisible();
  const on = intOf(await kpi(page, "Eventos ativos").textContent());
  await toggle.click();
  await expect(page).toHaveURL(/testes=1/);
  await expect(page.getByRole("switch", { name: "Ocultar testes" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("com eventos de teste", { exact: false })).toBeVisible();
  const off = intOf(await kpi(page, "Eventos ativos").textContent());
  expect(on).toBe(await overview(S.master.client, false));
  expect(off).toBe(await overview(S.master.client, true));
  expect(off - on).toBeGreaterThanOrEqual(2); // os 2 "TESTE – excluir" ativos só entram com testes
  // os eventos reais semeados entram nos dois
  const real = await admin.from("events").select("id", { count: "exact", head: true }).eq("is_test", false).is("deleted_at", null).is("ended_at", null).in("id", [S.realA.id, S.realB.id, S.lote.id]);
  expect(real.count).toBe(3);
  await ctx.close();
});

test("(b) Eventos: TESTE, Plano, Ocupação, ordenação e drawer com linha do tempo, participantes e auditoria", async ({ browser, baseURL }) => {
  const { ctx, page } = await masterPage(browser, baseURL!);
  await page.goto(`/master/eventos?q=${tag}`);
  await expect(page.getByRole("heading", { name: "Eventos", level: 1 })).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader", { name: "Plano" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Ocupação/ })).toBeVisible();
  await expect(row(page, `Real A ${tag}`)).toBeVisible();
  await expect(row(page, `TESTE – excluir A ${tag}`)).toHaveCount(0); // testes ocultos por padrão
  await expect(row(page, `Real A ${tag}`)).toContainText("2 / 30");
  await expect(row(page, `Real B ${tag}`).getByRole("cell").nth(4)).toHaveText("Grátis"); // Plano (catálogo) da coluna nova
  await expect(row(page, `Real B ${tag}`).getByRole("cell").nth(5)).toContainText("0 / 10"); // Ocupação: medidor do limite

  await page.getByRole("switch", { name: "Ocultar testes" }).click();
  await expect(page).toHaveURL(/testes=1/);
  await expect(row(page, `TESTE – excluir A ${tag}`)).toContainText("TESTE");
  await expect(row(page, `Real A ${tag}`)).not.toContainText("TESTE");
  await expect(page.locator("tbody tr")).toHaveCount(5);

  await table.getByRole("link", { name: "Evento", exact: true }).click();
  await expect(page).toHaveURL(/ord=title&dir=asc/);
  await expect(table.getByRole("columnheader", { name: /Evento/ })).toHaveAttribute("aria-sort", "ascending");
  const titles = async () => (await page.locator("tbody tr td:nth-child(2) a").allTextContents()).map((t) => t.trim());
  await expect.poll(titles).toEqual([`Lote ${tag}`, `Real A ${tag}`, `Real B ${tag}`, `TESTE – excluir A ${tag}`, `TESTE – excluir B ${tag}`]);
  await table.getByRole("link", { name: /Evento/ }).click();
  await expect(page).toHaveURL(/ord=title&dir=desc/);
  await expect.poll(titles).toEqual([`TESTE – excluir B ${tag}`, `TESTE – excluir A ${tag}`, `Real B ${tag}`, `Real A ${tag}`, `Lote ${tag}`]);

  // a linha inteira abre o drawer (clique fora do link do título)
  await row(page, `Real A ${tag}`).getByRole("cell", { name: "Org Console" }).click();
  await expect(page).toHaveURL(new RegExp(`ev=${S.realA.id}`));
  const drawer = page.getByRole("dialog", { name: `Real A ${tag}` });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Linha do tempo" })).toBeVisible();
  await expect(drawer.getByRole("region", { name: "Linha do tempo" }).getByRole("listitem").first()).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Participantes (2)" })).toBeVisible();
  await expect(drawer.getByText("Convidado 1")).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Auditoria do evento" })).toBeVisible();
  await expect(drawer.getByText("2 / 30")).toBeVisible();
  if (EVIDENCE) { mkdirSync(EVIDENCE, { recursive: true }); await page.screenshot({ path: `${EVIDENCE}/eventos-drawer-1280.png` }); }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/ev=/);
  await expect(page).toHaveURL(/ord=title/); // fechar mantém filtros e ordenação
  await ctx.close();
});

test("(c) lote: marcar como teste e excluir testes exigem justificativa; evento real nunca é excluído", async ({ browser, baseURL }) => {
  const { ctx, page } = await masterPage(browser, baseURL!);
  await page.goto(`/master/eventos?q=${tag}&testes=1`);
  const bulk = page.getByRole("region", { name: "Ações em lote" });

  // marcar como teste
  await page.getByRole("checkbox", { name: `Selecionar Lote ${tag}` }).check();
  await bulk.getByRole("button", { name: "Marcar como teste" }).click();
  let sheet = page.getByRole("dialog", { name: "Marcar como teste" });
  await expect(sheet.getByRole("listitem")).toHaveText([`Lote ${tag}`]);
  await sheet.getByRole("button", { name: "Marcar como teste" }).click();
  await expect(sheet.getByText("Escreva o motivo com pelo menos 10 caracteres.")).toBeVisible();
  expect((await admin.from("events").select("is_test").eq("id", S.lote.id).single()).data!.is_test).toBe(false);
  await sheet.getByLabel("Justificativa (obrigatória, 10 a 500 caracteres)").fill(REASON);
  await sheet.getByRole("button", { name: "Marcar como teste" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(bulk).toContainText("1 evento(s) marcado(s) como teste.");
  await expect(row(page, `Lote ${tag}`)).toContainText("TESTE");
  expect((await admin.from("events").select("is_test").eq("id", S.lote.id).single()).data!.is_test).toBe(true);
  const markAudit = await admin.from("audit_logs").select("action,reason,actor_role").eq("event_id", S.lote.id).eq("action", "admin.set_test_flag");
  expect(markAudit.data).toEqual([{ action: "admin.set_test_flag", reason: REASON, actor_role: "master" }]);

  // excluir: seleção mista (um real + um teste); só o teste entra no lote
  await page.getByRole("checkbox", { name: `Selecionar Real B ${tag}` }).check();
  await page.getByRole("checkbox", { name: `Selecionar TESTE – excluir A ${tag}` }).check();
  await expect(bulk).toContainText("2 selecionado(s), 1 de teste");
  await bulk.getByRole("button", { name: "Excluir testes selecionados" }).click();
  sheet = page.getByRole("dialog", { name: "Excluir testes selecionados" });
  await expect(sheet.getByRole("listitem")).toHaveText([`TESTE – excluir A ${tag}`]);
  await sheet.getByRole("button", { name: "Excluir testes selecionados" }).click();
  await expect(sheet.getByText("Escreva o motivo com pelo menos 10 caracteres.")).toBeVisible();
  await expect(sheet.getByText("Marque a confirmação para continuar.")).toBeVisible();
  await sheet.getByLabel("Justificativa (obrigatória, 10 a 500 caracteres)").fill(REASON);
  await sheet.getByRole("button", { name: "Excluir testes selecionados" }).click();
  await expect(sheet.getByText("Marque a confirmação para continuar.")).toBeVisible();
  expect((await admin.from("events").select("deleted_at").eq("id", S.testA.id).single()).data!.deleted_at).toBeNull();
  await sheet.getByRole("checkbox", { name: /Confirmo a exclusão de 1 evento/ }).check();
  await sheet.getByRole("button", { name: "Excluir testes selecionados" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(bulk).toContainText("1 evento(s) de teste excluído(s).");

  await expect(row(page, `TESTE – excluir A ${tag}`)).toHaveCount(0); // some da lista padrão
  await expect(row(page, `Real B ${tag}`)).toBeVisible();
  const dbA = (await admin.from("events").select("deleted_at").eq("id", S.testA.id).single()).data!;
  expect(dbA.deleted_at).not.toBeNull(); // soft delete: a linha continua
  const dbReal = (await admin.from("events").select("id,deleted_at").eq("id", S.realB.id).single()).data!;
  expect(dbReal).toEqual({ id: S.realB.id, deleted_at: null });

  // banco recusa o lote com evento real (MM005) e nada é excluído
  const refused = await S.master.client.rpc("admin_soft_delete_test_events", { p_events: [S.realA.id, S.testB.id], p_reason: REASON });
  expect(refused.error?.code).toBe("MM005");
  expect((await admin.from("events").select("deleted_at").in("id", [S.realA.id, S.testB.id])).data!.map((e) => e.deleted_at)).toEqual([null, null]);

  // aparece em "Excluídos"
  await page.getByLabel("Situação").selectOption("excluido");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/status=excluido/);
  await expect(row(page, `TESTE – excluir A ${tag}`)).toContainText("excluido");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await ctx.close();
});

test("(d) Revelações: revelar agora pede justificativa, revela e audita", async ({ browser, baseURL }) => {
  const { ctx, page } = await masterPage(browser, baseURL!);
  await page.goto("/master/revelacoes");
  await expect(page.getByRole("heading", { name: "Revelações", level: 1 })).toBeVisible();
  const item = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: `Real A ${tag}`, exact: true }) });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Revelar agora" }).click();
  const sheet = page.getByRole("dialog", { name: "Revelar agora" });
  await sheet.getByRole("button", { name: "Revelar agora" }).click();
  await expect(sheet.getByText("Escreva o motivo com pelo menos 10 caracteres.")).toBeVisible();
  await expect(sheet.getByText("Marque a confirmação para continuar.")).toBeVisible();
  expect((await admin.from("events").select("revealed_at").eq("id", S.realA.id).single()).data!.revealed_at).toBeNull();
  await sheet.getByLabel("Justificativa (obrigatória, 10 a 500 caracteres)").fill(REASON);
  await sheet.getByRole("checkbox", { name: "Confirmo revelar este evento agora" }).check();
  await sheet.getByRole("button", { name: "Revelar agora" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(item).toHaveCount(0);
  const ev = (await admin.from("events").select("revealed_at,reveal_status").eq("id", S.realA.id).single()).data!;
  expect(ev.revealed_at).not.toBeNull();
  expect(ev.reveal_status).toBe("revelada");
  const aud = (await admin.from("audit_logs").select("action,reason,actor_role").eq("event_id", S.realA.id).in("action", ["admin.reveal_now", "reveal.released"])).data!;
  expect(aud).toContainEqual({ action: "admin.reveal_now", reason: REASON, actor_role: "master" });
  expect(aud).toContainEqual({ action: "reveal.released", reason: null, actor_role: "sistema" }); // sem ator: sistema, não o master
  await ctx.close();
});

test("(e) Auditoria: chips filtram por categoria; linhas novas mostram papel e link do alvo", async ({ browser, baseURL }) => {
  const { ctx, page } = await masterPage(browser, baseURL!);
  await page.goto("/master/auditoria");
  await expect(page.getByRole("heading", { name: "Auditoria e segurança", level: 1 })).toBeVisible();
  const chips = page.getByRole("navigation", { name: "Categoria" });
  await expect(chips.getByRole("link", { name: "Todas" })).toHaveAttribute("aria-current", "page");
  const actions = async () => (await page.locator("tbody td:nth-child(2) code").allTextContents()).map((t) => t.trim());

  await chips.getByRole("link", { name: "Admin" }).click();
  await expect(page).toHaveURL(/cat=admin/);
  await expect(chips.getByRole("link", { name: "Admin" })).toHaveAttribute("aria-current", "page");
  await expect.poll(actions).toContain("admin.reveal_now");
  expect((await actions()).every((a) => /^(admin\.|platform_role\.|platform_settings\.|feature_flags\.|plan\.|entitlement\.|audit\.|code\.|system\.|retention\.|event\.|photo\.access)/.test(a))).toBe(true);
  const r = page.getByRole("row").filter({ has: page.getByText("admin.reveal_now", { exact: true }) }).filter({ hasText: REASON }).first();
  await expect(r).toContainText("Master");
  const link = r.getByRole("link", { name: `Real A ${tag}` });
  await expect(link).toHaveAttribute("href", new RegExp(`/master/eventos\\?ev=${S.realA.id}`));

  await chips.getByRole("link", { name: "Revelação" }).click();
  await expect(page).toHaveURL(/cat=revelacao/);
  await expect.poll(actions).toContain("reveal.released");
  expect((await actions()).every((a) => a.startsWith("reveal."))).toBe(true);
  expect(await actions()).not.toContain("admin.reveal_now");

  await page.goto("/master/auditoria?cat=admin");
  await page.getByRole("row").filter({ has: page.getByText("admin.reveal_now", { exact: true }) }).filter({ hasText: REASON }).first().getByRole("link", { name: `Real A ${tag}` }).click();
  await expect(page).toHaveURL(new RegExp(`/master/eventos\\?ev=${S.realA.id}`));
  await expect(page.getByRole("dialog", { name: `Real A ${tag}` })).toBeVisible();
  await ctx.close();
});

test("(f) CSV de Eventos e Auditoria baixa arquivo com cabeçalho", async ({ browser, baseURL }) => {
  const { ctx, page } = await masterPage(browser, baseURL!);
  const csvOf = async (button: string) => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: button }).click()]);
    expect(dl.suggestedFilename()).toMatch(/\.csv$/);
    return readFileSync((await dl.path())!, "utf8").replace(/^﻿/, "").split("\r\n");
  };
  await page.goto(`/master/eventos?q=${tag}`);
  const ev = await csvOf("Exportar CSV");
  expect(ev[0]).toBe("ID;Evento;Anfitrião;Situação;Plano;Convidados;Limite;Fotos;Falhas;Revelação;Revela em;Início;Teste");
  expect(ev.some((l) => l.includes(`Real B ${tag}`))).toBe(true);
  expect(ev.some((l) => l.includes("TESTE – excluir"))).toBe(false); // segue o filtro da tela (testes ocultos)

  await page.goto("/master/auditoria");
  const au = await csvOf("Exportar página (CSV)");
  expect(au[0]).toBe("Quando;Ação;Papel;Alvo;Evento;Justificativa;Sensível");
  expect(au.length).toBeGreaterThan(1);
  await ctx.close();
});

test("(g) Configurações: CNPJ com justificativa, CNPJ inválido recusado, payments_env só leitura", async ({ browser, baseURL }) => {
  const { ctx, page } = await masterPage(browser, baseURL!);
  await page.goto("/master/configuracoes");
  await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();
  const field = page.getByRole("listitem").filter({ has: page.getByText("CNPJ", { exact: true }) });
  await field.getByRole("button", { name: /^(Preencher|Editar) CNPJ$/ }).click();
  const input = field.getByLabel("CNPJ", { exact: true });
  const reason = field.getByLabel("Motivo da alteração (obrigatório)");
  const save = field.getByRole("button", { name: "Salvar" });
  const dbCnpj = async () => (await admin.from("platform_settings").select("value").eq("key", "company_cnpj").maybeSingle()).data?.value ?? null;
  const before = await dbCnpj();

  await input.fill("11.111.111/1111-11");
  await reason.fill(REASON);
  await save.click();
  await expect(field.getByText("CNPJ inválido: confira os 14 caracteres e os dígitos verificadores.")).toBeVisible();
  expect(await dbCnpj()).toEqual(before);

  await input.fill("11222333000181");
  await reason.fill("");
  await save.click();
  await expect(field.getByText("Escreva o motivo com pelo menos 10 caracteres.")).toBeVisible();
  expect(await dbCnpj()).toEqual(before);

  await reason.fill(REASON);
  await save.click();
  await expect(field.getByRole("status")).toHaveText("Salvo e registrado na auditoria.");
  await expect(field).toContainText("11.222.333/0001-81");
  expect(await dbCnpj()).toBe("11.222.333/0001-81");

  const pay = page.getByRole("region", { name: "Ambiente de pagamentos" });
  await expect(pay).toContainText("Somente leitura");
  await expect(pay.locator("input, select, textarea, button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /payments_env|Ambiente de pagamentos/i })).toHaveCount(0);
  await ctx.close();
});

test("(h) busca global ⌘K acha o evento pelo nome e abre o drawer", async ({ browser, baseURL }) => {
  const { ctx, page } = await masterPage(browser, baseURL!);
  await page.goto("/master/saude");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const dlg = page.getByRole("dialog", { name: "Busca no console" });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("combobox").fill(`Real B ${tag}`);
  await expect(dlg.getByRole("option", { name: new RegExp(`Real B ${tag}`) })).toBeVisible();
  if (EVIDENCE) { mkdirSync(EVIDENCE, { recursive: true }); await page.screenshot({ path: `${EVIDENCE}/busca-cmdk-1280.png` }); }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/master/eventos\\?ev=${S.realB.id}`));
  await expect(page.getByRole("dialog", { name: `Real B ${tag}` })).toBeVisible();
  await ctx.close();
});

test("(i) as 15 páginas: 200, h1, sem erro de carga e sem rolagem horizontal em 400 px", async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  if (EVIDENCE) mkdirSync(EVIDENCE, { recursive: true });
  const { ctx, page } = await masterPage(browser, baseURL!);
  for (const rota of ROTAS) {
    const href = rota ? `/master/${rota}` : "/master";
    await page.setViewportSize({ width: 1280, height: 900 });
    const r = await page.goto(href);
    expect(r?.status(), href).toBe(200);
    await expect(page.locator("main h1, h1").first(), href).toBeVisible();
    await expect(page.getByText(/Não foi possível carregar/), href).toHaveCount(0);
    await expect(page.locator(".adm-aviso-degradado"), href).toHaveCount(0); // stack local tem a migration nova
    if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/${slug(rota)}-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto(href);
    await expect(page.locator("h1").first(), href).toBeVisible();
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(m.sw, `${href} scrollWidth ${m.sw} > ${m.iw}`).toBeLessThanOrEqual(m.iw);
    if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/${slug(rota)}-400.png`, fullPage: true });
  }
  if (EVIDENCE) {
    await page.goto(`/master/eventos?ev=${S.realB.id}`);
    await expect(page.getByRole("dialog", { name: `Real B ${tag}` })).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/eventos-drawer-400.png` });
    await page.getByRole("dialog").getByRole("link", { name: "Fechar" }).click();
    await page.getByRole("button", { name: /Buscar evento, e-mail, ID/ }).click();
    const dlg = page.getByRole("dialog", { name: "Busca no console" });
    await dlg.getByRole("combobox").fill(tag);
    await expect(dlg.getByRole("option").first()).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/busca-cmdk-400.png` });
  }
  await ctx.close();
});
