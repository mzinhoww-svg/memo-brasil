import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { createViaWizard, postViaFile, wizardToSummary } from "./helpers";

// Captura das telas do build PÚBLICO para a revisão visual (CAPTURE=1). Local, sem dados pessoais; não roda no E2E padrão.
test.skip(!process.env.CAPTURE, "defina CAPTURE=1");
const OUT = path.resolve(__dirname, "../../docs/supabase/evidence/a5-r5/screens");
const VIEWS = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } } as const;

for (const [nome, vp] of Object.entries(VIEWS)) {
  test(`telas ${nome}`, async ({ browser }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: vp, permissions: ["camera"] });
    const page = await ctx.newPage();
    const shot = async (id: string) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(OUT, `${nome}-${id}.png`), fullPage: true }); };
    for (const [id, rota] of [["01-landing", "/"], ["02-entrar", "/entrar"], ["03-criar-portao", "/criar"], ["04-termos", "/termos"], ["05-privacidade", "/privacidade"], ["06-404", "/rota-inexistente"], ["07-offline", "/offline"], ["08-master", "/master"]] as const) { await page.goto(rota); await shot(id); }
    await wizardToSummary(page, { capacity: "50" }); await shot("09-wizard-resumo");
    const { code, id } = await createViaWizard(page, { reveal: "desligada" });
    await shot("10-pronto-qr");
    await postViaFile(page, code);
    for (const [rid, rota] of [["11-convite", `/e/${code}`], ["12-agora", `/e/${code}/agora`], ["13-explorar", `/e/${code}/explorar`], ["14-voce", `/e/${code}/voce`], ["15-postar", `/e/${code}/postar`], ["16-retrospectiva", `/e/${code}/retrospectiva`], ["17-painel", `/painel/${id}`], ["18-aparencia", `/painel/${id}/aparencia`], ["19-conteudo", `/painel/${id}/conteudo`], ["20-convidados", `/painel/${id}/convidados`], ["21-momentos", `/painel/${id}/momentos`], ["22-qr", `/painel/${id}/qr`], ["23-downloads", `/painel/${id}/downloads`], ["24-configuracoes", `/painel/${id}/configuracoes`]] as const) { await page.goto(rota); await shot(rid); }
    await ctx.close();
  });
}
