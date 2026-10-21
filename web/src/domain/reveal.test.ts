import { describe, expect, it } from "vitest";
import type { MemoEvent } from "./event";
import {
  canEditReveal, computeRevealStatus, epochToZoned, formatCountdown, formatInZone, migrateLegacyReveal, validateRevealInput, zonedToEpoch,
} from "./reveal";
import { can, type Actor } from "./roles";

const H = 3_600_000;
const D = 24 * H;
const ev = (o: Partial<MemoEvent> = {}): MemoEvent => ({
  id: "e", code: "AAAAAAAA", title: "Emy e Igor", category: "casamento", hostId: "host", hostName: "Emy", startAt: 0, durationHours: 6,
  cameraStyle: "original", revealEnabled: true, revealAt: 10 * H, revealAnchor: "fim", revealOffsetDays: 0, revealedAt: null, timezone: "America/Cuiaba", revealStatus: "pendente", capacity: 50,
  shotsPerPerson: 24, everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: [], tables: 0, createdAt: 0, ...o,
});

describe("fuso horário", () => {
  it("converte hora de parede no fuso para UTC (Cuiabá −4, São Paulo −3, UTC, Lisboa com horário de verão)", () => {
    expect(zonedToEpoch("2026-12-12", "21:40", "America/Cuiaba")).toBe(Date.UTC(2026, 11, 13, 1, 40));
    expect(zonedToEpoch("2026-12-12", "21:40", "America/Sao_Paulo")).toBe(Date.UTC(2026, 11, 13, 0, 40));
    expect(zonedToEpoch("2026-12-12", "21:40", "UTC")).toBe(Date.UTC(2026, 11, 12, 21, 40));
    expect(zonedToEpoch("2026-07-01", "12:00", "Europe/Lisbon")).toBe(Date.UTC(2026, 6, 1, 11, 0)); // verão: UTC+1
    expect(zonedToEpoch("2026-01-01", "12:00", "Europe/Lisbon")).toBe(Date.UTC(2026, 0, 1, 12, 0)); // inverno: UTC+0
  });
  it("o mesmo horário de parede em fusos diferentes são instantes diferentes", () => {
    expect(zonedToEpoch("2026-12-12", "21:40", "America/Cuiaba")).toBeGreaterThan(zonedToEpoch("2026-12-12", "21:40", "America/Sao_Paulo"));
  });
  it("ida e volta e formatação no padrão do kit", () => {
    const at = zonedToEpoch("2026-12-12", "21:40", "America/Cuiaba");
    expect(epochToZoned(at, "America/Cuiaba")).toEqual({ date: "2026-12-12", time: "21:40" });
    expect(formatInZone(at, "America/Cuiaba")).toEqual({ date: "12 · 12 · 2026", time: "21h40" });
    expect(formatInZone(at, "America/Sao_Paulo").time).toBe("22h40");
  });
  it("rejeita data, hora e fuso inválidos", () => {
    expect(zonedToEpoch("2026-02-31", "10:00", "UTC")).toBeNaN();
    expect(zonedToEpoch("2026-12-12", "25:00", "UTC")).toBeNaN();
    expect(zonedToEpoch("12/12/2026", "10:00", "UTC")).toBeNaN();
    expect(zonedToEpoch("2026-12-12", "10:00", "Marte/Olimpo")).toBeNaN();
  });
});

describe("estado da revelação", () => {
  it("desativada = visível na hora; pendente até revealAt; revelada em revealAt (fronteira)", () => {
    expect(computeRevealStatus({ revealEnabled: false, revealAt: null }, 0)).toBe("desativada");
    expect(computeRevealStatus({ revealEnabled: true, revealAt: 100 }, 99)).toBe("pendente");
    expect(computeRevealStatus({ revealEnabled: true, revealAt: 100 }, 100)).toBe("revelada");
    expect(computeRevealStatus({ revealEnabled: true, revealAt: null }, 1e15)).toBe("pendente");
  });
  it("horário já ultrapassado ao abrir o app: revelada sem precisar de timer", () => {
    expect(computeRevealStatus({ revealEnabled: true, revealAt: 5 * H }, 50 * H)).toBe("revelada");
  });
});

describe("validação e edição", () => {
  const now = Date.UTC(2026, 11, 12, 12, 0);
  it("exige data futura a pelo menos 1 minuto", () => {
    expect(validateRevealInput({ date: "2026-12-12", time: "08:00", timezone: "America/Cuiaba" }, now).errors).toEqual({ data: "passado" });
    expect(validateRevealInput({ date: "2026-12-12", time: "08:00", timezone: "Nada/Nada" }, now).errors).toEqual({ fuso: "invalido" });
    expect(validateRevealInput({ date: "", time: "", timezone: "UTC" }, now).errors).toEqual({ data: "invalida" });
    const ok = validateRevealInput({ date: "2026-12-13", time: "08:00", timezone: "UTC" }, now);
    expect(ok.errors).toEqual({});
    expect(ok.at).toBe(Date.UTC(2026, 11, 13, 8, 0));
  });
  it("depois de revelada não dá para alterar; ligar a revelação com fotos já visíveis também não", () => {
    expect(canEditReveal(ev(), 3, 5 * H, true)).toEqual({ ok: true });
    expect(canEditReveal(ev(), 3, 10 * H, false)).toEqual({ ok: false, reason: "ja-revelada" });
    expect(canEditReveal(ev({ revealEnabled: false, revealAt: null }), 3, 5 * H, true)).toEqual({ ok: false, reason: "fotos-ja-visiveis" });
    expect(canEditReveal(ev({ revealEnabled: false, revealAt: null }), 0, 5 * H, true)).toEqual({ ok: true });
  });
});

describe("contagem regressiva", () => {
  it("formata dias, horas, minutos e segundos sem negativos", () => {
    expect(formatCountdown(2 * D + 3 * H + 12 * 60_000 + 5000).text).toBe("2 d 03h 12min 05s");
    expect(formatCountdown(65_000).text).toBe("00h 01min 05s");
    expect(formatCountdown(-5000).text).toBe("00h 00min 00s");
  });
});

describe("migração do modelo antigo", () => {
  const old = { startAt: 0, durationHours: 6, hostId: "h" };
  it("durante → desativada; ao terminar → fim; depois → fim + N dias; respeita encerramento manual", () => {
    expect(migrateLegacyReveal({ ...old, revealTiming: "durante" as const }, 0, "UTC")).toMatchObject({ revealEnabled: false, revealAt: null, revealStatus: "desativada", timezone: "UTC" });
    expect(migrateLegacyReveal({ ...old, revealTiming: "ao-terminar" as const }, 0, "UTC")).toMatchObject({ revealEnabled: true, revealAt: 6 * H, revealStatus: "pendente" });
    expect(migrateLegacyReveal({ ...old, revealTiming: "depois" as const, revealDelayDays: 2 }, 0, "UTC")).toMatchObject({ revealAt: 6 * H + 2 * D });
    expect(migrateLegacyReveal({ ...old, endedAt: 2 * H, revealTiming: "ao-terminar" as const }, 3 * H, "UTC")).toMatchObject({ revealAt: 2 * H, revealStatus: "revelada" });
    expect("revealTiming" in migrateLegacyReveal({ ...old, revealTiming: "durante" as const }, 0, "UTC")).toBe(false);
  });
  it("é idempotente em eventos já migrados", () => {
    const once = migrateLegacyReveal({ ...old, revealEnabled: true, revealAt: 9 * H, timezone: "UTC" } as never, 0, "America/Cuiaba");
    expect(once).toMatchObject({ revealEnabled: true, revealAt: 9 * H, timezone: "UTC" });
  });
});

describe("papéis (contrato, não segurança)", () => {
  const owner: Actor = { userId: "host", role: "organizador" };
  const other: Actor = { userId: "x", role: "organizador" };
  const master: Actor = { userId: "m", role: "master" };
  const guest: Actor = { userId: "g", role: "convidado" };
  it("organizador administra só os próprios eventos", () => {
    for (const a of ["event.configure", "reveal.configure", "photo.moderate", "event.delete"] as const) {
      expect(can(owner, a, ev())).toBe(true);
      expect(can(other, a, ev())).toBe(false);
      expect(can(guest, a, ev())).toBe(false);
    }
  });
  it("só master supervisiona a plataforma; ninguém vira master pelo cliente", () => {
    expect(can(master, "platform.supervise")).toBe(true);
    expect(can(owner, "platform.supervise")).toBe(false);
    expect(can(master, "reveal.configure", ev())).toBe(true);
  });
});

import { inferRevealAnchor, syncRevealWithEnd } from "./reveal";

describe("BG-101: âncora da revelação", () => {
  const base = { startAt: 0, durationHours: 6 };
  it("infere âncora de eventos já salvos pela distância ao fim", () => {
    expect(inferRevealAnchor({ ...base, revealEnabled: true, revealAt: 6 * H })).toEqual({ revealAnchor: "fim", revealOffsetDays: 0 });
    expect(inferRevealAnchor({ ...base, revealEnabled: true, revealAt: 6 * H + 2 * D })).toEqual({ revealAnchor: "fim", revealOffsetDays: 2 });
    expect(inferRevealAnchor({ ...base, revealEnabled: true, revealAt: 6 * H + 90 * 60_000 })).toEqual({ revealAnchor: "data", revealOffsetDays: 0 });
    expect(inferRevealAnchor({ ...base, revealEnabled: true, revealAt: 5 * H })).toEqual({ revealAnchor: "data", revealOffsetDays: 0 });
    expect(inferRevealAnchor({ ...base, revealEnabled: false, revealAt: null })).toEqual({ revealAnchor: "data", revealOffsetDays: 0 });
  });
  it("não mexe na revelação já ocorrida nem em âncora 'data'", () => {
    const e = ev({ revealAnchor: "fim", revealOffsetDays: 0, revealAt: 6 * H });
    expect(syncRevealWithEnd({ ...e, durationHours: 30 }, 5 * H).revealAt).toBe(30 * H);
    expect(syncRevealWithEnd({ ...e, durationHours: 30 }, 7 * H).revealAt).toBe(6 * H); // já revelada: fica
    expect(syncRevealWithEnd({ ...ev({ revealAnchor: "data", revealAt: 9 * H }), durationHours: 30 }, 0).revealAt).toBe(9 * H);
  });
});

describe("BG-102: 'revelada' é monotônica (revealedAt persistido)", () => {
  const pend = ev({ revealEnabled: true, revealAt: 10 * H });
  it("depois de observada, o relógio recuado não reesconde as fotos", () => {
    const seen = { ...pend, revealedAt: 10 * H };
    expect(computeRevealStatus(seen, 5 * H)).toBe("revelada");
    expect(computeRevealStatus(seen, 0)).toBe("revelada");
    expect(computeRevealStatus(pend, 5 * H)).toBe("pendente"); // sem registro, vale o relógio
  });
  it("e a edição continua travada com o relógio recuado", () => {
    expect(canEditReveal({ ...pend, revealedAt: 10 * H }, 3, 2 * H, false)).toEqual({ ok: false, reason: "ja-revelada" });
  });
  it("revealedAt sem revelação ligada é ignorado", () => {
    expect(computeRevealStatus({ revealEnabled: false, revealAt: null, revealedAt: 5 }, 0)).toBe("desativada");
  });
});
