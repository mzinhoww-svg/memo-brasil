import { describe, expect, it } from "vitest";
import { siteOrigin } from "@/lib/site";
import robots from "./robots";
import sitemap from "./sitemap";

describe("SEO: robots e sitemap", () => {
  it("robots libera as páginas públicas e fecha o app (painel, master, convidado, API)", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(["/painel", "/master", "/e/", "/api", "/conta", "/eventos", "/criar", "/dev", "/auth"]);
    expect(r.sitemap).toBe(`${siteOrigin()}/sitemap.xml`);
  });
  it("sitemap lista as páginas públicas no domínio canônico, home com prioridade máxima", () => {
    const s = sitemap();
    expect(s.map((e) => e.url)).toEqual(["/", "/precos", "/ajuda", "/privacidade", "/termos"].map((p) => `${siteOrigin()}${p === "/" ? "" : p}`));
    expect(s[0].priority).toBe(1);
  });
});
