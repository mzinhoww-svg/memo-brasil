// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { MemoEvent } from "@/domain/event";
import { siteOrigin } from "@/lib/site";
import { printInvite, revealPhrase } from "./invite-print";

const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 20, 15, 0);
const ev = (o: Partial<MemoEvent> = {}): MemoEvent => ({
  id: "e1", code: "ABCD2345", title: "Ana & Rui", category: "casamento", hostId: "h", hostName: "Ana", startAt: NOW + 24 * H, durationHours: 6,
  cameraStyle: "original", revealEnabled: false, revealAt: null, revealAnchor: "fim", revealOffsetDays: 0, revealedAt: null, version: 1, timezone: "America/Cuiaba",
  revealStatus: "desativada", capacity: 50, shotsPerPerson: 24, everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: [], tables: 0, createdAt: NOW, ...o,
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
});
