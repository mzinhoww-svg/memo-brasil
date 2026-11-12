// @vitest-environment jsdom
/* Fidelidade das telas M26, M27 e M28 (e variantes) ao HTML de referência: mesmas tags, classes e textos, na mesma ordem.
   Ignora o que não se vê: style, aria-*, valor dos campos e o miolo dos <svg>. */
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { COMPONENTS } from "./index";

afterEach(cleanup);
const HTML = resolve(process.cwd(), "../design-system/revela/master/html");
const ref = (name: string) => new DOMParser().parseFromString(readFileSync(resolve(HTML, `${name}.html`), "utf8"), "text/html");

function sig(el: Element, out: string[] = [], depth = 0): string[] {
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "style" || tag === "script") return out;
  const cls = [...el.classList].filter((c) => c !== "rv-rise").sort().join("."); // rv-rise = entrada animada dos cartões (convenção do master-kit)
  out.push(`${"  ".repeat(depth)}${tag}${cls ? "." + cls : ""}`);
  if (tag === "svg" || tag === "textarea") return out;
  let text = "";
  const flush = () => { const t = text.replace(/\s+/g, " ").trim(); if (t) out.push(`${"  ".repeat(depth + 1)}"${t}"`); text = ""; };
  for (const n of el.childNodes) {
    if (n.nodeType === 3) text += n.textContent ?? "";
    else if (n.nodeType === 1) { flush(); sig(n as Element, out, depth + 1); }
  }
  flush();
  return out;
}
/** O miolo da tela: tudo em `.mmain` menos a barra de cima (`.mtop`). */
const body = (root: ParentNode) => [...root.querySelector(".mmain")!.children].filter((c) => !c.classList.contains("mtop")).flatMap((c) => sig(c));

const SCREENS = [
  "Master-moderacao-motivos", "Master-moderacao-motivos--comentarios", "Master-moderacao-motivos--folha-esconder", "Master-moderacao-motivos--vazio",
  "Master-moderacao-motivos--erro", "Master-moderacao-motivos--sem-permissao", "Master-moderacao-motivos--carregando",
  "Master-saude-completa", "Master-saude-completa--vazio", "Master-saude-completa--erro", "Master-saude-completa--sem-permissao", "Master-saude-completa--carregando",
  "Master-auditoria-filtros", "Master-auditoria-filtros--vazio", "Master-auditoria-filtros--erro", "Master-auditoria-filtros--sem-permissao", "Master-auditoria-filtros--carregando",
];

describe("M26, M27 e M28 = HTML de referência", () => {
  it.each(SCREENS)("%s", (name) => {
    const C = COMPONENTS[name] as () => ReactElement;
    const { container } = render(<C />);
    expect(body(container)).toEqual(body(ref(name)));
  });
  it("a barra de cima é a mesma das outras telas do Master", () => {
    const C = COMPONENTS["Master-saude-completa"] as () => ReactElement;
    const { container } = render(<C />);
    expect(sig(container.querySelector(".mtop")!)).toEqual(sig(ref("Master-saude-completa").querySelector(".mtop")!));
  });
});
