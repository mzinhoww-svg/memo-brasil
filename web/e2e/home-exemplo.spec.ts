import { expect, test, type Page } from "@playwright/test";

// Home (tela Main) separada da gestão e câmera da festa de exemplo (S3): abre, recusa e fecha sem gravar nada.

const watchWrites = (page: Page) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && !r.url().startsWith("data:")) writes.push(`${r.method()} ${r.url()}`);
  });
  return writes;
};

test("câmera da festa de exemplo: liga com permissão, fotografa e fecha ao sair sem gravar", async ({ page }) => {
  await page.goto("/");
  const writes = watchWrites(page);
  await page.getByRole("link", { name: /Experimente a câmera agora/ }).click();
  await page.waitForURL(/\/exemplo$/);
  // nada de câmera sem pedir: começa desligada, com a ação visível
  await expect(page.getByText("A câmera fica desligada até você pedir.")).toBeVisible();
  expect(await page.evaluate(() => document.querySelector("video")?.srcObject ?? null)).toBeNull();
  await page.getByRole("button", { name: "Ligar a câmera" }).click();
  await expect(page.getByLabel("Câmera ao vivo")).toBeVisible();
  await page.getByRole("button", { name: "Tirar foto de exemplo" }).click();
  await expect(page.getByText("4", { exact: true })).toBeVisible();
  // guarda a trilha para conferir que sair a encerra
  expect(await page.evaluate(() => { const t = (document.querySelector("video")!.srcObject as MediaStream).getVideoTracks()[0]; (window as unknown as { __t: MediaStreamTrack }).__t = t; return t.readyState; })).toBe("live");
  await page.getByRole("button", { name: "Desligar a câmera" }).click();
  expect(await page.evaluate(() => (window as unknown as { __t: MediaStreamTrack }).__t.readyState)).toBe("ended");
  await page.getByRole("button", { name: "Ligar a câmera" }).click();
  await expect(page.getByLabel("Câmera ao vivo")).toBeVisible();
  expect(await page.evaluate(() => { const t = (document.querySelector("video")!.srcObject as MediaStream).getVideoTracks()[0]; (window as unknown as { __t: MediaStreamTrack }).__t = t; return t.readyState; })).toBe("live");
  await page.getByRole("link", { name: "Sair" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  expect(await page.evaluate(() => (window as unknown as { __t: MediaStreamTrack }).__t.readyState)).toBe("ended"); // navegação no cliente: a trilha antiga foi encerrada
  // a festa de exemplo não entra no banco local do app nem vai ao servidor
  const stored = await page.evaluate(() => new Promise<number>((ok) => {
    const req = indexedDB.open("memoriesmt");
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("events")) return ok(0);
      const c = db.transaction("events").objectStore("events").count();
      c.onsuccess = () => ok(c.result);
    };
  }));
  expect(stored).toBe(0);
  expect(writes).toEqual([]);
});

test.describe("permissão de câmera recusada", () => {
  test.use({ permissions: [] });
  test("recusa mostra aviso e o disparo usa imagem de exemplo", async ({ page }) => {
    // o navegador de teste aceita a câmera falsa; aqui a pessoa recusa (NotAllowedError, como no prompt real)
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
    });
    await page.goto("/exemplo");
    await page.getByRole("button", { name: "Ligar a câmera" }).click();
    await expect(page.getByText("Acesso à câmera recusado. O disparo usa uma imagem de exemplo.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await page.getByRole("button", { name: "Tirar foto de exemplo" }).click();
    await expect(page.getByText("4", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Sair" }).click();
    await page.waitForURL((u) => u.pathname === "/");
  });
});

test("home não lista eventos; Meus eventos mostra os ativos com Painel", async ({ page }) => {
  await page.goto("/dev/seed");
  await page.waitForURL(/agora/);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Seus eventos|Festas em que você entrou/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver no Agora" })).toHaveCount(0);
  await page.getByRole("link", { name: "Meus eventos" }).click();
  await page.waitForURL(/\/eventos$/);
  await expect(page.getByRole("heading", { name: "Meus eventos", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ativos" }).getByRole("link", { name: "Painel" }).first()).toBeVisible();
});

for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`home ${size.width}px sem rolagem horizontal e com as ações visíveis`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    for (const name of [/Experimente a câmera agora/, "Criar meu evento grátis", "Tenho um código"]) await expect(page.getByRole("link", { name })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
