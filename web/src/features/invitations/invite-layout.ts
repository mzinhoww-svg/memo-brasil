import type { PrintInvite } from "./invite-print";

/**
 * Diagramação do convite A5 em milímetros, independente do meio: o mesmo resultado vira PDF (pdf-lib) e prévia/impressão (SVG).
 * Origem no canto superior esquerdo do formato final (corte). A sangria fica fora: x/y negativos ou além de 148 × 210.
 */
export const TRIM = { w: 148, h: 210 } as const;
export const BLEED = 3;
/** Margem de segurança: nenhum texto ou QR fica a menos disso do corte. */
export const SAFE = 10;
export const PT = 0.3528; // 1 pt em mm

export type FontId = "bold" | "regular" | "italic";
export type Measure = (text: string, font: FontId, sizePt: number) => number; // largura em mm

export type Prim =
  | { kind: "rect"; x: number; y: number; w: number; h: number; color: string }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; color: string; widthMm: number }
  | { kind: "text"; x: number; y: number; text: string; font: FontId; size: number; color: string; anchor: "start" | "middle"; tracking?: number }
  | { kind: "circle"; cx: number; cy: number; r: number; color: string }
  | { kind: "qr"; x: number; y: number; size: number; modules: boolean[][]; quiet: number; color: string };

export interface InviteLayout { prims: Prim[]; qr: { x: number; y: number; size: number }; fitsSafeArea: boolean }

const INK = "#1C1917";
const MUTED = "#57534E";
const RULE = "#D9D5D1";

/** Quebra em linhas que cabem em `max` mm; palavra maior que a linha é partida por caractere (nomes longos sem espaço não vazam). */
export function wrap(text: string, font: FontId, size: number, max: number, measure: Measure): string[] {
  const lines: string[] = [];
  let cur = "";
  const push = (w: string) => {
    if (measure(w, font, size) <= max) return void (cur = w);
    let piece = "";
    for (const ch of w) {
      if (piece && measure(piece + ch, font, size) > max) { lines.push(piece); piece = ch; } else piece += ch;
    }
    cur = piece;
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next, font, size) <= max) cur = next;
    else { if (cur) lines.push(cur); push(word); }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Maior corpo (pt) em que o título cabe em até `maxLines` linhas. */
function fitTitle(text: string, measure: Measure, width: number): { size: number; lines: string[] } {
  for (const size of [30, 27, 24, 21, 19, 17, 15]) {
    const lines = wrap(text, "bold", size, width, measure);
    if (lines.length <= 3) return { size, lines };
  }
  const lines = wrap(text, "bold", 15, width, measure);
  return { size: 15, lines: lines.length > 4 ? [...lines.slice(0, 3), `${lines[3].replace(/.$/, "")}…`] : lines };
}

export function layoutInvite(inv: PrintInvite, qrModules: boolean[][], measure: Measure): InviteLayout {
  const prims: Prim[] = [];
  const W = TRIM.w, cx = W / 2, width = W - 2 * SAFE;
  const text = (y: number, t: string, font: FontId, size: number, color = INK, tracking?: number) => prims.push({ kind: "text", x: cx, y, text: t, font, size, color, anchor: "middle", tracking });

  // faixa fina na cor do evento, até a borda (por isso estende na sangria); pouca tinta
  prims.push({ kind: "rect", x: -BLEED, y: -BLEED, w: W + 2 * BLEED, h: BLEED + 4, color: inv.accent });

  const title = fitTitle(inv.title, measure, width);
  const titleLead = title.size * PT * 1.08;
  const tagLines = wrap(inv.tagline, "italic", 15, width, measure);
  const tagLead = 15 * PT * 1.2;
  const revealLines = wrap(inv.reveal, "regular", 10.5, width, measure);
  const altLines = wrap(`Sem leitor de QR? Acesse ${inv.altAddress} e digite o código:`, "regular", 9, width, measure);

  // alturas (mm) de cada bloco; o QR cresce até 66 mm com o espaço livre e encolhe até 42 mm se o título ocupar muito
  const titleH = title.lines.length * titleLead, tagH = tagLines.length * tagLead;
  const stepsH = 3 * 5.8 + 5, infoH = 5.2 + revealLines.length * 4.6, codeH = altLines.length * 4 + 9;
  const fixedGaps = 3 + 4 + 4 + 5 + 5; // título→frase, frase→QR, QR→passos, filete, info→código
  const avail = TRIM.h - SAFE - 6 - (SAFE + 4); // da faixa até acima da assinatura
  const rest = titleH + tagH + stepsH + 10 + infoH + codeH + fixedGaps;
  const qrSize = Math.max(42, Math.min(66, avail - rest));
  const extra = Math.max(0, avail - rest - qrSize) / 4; // sobra repartida em 4 respiros, sem buraco no rodapé

  let y = SAFE + 4 + extra / 2;
  for (const l of title.lines) { y += titleLead; text(y - titleLead * 0.22, l, "bold", title.size); }
  y += 3;
  for (const l of tagLines) { y += tagLead; text(y - tagLead * 0.25, l, "italic", 15, MUTED); }
  y += 4 + extra; // a zona de proteção do QR já é branca: pouco respiro externo

  const qrX = cx - qrSize / 2;
  prims.push({ kind: "qr", x: qrX, y, size: qrSize, modules: qrModules, quiet: 4, color: inv.qrColor });
  const qr = { x: qrX, y, size: qrSize };
  y += qrSize + 4;

  // passos numerados: número na cor do evento, recuo fixo, bloco centrado na página
  const stepSize = 11.5, indent = 6;
  const stepW = indent + Math.max(...inv.steps.map((s) => measure(s, "regular", stepSize)));
  const sx = cx - stepW / 2;
  inv.steps.forEach((s, i) => {
    y += 5.8;
    prims.push({ kind: "text", x: sx, y, text: `${i + 1}.`, font: "bold", size: stepSize, color: inv.accent, anchor: "start" });
    prims.push({ kind: "text", x: sx + indent, y, text: s, font: "regular", size: stepSize, color: INK, anchor: "start" });
  });
  y += 5;
  text(y, inv.noApp, "regular", 9.5, MUTED);
  y += 5 + extra / 2;
  prims.push({ kind: "line", x1: cx - 20, y1: y, x2: cx + 20, y2: y, color: RULE, widthMm: 0.3 });
  y += 5 + extra / 2 + 5.2;
  text(y - 1, inv.shots, "bold", 11);
  for (const l of revealLines) { y += 4.6; text(y, l, "regular", 10.5); }
  y += 5 + extra;
  for (const l of altLines) { y += 4; text(y, l, "regular", 9, MUTED); }
  y += 9;
  text(y - 1, inv.code, "bold", 20, INK, 1.2);

  // assinatura discreta: "por ● Revela" no rodapé da área segura
  const sigY = TRIM.h - SAFE;
  const por = measure("por", "regular", 8), brand = measure("Revela", "bold", 8);
  const total = por + 1.2 + 3.2 + 1.2 + brand;
  const sx0 = cx - total / 2;
  prims.push({ kind: "text", x: sx0, y: sigY, text: "por", font: "regular", size: 8, color: MUTED, anchor: "start" });
  prims.push({ kind: "circle", cx: sx0 + por + 1.2 + 1.6, cy: sigY - 1, r: 1.6, color: MUTED });
  prims.push({ kind: "text", x: sx0 + por + 1.2 + 1.6, y: sigY - 0.45, text: "MT", font: "bold", size: 3.6, color: "#FFFFFF", anchor: "middle" });
  prims.push({ kind: "text", x: sx0 + por + 1.2 + 3.2 + 1.2, y: sigY, text: "Revela", font: "bold", size: 8, color: MUTED, anchor: "start" });

  return { prims, qr, fitsSafeArea: y <= sigY - 3 };
}
