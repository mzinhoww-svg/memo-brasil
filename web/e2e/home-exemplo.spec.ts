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
  await page.getByRole("link", { name: "Experimentar câmera" }).click();
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
  // a URL muda antes de a página antiga desmontar; a trilha precisa terminar logo depois (sem ficar ligada)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __t: MediaStreamTrack }).__t.readyState), { timeout: 3_000 }).toBe("ended");
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

test("home não lista eventos; Minhas câmeras mostra a câmera ativa com acesso ao painel (QR)", async ({ page }) => {
  await page.goto("/dev/seed");
  await page.waitForURL(/agora/);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Seus eventos|Suas câmeras|Festas em que você entrou/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver no Agora" })).toHaveCount(0);
  await page.getByRole("link", { name: "Minhas câmeras" }).click();
  await page.waitForURL(/\/eventos$/);
  await expect(page.getByRole("heading", { name: "Suas câmeras", level: 1 })).toBeVisible();
  await expect(page.getByText("Rolando agora")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir câmera" })).toBeVisible();
  await expect(page.getByRole("link", { name: "QR code" })).toHaveAttribute("href", /\/painel\/[^/]+\/qr$/);
});

for (const size of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`home ${size.width}px sem rolagem horizontal e com as ações visíveis`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    for (const name of ["Experimentar câmera", "Montar câmera", "Tenho um convite"]) await expect(page.getByRole("link", { name })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // rodapé só com o próprio conteúdo, sem bloco vazio de tela cheia
    expect((await page.getByRole("contentinfo", { name: "Rodapé" }).boundingBox())!.height).toBeLessThan(260);
  });
}

test("home por teclado: Tab alcança as ações na ordem e Enter abre a festa de exemplo", async ({ page }) => {
  await page.goto("/");
  const reached: string[] = [];
  for (let i = 0; i < 12 && reached.length < 3; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText?.trim() ?? "");
    if (["Tenho um convite", "Montar câmera", "Experimentar câmera"].includes(name)) reached.push(name);
  }
  expect(reached).toEqual(["Tenho um convite", "Montar câmera", "Experimentar câmera"]);
  await page.getByRole("link", { name: "Experimentar câmera" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/exemplo$/);
  await page.getByRole("link", { name: "Criar meu evento grátis" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/criar/);
});

test("Tenho um convite leva ao formulário de código", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Tenho um convite" }).click();
  await page.waitForURL(/\/entrar/);
  await expect(page.getByRole("heading", { name: /Digite o código/, level: 1 })).toBeVisible();
});
