import { expect, test, type Page } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";

/**
 * Revelação programada, simulada localmente: o relógio do navegador é falso (page.clock) para atravessar o horário
 * de revelação sem esperar. O que fica para o backend (revelação no servidor, URLs assinadas, sincronização entre
 * aparelhos) NÃO é provado aqui: ver docs/supabase/INTEGRATION-PLAN.md.
 */
const MIN = 60_000;

function revealAt(t0: number, minutes: number) {
  const d = new Date(t0 + minutes * MIN);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), tz: "UTC" };
}

async function setup(page: Page, t0: number, minutes = 3, title = "Revelação") {
  await page.clock.install({ time: t0 });
  const { code, id } = await createViaWizard(page, { title, reveal: revealAt(t0, minutes) });
  return { code, id };
}

test("organizador liga a revelação, escolhe data, hora e fuso e vê o resumo; pode alterar enquanto pendente", async ({ page }) => {
  const t0 = Date.now();
  const { id } = await setup(page, t0, 120);
  await page.goto(`/painel/${id}`);
  await expect(page.getByTestId("resumo-revelacao")).toContainText("Pendente");
  await page.goto(`/painel/${id}/configuracoes`);
  const cfg = page.getByTestId("config-revelacao");
  await expect(cfg).toContainText("Ligada: revela em");
  await cfg.getByLabel("Fuso horário").selectOption("America/Cuiaba");
  await cfg.getByRole("button", { name: "Salvar revelação" }).click();
  await expect(cfg.getByText("Revelação salva.")).toBeVisible();
  await expect(cfg).toContainText("Cuiabá");
  // desligar também é permitido enquanto não revelou e sem fotos
  await cfg.getByRole("group", { name: "Revelação programada" }).getByRole("button", { name: /^Desligada/ }).click();
  await cfg.getByRole("button", { name: "Salvar revelação" }).click();
  await expect(cfg).toContainText("Desligada: as fotos aparecem na hora.");
});

test("data no passado é recusada com mensagem clara", async ({ page }) => {
  const t0 = Date.now();
  const { id } = await setup(page, t0, 120);
  await page.goto(`/painel/${id}/configuracoes`);
  const cfg = page.getByTestId("config-revelacao");
  const past = revealAt(t0, -60);
  await cfg.getByLabel("Data", { exact: true }).fill(past.date);
  await cfg.getByLabel("Horário", { exact: true }).fill(past.time);
  await cfg.getByRole("button", { name: "Salvar revelação" }).click();
  await expect(cfg.getByText("Escolha um horário no futuro, pelo menos 1 minuto à frente.")).toBeVisible();
});

test("convidado fotografa, não vê fotos bloqueadas, espera com contagem e a galeria abre sozinha na hora", async ({ page, context }) => {
  const t0 = Date.now();
  const { code } = await setup(page, t0, 3);
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await expect(page.getByTestId("guardada-no-escuro")).toBeVisible();

  await page.goto(`/e/${code}/agora`);
  const espera = page.getByTestId("aguardando-revelacao");
  await expect(espera).toBeVisible();
  await expect(espera).toContainText("O filme ainda está no escuro.");
  await expect(page.getByTestId("contagem")).toContainText(/\d{2}h \d{2}min \d{2}s/);
  await expect(espera).toContainText(/1\s*foto sua guardada/);
  await expect(page.locator(".mm-post")).toHaveCount(0); // nenhuma foto bloqueada na galeria
  await expect(page.locator(".mm-media img")).toHaveCount(0);

  await page.goto(`/e/${code}/voce`);
  await expect(page.getByText("Guardada", { exact: true })).toBeVisible();
  await expect(page.locator(".app-thumb img")).toHaveCount(0);
  await page.goto(`/e/${code}/explorar`);
  await expect(page.getByTestId("aguardando-revelacao")).toBeVisible();

  // chega a hora com o app aberto e SEM rede: a revelação não depende de rede nem de recarregar
  await page.goto(`/e/${code}/agora`);
  await expect(page.getByTestId("aguardando-revelacao")).toBeVisible();
  await context.setOffline(true);
  await page.clock.fastForward("04:00");
  await expect(page.getByTestId("transicao-revelacao")).toBeVisible();
  await expect(page.getByText("O filme foi revelado.")).toBeVisible({ timeout: 6000 });
  await page.getByRole("button", { name: "Ver as fotos" }).click();
  await expect(page.getByTestId("aguardando-revelacao")).toHaveCount(0);
  await expect(page.locator(".mm-post")).toHaveCount(1);
  await expect(page.locator(".mm-media img").first()).toBeVisible();
  await context.setOffline(false);
});

test("modo sem revelação: a foto aparece na hora, sem tela de espera", async ({ page }) => {
  const { code } = await createViaWizard(page, { title: "Sem revelação", reveal: "desligada" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  await expect(page.getByTestId("aguardando-revelacao")).toHaveCount(0);
  await expect(page.getByText("Visão de Ana")).toBeVisible();
});

test("participante que entra depois da revelação vê a galeria direto, sem a transição", async ({ page }) => {
  const t0 = Date.now();
  const { code } = await setup(page, t0, 3);
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.clock.fastForward("04:00");
  await switchPerson(page, code, "Beto");
  await expect(page.getByTestId("transicao-revelacao")).toHaveCount(0);
  await expect(page.getByText("Visão de Ana")).toBeVisible();
});

test("app fechado na hora da revelação: ao reabrir já está revelada e o estado é espelhado no armazenamento", async ({ page, context }) => {
  const t0 = Date.now();
  const { code, id } = await setup(page, t0, 3);
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.close();

  const reopened = await context.newPage();
  await reopened.clock.install({ time: t0 + 10 * MIN });
  await reopened.goto(`/e/${code}/agora`);
  await expect(reopened.getByText("Visão de Ana")).toBeVisible();
  await expect(reopened.getByTestId("transicao-revelacao")).toHaveCount(0);
  await expect.poll(() => reopened.evaluate(async (eid) => {
    const db: IDBDatabase = await new Promise((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => res(r.result); });
    const e: { revealStatus: string } = await new Promise((res) => { const r = db.transaction("events").objectStore("events").get(eid); r.onsuccess = () => res(r.result); });
    return e.revealStatus;
  }, id)).toBe("revelada");
});

test("organizador não altera a revelação depois que ela aconteceu", async ({ page }) => {
  const t0 = Date.now();
  const { id } = await setup(page, t0, 3);
  await page.goto(`/painel/${id}/configuracoes`);
  await page.clock.fastForward("04:00");
  const cfg = page.getByTestId("config-revelacao");
  await expect(cfg).toContainText("A revelação aconteceu em");
  await expect(cfg.getByRole("button", { name: "Salvar revelação" })).toHaveCount(0);
});

test("prévia do convidado no painel mostra a tela de espera", async ({ page }) => {
  const t0 = Date.now();
  const { id } = await setup(page, t0, 120);
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "Pré-visualizar como convidado" }).click();
  const prev = page.getByRole("dialog", { name: "Prévia do convidado" });
  await expect(prev.getByTestId("aguardando-revelacao")).toContainText("Prévia · como o convidado vê");
  await expect(prev.getByTestId("contagem")).toBeVisible();
});

test("administrador master: rota é só um ponto de integração, sem login e sem efeito por parâmetro", async ({ page }) => {
  for (const url of ["/master", "/master?role=master", "/master?admin=1&token=abc"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Console indisponível neste modo." })).toBeVisible(); // modo local: sem operadores
    await expect(page.locator("input")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Módulos do console" })).toHaveCount(0); // parâmetro de URL não abre nada
  }
  // outro usuário não administra o evento de alguém
  const { id, code } = await createViaWizard(page, { title: "Alheio", reveal: "desligada" });
  await switchPerson(page, code, "Intruso");
  await page.goto(`/painel/${id}/configuracoes?role=master`);
  await expect(page.getByRole("heading", { name: "Só o anfitrião abre o painel." })).toBeVisible();
});

test("BG-101: 'ao terminar' acompanha o fim ao estender e ao encerrar agora (pela interface)", async ({ page }) => {
  const { id } = await createViaWizard(page, { title: "Acompanha o fim", reveal: "ao-terminar" });
  await page.goto(`/painel/${id}/configuracoes`);
  const cfg = page.getByTestId("config-revelacao");
  const fim = async () => (await cfg.getByText(/Fim do evento:/).textContent())!.replace(/^.*Fim do evento: /, "").replace(/\.$/, "");
  const revela = async () => (await cfg.getByText(/Ligada: revela em/).textContent())!.replace(/^.*Ligada: revela em /, "").split(". Fim do evento")[0];
  expect(await revela()).toBe(await fim());
  const antes = await fim();
  await page.getByRole("button", { name: "1 dia" }).click(); // estende o fim para daqui a 1 dia
  await expect.poll(fim).not.toBe(antes);
  expect(await revela()).toBe(await fim()); // a revelação foi junto
  await page.getByRole("button", { name: "Encerrar agora" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Encerrar agora" }).click();
  await expect(cfg).toContainText("A revelação aconteceu em"); // revelou no encerramento, sem esperar horas
});

test("BG-102: com o relógio do aparelho recuado, a revelação já ocorrida não volta a esconder nem destrava a edição", async ({ page }) => {
  const t0 = Date.now();
  const { code, id } = await setup(page, t0, 3, "Relógio recuado");
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.clock.fastForward("04:00");
  await expect(page.getByTestId("transicao-revelacao")).toBeVisible();
  await page.getByRole("button", { name: "Ver as fotos", exact: true }).click({ timeout: 8000 });
  await page.getByRole("link", { name: "Agora", exact: true }).click();
  await expect(page.locator(".mm-post")).toHaveCount(1);
  await expect.poll(() => page.evaluate(async (eid) => {
    const db: IDBDatabase = await new Promise((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => res(r.result); });
    const e: { revealedAt: number | null } = await new Promise((res) => { const r = db.transaction("events").objectStore("events").get(eid); r.onsuccess = () => res(r.result); });
    return e.revealedAt !== null;
  }, id)).toBe(true); // a reconciliação gravou revealedAt antes de recuar o relógio

  await page.clock.setFixedTime(t0 - 60 * MIN); // relógio do aparelho recuado para uma hora antes do evento
  await page.reload();
  await expect(page.getByTestId("aguardando-revelacao")).toHaveCount(0);
  await expect(page.locator(".mm-post")).toHaveCount(1);
  const revealedAt = await page.evaluate(async (eid) => {
    const db: IDBDatabase = await new Promise((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => res(r.result); });
    const e: { revealStatus: string; revealedAt: number | null } = await new Promise((res) => { const r = db.transaction("events").objectStore("events").get(eid); r.onsuccess = () => res(r.result); });
    return e;
  }, id);
  expect(revealedAt.revealStatus).toBe("revelada");
  expect(revealedAt.revealedAt).not.toBeNull();
});
