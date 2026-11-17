import { describe, expect, it } from "vitest";
import { classifyOrigin, normalizePath, parseAgent, refHostOf } from "./classify";

describe("normalizePath", () => {
  it("tira query, hash e barra final", () => {
    expect(normalizePath("/criar/?utm_source=x#topo")).toBe("/criar");
    expect(normalizePath("/")).toBe("/");
  });
  it("esconde código de convite, ids, código de presente e token de descadastro", () => {
    expect(normalizePath("/e/ABCD2345/agora")).toBe("/e/:codigo/agora");
    expect(normalizePath("/e/ABCD2345")).toBe("/e/:codigo");
    expect(normalizePath("/painel/0f8fad5b-d9cb-469f-a165-70867728950e/qr")).toBe("/painel/:id/qr");
    expect(normalizePath("/c/MMT-AAAA-BBBB")).toBe("/c/:codigo");
    expect(normalizePath("/email/sair?token=11111111-1111-4111-8111-111111111111")).toBe("/email/sair");
  });
  it("ignora Master, /dev, /api e rotas internas, e recusa o que não é caminho", () => {
    for (const p of ["/master", "/master/pessoas", "/dev/seed", "/api/acesso", "/_next/x", "/auth/callback"]) expect(normalizePath(p)).toBeNull();
    for (const p of ["https://evil.example/x", "//evil.example", "x", "", undefined as never]) expect(normalizePath(p)).toBeNull();
  });
  it("limita o tamanho e remove caracteres estranhos", () => {
    expect(normalizePath("/a<b>c")).toBe("/abc");
    expect(normalizePath("/" + "a".repeat(300))!.length).toBe(120);
  });
});

describe("classifyOrigin", () => {
  const me = "fotosdocasamento.online";
  it("sem referência nem UTM é Direto", () => expect(classifyOrigin({}, me)).toMatchObject({ source: null, medium: "direto", refHost: null }));
  it("referência do próprio site não conta como origem", () => {
    expect(refHostOf("https://www.fotosdocasamento.online/criar", me)).toBeNull();
    expect(classifyOrigin({ ref: "https://fotosdocasamento.online/" }, me).medium).toBe("direto");
  });
  it("reconhece redes sociais, buscadores e e-mail", () => {
    expect(classifyOrigin({ ref: "https://l.instagram.com/?u=x" }, me)).toMatchObject({ source: "Instagram", medium: "social" });
    expect(classifyOrigin({ ref: "https://api.whatsapp.com/send" }, me)).toMatchObject({ source: "WhatsApp", medium: "social" });
    expect(classifyOrigin({ ref: "https://www.google.com.br/" }, me)).toMatchObject({ source: "Google", medium: "orgânico" });
    expect(classifyOrigin({ ref: "https://mail.google.com/" }, me)).toMatchObject({ source: "E-mail", medium: "e-mail" });
    expect(classifyOrigin({ ref: "https://m.youtube.com/watch" }, me)).toMatchObject({ source: "YouTube", medium: "social" });
  });
  it("outro site vira referência com o host", () => {
    expect(classifyOrigin({ ref: "https://blog.exemplo.com.br/post" }, me)).toMatchObject({ source: "blog.exemplo.com.br", medium: "referência", refHost: "blog.exemplo.com.br" });
  });
  it("UTM tem prioridade e leva a campanha", () => {
    expect(classifyOrigin({ ref: "https://www.google.com/", utm_source: "instagram", utm_medium: "social", utm_campaign: "lancamento" }, me)).toMatchObject({ source: "Instagram", medium: "social", campaign: "lancamento" });
    expect(classifyOrigin({ utm_source: "newsletter", utm_medium: "email" }, me)).toMatchObject({ source: "Newsletter", medium: "e-mail" });
    expect(classifyOrigin({ utm_source: "google", utm_medium: "cpc" }, me)).toMatchObject({ source: "Google", medium: "pago" });
  });
  it("limpa texto perigoso e limita o tamanho dos campos", () => {
    const o = classifyOrigin({ utm_source: "<b>x</b>".repeat(30), utm_campaign: "c".repeat(200) }, me);
    expect(o.source).not.toMatch(/[<>]/);
    expect(o.source!.length).toBeLessThanOrEqual(40);
    expect(o.campaign!.length).toBe(60);
  });
});

describe("parseAgent", () => {
  it("celular, tablet e computador, com navegador e sistema", () => {
    expect(parseAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toMatchObject({ device: "celular", os: "iOS", browser: "Safari", bot: false });
    expect(parseAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toMatchObject({ device: "tablet", os: "iOS" });
    expect(parseAgent("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36")).toMatchObject({ device: "celular", os: "Android", browser: "Chrome" });
    expect(parseAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0")).toMatchObject({ device: "computador", os: "Windows", browser: "Edge" });
  });
  it("robôs e agentes vazios não contam", () => {
    expect(parseAgent("Googlebot/2.1 (+http://www.google.com/bot.html)").bot).toBe(true);
    expect(parseAgent("facebookexternalhit/1.1").bot).toBe(true);
    expect(parseAgent("WhatsApp/2.23").bot).toBe(true);
    expect(parseAgent("").bot).toBe(true);
    expect(parseAgent(null).bot).toBe(true);
  });
});
