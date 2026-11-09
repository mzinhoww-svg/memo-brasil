// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, PDFDict, PDFName } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import type { MemoEvent } from "@/domain/event";
import { siteOrigin } from "@/lib/site";
import { BLEED, SAFE, TRIM } from "./invite-layout";
import { buildInvitePdf, inviteLayout, loadInviteFonts, measureWith, qrMatrix, type InviteFonts } from "./invite-pdf";
import { inviteFileName, printInvite, revealPhrase } from "./invite-print";

const PUBLIC = path.resolve(__dirname, "../../../public");
const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 20, 15, 0);
const ev = (o: Partial<MemoEvent> = {}): MemoEvent => ({
  id: "e1", code: "ABCD2345", title: "Ana & Rui", category: "casamento", hostId: "h", hostName: "Ana", startAt: NOW + 24 * H, durationHours: 6,
  cameraStyle: "original", revealEnabled: false, revealAt: null, revealAnchor: "fim", revealOffsetDays: 0, revealedAt: null, version: 1, timezone: "America/Cuiaba",
  revealStatus: "desativada", capacity: 50, shotsPerPerson: 24, everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: [], tables: 0, createdAt: NOW, ...o,
});
const LONG = "Celebração dos 50 anos de casamento de Maria Aparecida Conceição e José Antônio Albuquerque";

let fonts: InviteFonts;
beforeAll(async () => {
  fonts = await loadInviteFonts(async (p) => new Uint8Array(fs.readFileSync(path.join(PUBLIC, p))));
});

describe("textos do convite impresso", () => {
  it("usa o limite efetivo do evento, sem constantes", () => {
    expect(printInvite(ev({ shotsPerPerson: 36 }), NOW).shots).toBe("Cada pessoa tem 36 fotos.");
    expect(printInvite(ev({ shotsPerPerson: 1 as unknown as 5 /* o servidor aceita 1..1000 */ }), NOW).shots).toBe("Cada pessoa tem 1 foto.");
    expect(printInvite(ev({ shotsPerPerson: null }), NOW).shots).toBe("Fotos sem limite por pessoa.");
  });
  it("revelação por extenso no fuso do evento; sem revelação diz o comportamento real", () => {
    expect(printInvite(ev(), NOW).reveal).toBe("As fotos aparecem para todos na hora.");
    // 25/10/2026 02:00 UTC = sábado 24/10, 22h em Cuiabá (UTC−4)
    const at = Date.UTC(2026, 9, 25, 2, 0);
    expect(printInvite(ev({ revealEnabled: true, revealAt: at, revealStatus: "pendente" }), NOW).reveal).toBe("As fotos aparecem para todos no sábado, 24 de outubro, às 22h.");
    expect(revealPhrase(Date.UTC(2026, 9, 25, 2, 30), "America/Sao_Paulo")).toBe("sábado, 24 de outubro, às 23h30");
    expect(printInvite(ev({ revealEnabled: true, revealAt: Date.UTC(2026, 9, 26, 23, 0), revealStatus: "pendente" }), NOW).reveal).toBe("As fotos aparecem para todos na segunda-feira, 26 de outubro, às 19h.");
    expect(printInvite(ev({ revealEnabled: true, revealAt: null, revealStatus: "pendente" }), NOW).reveal).toBe("As fotos aparecem para todos quando a festa terminar.");
    expect(printInvite(ev({ everyoneSeesAll: false }), NOW).reveal).toBe("As fotos ficam com Ana.");
  });
  it("QR e código levam ao mesmo evento no endereço canônico, mesmo gerado num preview", () => {
    const p = printInvite(ev(), NOW, siteOrigin("https://newmemocuiaba-abc123xyz-equipe.vercel.app"));
    expect(p.qrText).toBe("https://fotosdocasamento.online/e/ABCD2345");
    expect(p.altAddress).toBe("fotosdocasamento.online/entrar");
    expect(p.code).toBe("ABCD2345");
    expect(new URL(p.qrText).pathname.endsWith(`/${p.code}`)).toBe(true);
    for (const bad of ["http://localhost:3000", "https://127.0.0.1", "https://x.vercel.app/?token=1", "nada"]) expect(siteOrigin(bad)).toBe("https://fotosdocasamento.online");
    expect(siteOrigin("https://memoriesmt.com.br")).toBe("https://memoriesmt.com.br");
  });
  it("não promete 'sem cadastro' e não usa fonte manuscrita", () => {
    const p = printInvite(ev(), NOW);
    expect(JSON.stringify(p)).not.toMatch(/sem cadastro/i);
    expect(p.steps).toEqual(["Escaneie o QR Code.", "Entre com seu nome.", "Fotografe e compartilhe."]);
  });
  it("nome de arquivo seguro", () => {
    expect(inviteFileName("Ana & Rui")).toBe("convite-ana-e-rui.pdf");
    expect(inviteFileName("  Festa da Júlia / 2026 ")).toBe("convite-festa-da-julia-2026.pdf");
    expect(inviteFileName("../../")).toBe("convite-evento.pdf");
    expect(inviteFileName(LONG).length).toBeLessThanOrEqual(75);
  });
});

describe("diagramação A5", () => {
  for (const title of ["Ana & Rui", LONG, "Aniversário-da-Maria-Eduarda-Conceição-Albuquerque-Sobrinho", "Ł Ő 🎉 Festa"]) {
    it(`cabe na área segura sem cortes: ${title.slice(0, 30)}`, () => {
      const lay = inviteLayout(printInvite(ev({ title, revealEnabled: true, revealAt: NOW + 30 * H, revealStatus: "pendente" }), NOW), fonts);
      expect(lay.fitsSafeArea).toBe(true);
      const m = measureWith(fonts);
      for (const p of lay.prims) {
        if (p.kind !== "text") continue;
        const w = m(p.text, p.font, p.size) + (p.tracking ?? 0) * p.text.length;
        const x0 = p.anchor === "middle" ? p.x - w / 2 : p.x;
        expect(x0).toBeGreaterThanOrEqual(SAFE - 0.01);
        expect(x0 + w).toBeLessThanOrEqual(TRIM.w - SAFE + 0.01);
        expect(p.y).toBeLessThanOrEqual(TRIM.h - SAFE + 0.01);
      }
      expect(lay.qr.size).toBeGreaterThanOrEqual(42);
      expect(lay.qr.x).toBeGreaterThanOrEqual(SAFE);
    });
  }
  it("QR com módulos de pelo menos 1 mm e zona de proteção de 4 módulos", () => {
    const lay = inviteLayout(printInvite(ev({ title: LONG }), NOW), fonts);
    const n = qrMatrix("https://fotosdocasamento.online/e/ABCD2345").length;
    expect(lay.qr.size / (n + 8)).toBeGreaterThanOrEqual(1);
  });
});

describe("PDF para gráfica", () => {
  it("A5 com sangria de 3 mm, caixas corretas, fontes embutidas e metadados", async () => {
    const bytes = await buildInvitePdf(printInvite(ev(), NOW), fonts, { now: new Date(NOW) });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const page = doc.getPage(0);
    const mm = (v: number) => Math.round((v * 25.4) / 72 * 10) / 10;
    const box = (b: { x: number; y: number; width: number; height: number }) => [mm(b.x), mm(b.y), mm(b.width), mm(b.height)];
    expect(box(page.getMediaBox())).toEqual([0, 0, 154, 216]);
    expect(box(page.getBleedBox())).toEqual([0, 0, 154, 216]);
    expect(box(page.getTrimBox())).toEqual([BLEED, BLEED, 148, 210]);
    expect(doc.getTitle()).toBe("Convite · Ana & Rui");
    // toda fonte usada está embutida (FontFile2 no descritor)
    const fontsUsed = [...doc.context.enumerateIndirectObjects()].map(([, o]) => o).filter((o): o is PDFDict => o instanceof PDFDict && o.get(PDFName.of("Type")) === PDFName.of("FontDescriptor"));
    expect(fontsUsed.length).toBe(3);
    for (const d of fontsUsed) expect(d.has(PDFName.of("FontFile2")) || d.has(PDFName.of("FontFile3"))).toBe(true);
    // as três fontes do Revela: Gloock (títulos), Schibsted Grotesk (texto) e Share Tech Mono (carimbo)
    const names = fontsUsed.map((d) => String(d.get(PDFName.of("FontName")))).join(" ");
    expect(names).toMatch(/Gloock/);
    expect(names).toMatch(/Schibsted/);
    expect(names).toMatch(/ShareTechMono/);
  });

  it("gera os PDFs de exemplo com dados sintéticos (quando INVITE_SAMPLE_DIR está definido)", async () => {
    const dir = process.env.INVITE_SAMPLE_DIR;
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    const samples: [string, MemoEvent][] = [
      ["exemplo-curto", ev({ title: "Ana & Rui", code: "NFVARBQX" })],
      ["exemplo-longo-com-revelacao", ev({ title: LONG, code: "Q7RT4MZP", revealEnabled: true, revealAt: Date.UTC(2026, 9, 25, 2, 0), revealStatus: "pendente", shotsPerPerson: 36, palette: "terracota" })],
      ["exemplo-sem-limite-so-anfitriao", ev({ title: "Festa da Júlia", code: "H2KM9WXC", shotsPerPerson: null, everyoneSeesAll: false, palette: "oceano" })],
    ];
    for (const [name, e] of samples) fs.writeFileSync(path.join(dir, `${name}.pdf`), await buildInvitePdf(printInvite(e, NOW), fonts, { now: new Date(NOW) }));
  });
});
