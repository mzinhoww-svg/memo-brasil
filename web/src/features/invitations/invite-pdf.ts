import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, setCharacterSpacing, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { BLEED, TRIM, layoutInvite, type FontId, type InviteLayout, type Measure } from "./invite-layout";
import type { PrintInvite } from "./invite-print";

/** Fontes estáticas (SIL OFL 1.1, licenças em /fonts/pdf) embutidas no PDF; as mesmas métricas diagramam a prévia. */
export const FONT_FILES: Record<FontId, string> = {
  bold: "/fonts/pdf/BricolageGrotesque-ExtraBold.woff",
  regular: "/fonts/pdf/BricolageGrotesque-Regular.woff",
  italic: "/fonts/pdf/InstrumentSerif-Italic.woff",
};

interface KitFont { unitsPerEm: number; layout(t: string): { advanceWidth: number }; hasGlyphForCodePoint(cp: number): boolean }
export interface InviteFonts { bytes: Record<FontId, Uint8Array>; kit: Record<FontId, KitFont> }

export async function loadInviteFonts(read: (path: string) => Promise<Uint8Array>): Promise<InviteFonts> {
  const ids = Object.keys(FONT_FILES) as FontId[];
  const bytes = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await read(FONT_FILES[id])]))) as Record<FontId, Uint8Array>;
  const kit = Object.fromEntries(ids.map((id) => [id, fontkit.create(bytes[id] as unknown as Buffer) as unknown as KitFont])) as Record<FontId, KitFont>;
  return { bytes, kit };
}

/** Caractere sem glifo na fonte vira a letra-base sem acento (ou some), para nunca imprimir um quadrado vazio. */
export function printable(text: string, f: KitFont): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 32 || f.hasGlyphForCodePoint(cp)) { out += ch; continue; }
    const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    out += [...base].filter((c) => f.hasGlyphForCodePoint(c.codePointAt(0)!)).join("");
  }
  return out.replace(/\s+/g, " ").trim();
}

export function measureWith(fonts: InviteFonts): Measure {
  return (text, font, size) => {
    const f = fonts.kit[font];
    return (f.layout(printable(text, f)).advanceWidth / f.unitsPerEm) * size * 0.3528;
  };
}

/** Matriz do QR (nível M); `true` = módulo escuro. Desenhado como vetor, nunca como imagem. */
export function qrMatrix(text: string): boolean[][] {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  return Array.from({ length: modules.size }, (_, r) => Array.from({ length: modules.size }, (_, c) => Boolean(modules.get(r, c))));
}

export function inviteLayout(inv: PrintInvite, fonts: InviteFonts): InviteLayout {
  const clean: PrintInvite = { ...inv, title: printable(inv.title, fonts.kit.bold) || "Seu evento" };
  return layoutInvite(clean, qrMatrix(inv.qrText), measureWith(fonts));
}

const MM = 72 / 25.4;
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/**
 * PDF de uma página A5 para gráfica: arquivo 154 × 216 mm (MediaBox = BleedBox, com 3 mm de sangria) e TrimBox 148 × 210 mm.
 * Texto e QR vetoriais, fontes embutidas (subconjunto). Cores em RGB do dispositivo, sem perfil ICC: não é PDF/X nem CMYK.
 */
export async function buildInvitePdf(inv: PrintInvite, fonts: InviteFonts, opts: { now?: Date } = {}): Promise<Uint8Array> {
  const lay = inviteLayout(inv, fonts);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const pdfFonts = {} as Record<FontId, PDFFont>;
  for (const id of Object.keys(FONT_FILES) as FontId[]) pdfFonts[id] = await doc.embedFont(fonts.bytes[id], { subset: true });

  const fullW = (TRIM.w + 2 * BLEED) * MM, fullH = (TRIM.h + 2 * BLEED) * MM;
  const page: PDFPage = doc.addPage([fullW, fullH]);
  page.setMediaBox(0, 0, fullW, fullH);
  page.setBleedBox(0, 0, fullW, fullH);
  page.setTrimBox(BLEED * MM, BLEED * MM, TRIM.w * MM, TRIM.h * MM);
  page.setArtBox(BLEED * MM, BLEED * MM, TRIM.w * MM, TRIM.h * MM);
  // mm do layout (origem no canto superior esquerdo do corte) → pontos PDF (origem embaixo, na sangria)
  const X = (x: number) => (x + BLEED) * MM;
  const Y = (y: number) => fullH - (y + BLEED) * MM;

  for (const p of lay.prims) {
    if (p.kind === "rect") page.drawRectangle({ x: X(p.x), y: Y(p.y + p.h), width: p.w * MM, height: p.h * MM, color: hex(p.color) });
    else if (p.kind === "line") page.drawLine({ start: { x: X(p.x1), y: Y(p.y1) }, end: { x: X(p.x2), y: Y(p.y2) }, thickness: p.widthMm * MM, color: hex(p.color) });
    else if (p.kind === "circle") page.drawCircle({ x: X(p.cx), y: Y(p.cy), size: p.r * MM, color: hex(p.color) });
    else if (p.kind === "text") {
      const font = pdfFonts[p.font];
      const t = printable(p.text, fonts.kit[p.font]);
      const track = (p.tracking ?? 0) * MM;
      const w = font.widthOfTextAtSize(t, p.size) + track * Math.max(0, [...t].length - 1);
      const x = p.anchor === "middle" ? X(p.x) - w / 2 : X(p.x);
      if (track) page.pushOperators(setCharacterSpacing(track));
      page.drawText(t, { x, y: Y(p.y), size: p.size, font, color: hex(p.color) });
      if (track) page.pushOperators(setCharacterSpacing(0));
    } else {
      // área de proteção branca explícita (o papel pode não ser branco) + módulos como retângulos
      page.drawRectangle({ x: X(p.x), y: Y(p.y + p.size), width: p.size * MM, height: p.size * MM, color: rgb(1, 1, 1) });
      const n = p.modules.length, cell = p.size / (n + 2 * p.quiet);
      p.modules.forEach((row, r) => {
        let c = 0;
        while (c < n) {
          if (!row[c]) { c++; continue; }
          let end = c;
          while (end + 1 < n && row[end + 1]) end++;
          const x = p.x + (p.quiet + c) * cell, y = p.y + (p.quiet + r) * cell;
          // leve sobreposição evita filetes brancos entre módulos no RIP
          page.drawRectangle({ x: X(x), y: Y(y + cell) - 0.02, width: (end - c + 1) * cell * MM + 0.02, height: cell * MM + 0.04, color: hex(p.color) });
          c = end + 1;
        }
      });
    }
  }

  doc.setTitle(`Convite · ${inv.title}`);
  doc.setAuthor("Revela");
  doc.setSubject(`Convite A5 (148 × 210 mm) com sangria de 3 mm. Código ${inv.code}.`);
  doc.setCreator("Revela");
  doc.setProducer("Revela (pdf-lib)");
  doc.setLanguage("pt-BR");
  const now = opts.now ?? new Date();
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  return doc.save();
}
