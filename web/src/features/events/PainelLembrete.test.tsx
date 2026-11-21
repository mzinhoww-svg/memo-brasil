import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PainelLembrete, lembreteDoPainel } from "./PainelLembrete";

const TZ = "America/Cuiaba"; // UTC-4
const at = (iso: string) => Date.parse(iso);
const ev = (start: string, hours = 5) => ({ startAt: at(start), durationHours: hours, timezone: TZ });

describe("lembreteDoPainel", () => {
  it("evento longe e sem convidados: próximo passo é o QR nas mesas", () => {
    expect(lembreteDoPainel(ev("2026-12-20T23:00:00Z"), at("2026-12-01T15:00:00Z"), 0)?.kind).toBe("criado");
    expect(lembreteDoPainel(ev("2026-12-20T23:00:00Z"), at("2026-12-01T15:00:00Z"), 3)).toBeNull();
  });
  it("3 e 2 dias antes, pelo dia no fuso do evento", () => {
    expect(lembreteDoPainel(ev("2026-12-20T23:00:00Z"), at("2026-12-17T15:00:00Z"), 5)).toMatchObject({ kind: "faltam", title: "Faltam 3 dias para o evento" });
    expect(lembreteDoPainel(ev("2026-12-20T23:00:00Z"), at("2026-12-18T15:00:00Z"), 5)?.title).toBe("Faltam 2 dias para o evento");
  });
  it("véspera: texto aprovado, com 'sem baixar nada'", () => {
    const l = lembreteDoPainel(ev("2026-12-20T23:00:00Z"), at("2026-12-19T15:00:00Z"), 5)!;
    expect(l.kind).toBe("vespera");
    expect(l.text).toContain("sem baixar nada");
  });
  it("festa começou sem ninguém: avisa; com convidados ou depois do fim: nada", () => {
    expect(lembreteDoPainel(ev("2026-12-20T23:00:00Z"), at("2026-12-21T00:00:00Z"), 0)?.kind).toBe("comecou");
    expect(lembreteDoPainel(ev("2026-12-20T23:00:00Z"), at("2026-12-21T00:00:00Z"), 2)).toBeNull();
    expect(lembreteDoPainel(ev("2026-12-20T23:00:00Z"), at("2026-12-22T00:00:00Z"), 0)).toBeNull();
  });
});

describe("PainelLembrete", () => {
  it("mostra o lembrete e o atalho para o QR", () => {
    render(<PainelLembrete eventId="ev1" lembrete={lembreteDoPainel(ev("2026-12-20T23:00:00Z"), at("2026-12-19T15:00:00Z"), 1)} />);
    expect(screen.getByRole("heading", { name: "Amanhã é o grande dia! 🎉" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver o QR" })).toHaveAttribute("href", "/painel/ev1/qr");
  });
});
