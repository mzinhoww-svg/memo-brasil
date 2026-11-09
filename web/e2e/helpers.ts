import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));

export async function setTheme(page: Page, theme: "dia" | "noite") {
  await page.addInitScript((t) => localStorage.setItem("mm-tema", t), theme);
}

/** Cria o evento de exemplo pela home e devolve o código do convite. */
export async function openDemo(page: Page): Promise<string> {
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/\/e\/[A-Z0-9]{8}\/agora/);
  const code = page.url().match(/\/e\/([A-Z0-9]{8})\//)![1];
  await expect(page.getByRole("heading", { name: "Agora" })).toBeVisible();
  return code;
}

/** Cria um evento pelo wizard e devolve o código. Parâmetros avançam passo a passo pela UI real. */
export type RevealOpt = "ao-terminar" | "desligada" | { date: string; time: string; tz?: string };

/**
 * O assistente não pergunta mais "Seu nome": o anfitrião vem da conta (Google na nuvem). No modo local não há conta,
 * então o teste planta a identidade do aparelho (a mesma que `signIn` grava) e recarrega a tela.
 */
export async function seedHost(page: Page, name: string): Promise<void> {
  await page.getByRole("heading", { level: 1, name: "Escolha a embalagem" }).waitFor();
  type Result = "planted" | "has-user" | "retry";
  const attempt = () => page.evaluate((n) => new Promise<Result>((res) => {
    // nunca cria o banco (abrir sem versão criaria um v1 vazio e travaria a migração do app): só usa o que o app já abriu
    void indexedDB.databases().then((dbs) => {
      if (!dbs.some((d) => d.name === "memoriesmt")) return res("retry");
      const r = indexedDB.open("memoriesmt");
      r.onerror = () => res("retry");
      r.onblocked = () => res("retry");
      r.onsuccess = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("meta")) { db.close(); return res("retry"); }
        const tx = db.transaction("meta", "readwrite");
        const st = tx.objectStore("meta");
        let result: Result = "has-user";
        const cur = st.get("user");
        cur.onsuccess = () => {
          if (cur.result) return;
          const u = { id: crypto.randomUUID(), name: n, createdAt: Date.now() };
          st.put(u, "user");
          st.put([u], "known");
          result = "planted";
        };
        tx.oncomplete = () => { db.close(); res(result); };
        tx.onerror = tx.onabort = () => { db.close(); res("retry"); };
      };
    }, () => res("retry"));
  }), name);
  let out: Result = "retry";
  for (let i = 0; i < 40 && out === "retry"; i++) {
    out = await attempt();
    if (out === "retry") await page.waitForTimeout(250);
  }
  if (out === "retry") throw new Error("seedHost: o banco local do app não abriu");
  if (out === "planted") { await page.reload(); await page.getByRole("heading", { level: 1, name: "Escolha a embalagem" }).waitFor(); }
}

/**
 * Percorre os 8 passos de "Monte a câmera" pela interface real e para no passo 8 (plano):
 * embalagem → nome → até quando (6 h) → poses (Grátis) → quando revelar → filme → quem vê o quê → plano.
 * O evento sempre nasce no Grátis (10/10): `shots`/`capacity` fora disso são ajustados no painel por `createViaWizard`.
 */
export async function wizardToSummary(page: Page, opts: { title?: string; reveal?: RevealOpt; shots?: string; capacity?: string; host?: string } = {}): Promise<void> {
  const next = () => page.getByRole("button", { name: "Próximo" }).click();
  await page.goto("/criar");
  await seedHost(page, opts.host ?? "Emy");
  await next(); // 1 embalagem (Festa)
  await page.getByLabel("Nome que os convidados vão ver").fill(opts.title ?? "Emy e Igor");
  await next(); // 2 nome
  await next(); // 3 quando é a festa: hoje, próxima meia hora + 6 h
  await next(); // 4 poses: 10 (Grátis)
  const reveal = opts.reveal ?? "ao-terminar";
  // O assistente tem quatro opções (acabar, dia seguinte, um dia depois, escolher dia e hora) no fuso do aparelho.
  // "Na hora" (desligada) e fuso diferente do aparelho ficam nas configurações do painel: `createViaWizard` aplica depois.
  const inWizard = reveal !== "desligada" && !(typeof reveal === "object" && reveal.tz);
  if (!inWizard || reveal === "ao-terminar") await page.getByRole("button", { name: /Quando a festa acabar/ }).click();
  else if (typeof reveal === "object") {
    await page.getByRole("button", { name: /Escolher dia e hora/ }).click();
    await page.getByLabel("Dia e hora da revelação").fill(`${reveal.date}T${reveal.time}`);
  }
  await next(); // 5 quando revelar
  await next(); // 6 filme
  await next(); // 7 quem vê o quê
  await page.getByRole("heading", { level: 1, name: "Escolha o plano" }).waitFor();
}

/** Passo 8 → diálogo "Antes de criar": aceita os Termos e a Política (as duas são obrigatórias) e confirma. */
export async function acceptTerms(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Antes de criar" });
  await dialog.getByRole("checkbox", { name: /Li e aceito os Termos/ }).check();
  await dialog.getByRole("checkbox", { name: /Li a Política/ }).check();
  await dialog.getByRole("button", { name: "Aceitar" }).click();
}

/** Aplica pelas configurações do painel a revelação que o assistente não oferece (desligada ou com outro fuso). */
export async function applyReveal(page: Page, id: string, reveal: RevealOpt) {
  if (reveal === "ao-terminar" || (typeof reveal === "object" && !reveal.tz)) return;
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: /^Revela\b/ }).click(); // linha "Revela" abre a folha "Quando revelar"
  const box = page.getByTestId("config-revelacao");
  if (reveal === "desligada") {
    await box.getByRole("button", { name: /Desligada/ }).click();
  } else {
    await box.getByRole("button", { name: /^Ligada/ }).click();
    await box.getByRole("button", { name: /Escolher data e hora/ }).click();
    await box.getByLabel("Data", { exact: true }).fill(reveal.date);
    await box.getByLabel("Horário", { exact: true }).fill(reveal.time);
    await box.getByLabel("Fuso horário").selectOption(reveal.tz!);
  }
  await box.getByRole("button", { name: "Salvar revelação" }).click();
  await expect(box.getByText("Revelação salva.")).toBeVisible();
}

/** Convidado (20b → 20d): nome, "Entrar e fotografar", aceites no diálogo "Antes de fotografar". */
export async function enterAsGuest(page: Page, name: string) {
  await page.getByLabel("Seu nome").fill(name);
  await page.getByRole("button", { name: /Entrar e fotografar/ }).click();
  const dialog = page.getByRole("dialog", { name: "Antes de fotografar" });
  await dialog.getByRole("checkbox", { name: /Li e aceito os Termos/ }).check();
  await dialog.getByRole("checkbox", { name: /Li a Política/ }).check();
  await dialog.getByRole("button", { name: "Aceitar" }).click();
}

export async function createViaWizard(page: Page, opts: { title?: string; reveal?: RevealOpt; shots?: string; capacity?: string; host?: string } = {}): Promise<{ code: string; id: string }> {
  await wizardToSummary(page, opts);
  await page.getByRole("button", { name: /Criar câmera|Continuar ·/ }).click();
  await acceptTerms(page);
  await page.waitForURL(/\/criar\/pronto\//);
  const code = (await page.getByTestId("codigo").textContent())!.trim();
  const id = page.url().split("/").pop()!;
  await applyReveal(page, id, opts.reveal ?? "ao-terminar");
  // o assistente só cria no Grátis (10/10); limites diferentes entram pelas configurações do painel
  // poses ficam na linha "Poses"; capacidade, na folha do botão "Mais"
  const wanted = [["Fotos por pessoa", opts.shots, "10", "poses"], ["Convidados", opts.capacity, "10", "mais"]] as const;
  if (wanted.some(([, v, free]) => v && v !== free)) {
    await page.goto(`/painel/${id}/configuracoes`);
    for (const [group, value, free, where] of wanted) {
      if (!value || value === free) continue;
      await (where === "poses" ? page.getByRole("button", { name: /^Poses\b/ }) : page.getByRole("button", { name: "Mais", exact: true })).click();
      const dialog = page.getByRole("dialog");
      const btn = dialog.getByRole("group", { name: group }).getByRole("button", { name: value, exact: true });
      await btn.click();
      await expect(btn).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("Escape");
    }
  }
  return { code, id };
}

export async function postViaFile(page: Page, code: string, moment = "O sim") {
  await page.goto(`/e/${code}/postar`);
  await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: moment, exact: true }).click();
  await page.getByRole("button", { name: "Mandar para o laboratório", exact: true }).click();
  await expect(page.getByText("Foi para o laboratório")).toBeVisible();
}

export async function switchPerson(page: Page, code: string, name: string) {
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await page.waitForURL(new RegExp(`/e/${code}$`));
  await enterAsGuest(page, name);
  await page.waitForURL(/postar$/);
  await page.goto(`/e/${code}/agora`);
}


/** Data civil (aaaa-rv-dd) daqui a `days` dias no fuso dado; o fuso do evento é quem manda no convite. */
export function dateIn(tz: string, days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
/** Dia da semana em português de uma data civil aaaa-rv-dd ("domingo", "segunda-feira"). */
export function weekdayOf(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** Entra na tela de convite como um convidado novo (sem entrar na festa ainda). */
export async function openInviteAsGuest(page: Page, code: string) {
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await page.waitForURL(new RegExp(`/e/${code}$`));
}

/** Faz o navegador negar a câmera e dizer que ainda vai perguntar (para ver a pré-permissão e a tela de câmera negada). */
export async function denyCamera(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
    const q = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) => ((d as { name: string }).name === "camera" ? Promise.resolve({ state: "prompt", onchange: null } as PermissionStatus) : q(d));
  });
}
