/* Auditoria A2: analisador injetado na página. Só leitura do DOM. */
export const ANALYZE = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true })!;
  const rgba = (c: string): [number, number, number, number] => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "#000";
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    // canvas premultiplica; pedimos alpha pelo texto original quando possível
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const parseAlpha = (c: string) => {
    const m = c.match(/\/\s*([\d.]+%?)\s*\)/) || c.match(/rgba\([^)]*,\s*([\d.]+)\)/);
    if (!m) return c === "transparent" ? 0 : 1;
    return m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  };
  const full = (c: string): [number, number, number, number] => {
    const a = parseAlpha(c);
    if (a === 0) return [0, 0, 0, 0];
    const [r, g, b] = rgba(c.replace(/\/\s*[\d.]+%?\s*\)/, ")"));
    return [r, g, b, a];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: number[], b: number[]) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const over = (top: number[], bot: number[]) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0;
  };
  const bgOf = (el: Element): { color: number[]; image: boolean } => {
    const layers: number[][] = [];
    let image = false;
    let e: Element | null = el;
    while (e) {
      const s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage !== "none") { image = true; }
      const c = full(s.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; }
      e = e.parentElement;
    }
    let base: number[] = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return { color: base, image };
  };
  const opacityChain = (el: Element) => { let o = 1; let e: Element | null = el; while (e) { o *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; } return o; };
  const sel = (el: Element) => { const id = (el as HTMLElement).id ? "#" + (el as HTMLElement).id : ""; const cls = typeof (el as HTMLElement).className === "string" ? "." + (el as HTMLElement).className.trim().split(/\s+/).slice(0, 2).join(".") : ""; return el.tagName.toLowerCase() + id + (cls === "." ? "" : cls); };

  const out: Record<string, unknown> = {};
  const root = getComputedStyle(document.documentElement);
  const recVar = root.getPropertyValue("--rec").trim();
  const recTexto = root.getPropertyValue("--rec-texto").trim();
  const recRgb = rgba(recVar);
  const recTxtRgb = rgba(recTexto);

  // contraste de texto
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const lows: unknown[] = [];
  let textNodes = 0;
  const seen = new Set<Element>();
  const redText: string[] = [];
  const fontOff: string[] = [];
  let serifCount = 0;
  let eventFontCount = 0;
  const serifEls: string[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    const t = (n.textContent || "").trim();
    if (!t) continue;
    const el = n.parentElement!;
    if (!el || seen.has(el) || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName) || !visible(el)) continue;
    seen.add(el);
    textNodes++;
    const s = getComputedStyle(el);
    const fg = full(s.color);
    const { color: bg, image } = bgOf(el);
    const fgc = over([fg[0], fg[1], fg[2], fg[3] * opacityChain(el)], bg);
    const cr = ratio(fgc, bg);
    const size = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (!image && cr < need && el.closest(":disabled,[aria-disabled=true]")) { (out.disabledLow as unknown[]) = [...((out.disabledLow as unknown[]) || []), { text: t.slice(0, 30), ratio: +cr.toFixed(2) }]; } else if (!image && cr < need) lows.push({ el: sel(el), text: t.slice(0, 40), ratio: +cr.toFixed(2), need, fg: s.color, size });
    if (image) (out.textOnImage as unknown[]) = [...((out.textOnImage as unknown[]) || []), { el: sel(el), text: t.slice(0, 30) }];
    const fam = s.fontFamily;
    if (/Instrument Serif/i.test(fam)) { serifCount++; serifEls.push(sel(el) + ":" + t.slice(0, 30)); }
    if (/birthstone|pinyon|vibes|cursive|evento/i.test(fam)) { eventFontCount++; fontOff.push(sel(el) + ":" + t.slice(0, 30) + ":" + fam.slice(0, 40)); }
    const sameAsRec = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 6;
    if (sameAsRec(fg, recRgb) && !sameAsRec(fg, recTxtRgb)) redText.push(sel(el) + ":" + t.slice(0, 30));
    if (sameAsRec(fg, recRgb) && sameAsRec(recRgb, recTxtRgb)) redText.push("(rec-texto) " + sel(el) + ":" + t.slice(0, 30));
  }
  out.textNodes = textNodes;
  out.lowContrastText = lows;
  out.serifCount = serifCount;
  out.serifEls = serifEls;
  out.eventFontEls = fontOff;
  out.redText = redText;

  // famílias não permitidas
  const fams = new Map<string, number>();
  document.querySelectorAll("body *").forEach((el) => { if (!visible(el)) return; const f = getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim(); fams.set(f, (fams.get(f) || 0) + 1); });
  out.fontFamilies = Object.fromEntries(fams);

  // sombras, gradientes, emoji
  const shadows: string[] = [];
  const gradients: string[] = [];
  let recArea = 0;
  document.querySelectorAll("body *").forEach((el) => {
    if (!visible(el)) return;
    const s = getComputedStyle(el);
    if (s.boxShadow && s.boxShadow !== "none") shadows.push(sel(el) + " " + s.boxShadow.slice(0, 60));
    if (s.textShadow && s.textShadow !== "none") shadows.push("text:" + sel(el));
    if (s.filter && /drop-shadow/.test(s.filter)) shadows.push("filter:" + sel(el));
    if (/gradient/.test(s.backgroundImage)) gradients.push(sel(el) + " " + s.backgroundImage.slice(0, 80));
    const bgc = full(s.backgroundColor);
    if (bgc[3] > 0.9 && Math.abs(bgc[0] - recRgb[0]) + Math.abs(bgc[1] - recRgb[1]) + Math.abs(bgc[2] - recRgb[2]) < 6) { const r = el.getBoundingClientRect(); recArea += r.width * r.height; }
  });
  out.shadows = shadows;
  out.gradients = gradients;
  out.recAreaPct = +((recArea / (innerWidth * innerHeight)) * 100).toFixed(2);

  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/u;
  const bodyText = document.body.innerText || "";
  out.emojiInText = bodyText.split("\n").filter((l) => emoji.test(l)).slice(0, 5);
  out.exclamations = bodyText.split("\n").filter((l) => /!/.test(l)).slice(0, 8);
  out.dashes = bodyText.split("\n").filter((l) => /[—–]/.test(l)).slice(0, 8);
  out.text = bodyText.slice(0, 3000);

  // overflow horizontal
  out.overflowX = { scrollWidth: document.documentElement.scrollWidth, innerWidth: innerWidth, bodyScroll: document.body.scrollWidth };
  const overflowing: string[] = [];
  document.querySelectorAll("body *").forEach((el) => { if (!visible(el)) return; const r = el.getBoundingClientRect(); if (r.right > innerWidth + 1 && !el.closest("[style*='overflow']")) overflowing.push(sel(el) + ` right=${Math.round(r.right)}`); });
  out.overflowingEls = overflowing.slice(0, 8);

  // alvos de toque
  const interactive = document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=link], summary, [tabindex]:not([tabindex='-1'])");
  const small: unknown[] = [];
  let total = 0;
  interactive.forEach((el) => {
    if (!visible(el) && !(el instanceof HTMLInputElement && el.type === "file")) return;
    if ((el as HTMLElement).hidden) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1) return;
    total++;
    if (r.height < 44 - 0.5 || r.width < 44 - 0.5) small.push({ el: sel(el), label: ((el.getAttribute("aria-label") || (el as HTMLElement).innerText || (el as HTMLInputElement).value || "") + "").trim().slice(0, 40), w: +r.width.toFixed(1), h: +r.height.toFixed(1), inline: getComputedStyle(el).display === "inline" });
  });
  out.targets = { total, small };

  // contraste não textual: borda de controles e ícones
  const nonText: unknown[] = [];
  document.querySelectorAll("input:not([type=hidden]):not([type=file]), select, textarea, button, [role=tab]").forEach((el) => {
    if (!visible(el) || (el as HTMLButtonElement).disabled) return;
    const s = getComputedStyle(el);
    const bw = parseFloat(s.borderTopWidth);
    if (bw > 0 && s.borderTopStyle !== "none") {
      const b = full(s.borderTopColor);
      const par = bgOf(el.parentElement || el).color;
      const bg = bgOf(el).color;
      const c = ratio(over(b, par), par);
      const own = ratio(over(b, par), bg);
      if (c < 3 && own < 3 && (el.tagName !== "BUTTON" || bw >= 1)) nonText.push({ el: sel(el), kind: "borda", ratio: +c.toFixed(2), bw });
    }
  });
  document.querySelectorAll("svg").forEach((el) => {
    if (!visible(el)) return;
    const s = getComputedStyle(el);
    const col = s.stroke !== "none" && s.stroke ? s.stroke : s.color;
    const f = full(col);
    if (f[3] === 0) return;
    const bg = bgOf(el).color;
    const c = ratio(over(f, bg), bg);
    if (c < 3) nonText.push({ el: sel(el.parentElement || el), kind: "icone", ratio: +c.toFixed(2) });
  });
  out.nonTextContrast = nonText;

  // imagens sem alt
  out.imgNoAlt = Array.from(document.querySelectorAll("img")).filter((i) => !i.hasAttribute("alt")).length;
  out.h1 = Array.from(document.querySelectorAll("h1")).map((h) => h.textContent);
  out.lang = document.documentElement.lang;
  out.theme = document.documentElement.dataset.theme;
  return out;
};
