import { expect, type Page } from "@playwright/test";

export async function setTheme(page: Page, theme: "dia" | "noite") {
  await page.addInitScript((t) => localStorage.setItem("mm-tema", t), theme);
}

/** Cria o evento de exemplo pela home e devolve o código do convite. */
export async function openDemo(page: Page): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Ver uma festa de exemplo" }).click();
  await page.waitForURL(/\/e\/[A-Z0-9]{8}\/agora/);
  const code = page.url().match(/\/e\/([A-Z0-9]{8})\//)![1];
  await expect(page.getByRole("heading", { name: "Agora" })).toBeVisible();
  return code;
}
