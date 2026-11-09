// Converte as telas HTML de referência (design-system/revela/html) em componentes React com o MESMO markup,
// classes, textos e estilos inline. Ferramenta de partida: o resultado é commitado e depois recebe os dados reais.
// Uso: node scripts/html-to-tsx.mjs [Nome-da-tela ...]   (sem argumentos converte todas; não sobrescreve arquivos existentes sem --force)
import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(root, "design-system", "revela", "html");
const OUT = join(root, "web", "src", "revela", "screens");
const force = process.argv.includes("--force");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const ATTR = { class: "className", for: "htmlFor", tabindex: "tabIndex", maxlength: "maxLength", autocomplete: "autoComplete", inputmode: "inputMode", readonly: "readOnly",
  colspan: "colSpan", rowspan: "rowSpan", playsinline: "playsInline", autoplay: "autoPlay", crossorigin: "crossOrigin", srcset: "srcSet", contenteditable: "contentEditable",
  autofocus: "autoFocus", spellcheck: "spellCheck", enterkeyhint: "enterKeyHint", "xlink:href": "xlinkHref" };
const BOOL = new Set(["disabled", "checked", "readOnly", "autoFocus", "hidden", "muted", "loop", "autoPlay", "playsInline", "required", "multiple", "selected", "controls"]);
const VOID = new Set(["input", "img", "br", "hr", "source", "meta", "link", "col", "area", "base", "embed", "track", "wbr"]);
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const TOK = join(root, "web", "src", "styles", "tokens.css");
const tokText = readFileSync(TOK, "utf8");
const norm = (h) => { h = h.toLowerCase().replace("#", ""); if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join(""); return "#" + h; };
const byVal = new Map();
for (const [, n, v] of tokText.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;/g)) if (!byVal.has(norm(v))) byVal.set(norm(v), n);
const created = new Map();
const tokenize = (v) => v.replace(/#[0-9A-Fa-f]{8}\b|#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3,4}\b/g, (m) => {
  const h = norm(m);
  if (byVal.has(h)) return `var(--${byVal.get(h)})`;
  const name = "k-" + h.slice(1); created.set(name, h); byVal.set(h, name); return `var(--${name})`;
});
const assetUrl = (v) => tokenize(v.replace(/assets\//g, "/revela/ref/"));

function styleObj(css) {
  const parts = []; let depth = 0, cur = "";
  for (const ch of css) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += ch; }
  if (cur.trim()) parts.push(cur);
  const items = [];
  for (const p of parts) {
    const i = p.indexOf(":"); if (i < 0) continue;
    const k = p.slice(0, i).trim(), v = assetUrl(p.slice(i + 1).trim());
    if (!k) continue;
    items.push(`${JSON.stringify(k.startsWith("--") ? k : camel(k.startsWith("-webkit-") ? "Webkit" + k.slice(7) : k))}: ${JSON.stringify(v)}`);
  }
  return `{{ ${items.join(", ")} }}`;
}

function attrs(el) {
  const out = [];
  const tag = el.tagName.toLowerCase();
  for (const a of el.attributes) {
    let name = a.name, val = a.value;
    if (name === "style") { out.push(`style=${styleObj(val)}`); continue; }
    if (name.startsWith("aria-") || name.startsWith("data-")) { out.push(`${name}=${JSON.stringify(val)}`); continue; }
    let n = ATTR[name] ?? (name.includes("-") || name.includes(":") ? camel(name) : name);
    if (tag === "input" && n === "value") n = "defaultValue";
    if (tag === "input" && n === "checked") n = "defaultChecked";
    if (BOOL.has(n)) { out.push(val === "" || val === n || val === "true" ? n : `${n}={${val !== "false"}}`); continue; }
    if (n === "src" || n === "poster" || n === "href") val = assetUrl(val);
    out.push(`${n}=${JSON.stringify(tokenize(val))}`);
  }
  return out.length ? " " + out.join(" ") : "";
}

function walk(node, indent) {
  const pad = "  ".repeat(indent);
  if (node.nodeType === 3) {
    const t = node.textContent;
    if (!t.trim() && /\n/.test(t)) return "";
    if (/^[^\s{}<>&"'\\][^{}<>&"'\\]*[^\s{}<>&"'\\]$|^[^\s{}<>&"'\\]$/.test(t) && !/\s{2,}/.test(t)) return pad + t;
    return pad + `{${JSON.stringify(t)}}`;
  }
  if (node.nodeType !== 1) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "style" || tag === "link" || tag === "script") return "";
  const kids = [...node.childNodes].map((c) => walk(c, indent + 1)).filter((x) => x !== "");
  if (tag === "textarea") return `${pad}<textarea${attrs(node)} defaultValue={${JSON.stringify(node.textContent)}} />`;
  if (VOID.has(tag) || (!kids.length && tag !== "div" && tag !== "span" && tag !== "button" && tag !== "p" && tag !== "i" && tag !== "b")) {
    return VOID.has(tag) || !kids.length ? `${pad}<${tag}${attrs(node)} />` : "";
  }
  if (!kids.length) return `${pad}<${tag}${attrs(node)} />`;
  return `${pad}<${tag}${attrs(node)}>\n${kids.join("\n")}\n${pad}</${tag}>`;
}

const pascal = (f) => f.replace(/\.html$/, "").split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join("");
mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith(".html") && f !== "index.html" && (!only.length || only.includes(f.replace(/\.html$/, ""))));
const index = [];
for (const f of files) {
  const html = readFileSync(join(SRC, f), "utf8");
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const dc = doc.querySelector("x-dc");
  if (!dc) { console.warn("sem <x-dc>:", f); continue; }
  const title = doc.title;
  const name = pascal(f);
  const body = [...dc.childNodes].map((c) => walk(c, 2)).filter((x) => x !== "").join("\n");
  const file = join(OUT, `${name}.tsx`);
  if (!existsSync(file) || force) {
    writeFileSync(file, `/* Gerado de design-system/revela/html/${f} por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function ${name}() {
  return (
    <>
${body}
    </>
  );
}
`);
  }
  index.push({ file: f.replace(/\.html$/, ""), name, title });
}
if (created.size) {
  const add = [...created].map(([n, v]) => `  --${n}: ${v};`).join("\n");
  const marker = "/* --- valores literais da referência Revela (gerado por css-from-reference.py) --- */";
  const i = tokText.indexOf(marker);
  const head = tokText.slice(0, i + marker.length), tail = tokText.slice(i + marker.length);
  writeFileSync(TOK, head + tail.replace(/\n\}\s*$/, "\n" + add + "\n}\n"));
}
console.log(`${index.length} telas convertidas em ${OUT}; ${created.size} tokens novos`);
