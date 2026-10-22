import { describe, expect, it } from "vitest";
import { cameraPromptWhen, inviteLines, revealDayTime, type InviteFacts } from "./invite-copy";

// quinta 12/11/2026, 08h em Cuiabá (UTC-4)
const NOW = Date.UTC(2026, 10, 12, 12, 0);
const SUNDAY_10H = Date.UTC(2026, 10, 15, 14, 0); // domingo 15/11, 10h em Cuiabá
const base: InviteFacts = { shotsPerPerson: 36, revealStatus: "pendente", revealAt: SUNDAY_10H, timezone: "America/Cuiaba", everyoneSeesAll: true, hostName: "Emy" };

describe("convite em 3 linhas", () => {
  it("fotos, revelação e quem vê, com o dia da semana no fuso do evento", () => {
    expect(inviteLines(base, NOW)).toEqual([
      { head: "Você tem 36 fotos.", tail: "Escolha bem, como num filme." },
      { head: "Revela domingo, 10h.", tail: "Até lá, só Emy pode ver." },
      { head: "Quem vê:", tail: "Emy e quem está na festa." },
    ]);
  });
  it("sem limite, sem revelação e só o anfitrião vê", () => {
    const lines = inviteLines({ ...base, shotsPerPerson: null, revealStatus: "desativada", revealAt: null, everyoneSeesAll: false }, NOW);
    expect(lines[0].head).toBe("Fotos sem limite.");
    expect(lines[1]).toEqual({ head: "As fotos aparecem na hora." });
    expect(lines[2]).toEqual({ head: "Quem vê:", tail: "só Emy." });
  });
  it("uma foto no singular; hoje e amanhã; horário com minutos; data quando passa de uma semana", () => {
    expect(inviteLines({ ...base, shotsPerPerson: 1 }, NOW)[0].head).toBe("Você tem 1 foto.");
    expect(revealDayTime(Date.UTC(2026, 10, 12, 20, 30), "America/Cuiaba", NOW)).toEqual({ day: "hoje", time: "16h30", daysAhead: 0 });
    expect(revealDayTime(Date.UTC(2026, 10, 13, 14, 0), "America/Cuiaba", NOW)).toEqual({ day: "amanhã", time: "10h", daysAhead: 1 });
    expect(revealDayTime(Date.UTC(2026, 10, 28, 14, 0), "America/Cuiaba", NOW)).toEqual({ day: "28/11", time: "10h", daysAhead: 16 });
  });
  it("usa o dia civil do fuso do evento, não o do aparelho", () => {
    // 01h UTC de domingo ainda é sábado à noite em Cuiabá
    expect(revealDayTime(Date.UTC(2026, 10, 15, 1, 0), "America/Cuiaba", NOW)).toEqual({ day: "sábado", time: "21h", daysAhead: 2 });
  });
  it("na espera, o dia seguinte aparece pelo dia da semana", () => {
    expect(revealDayTime(Date.UTC(2026, 10, 13, 14, 0), "America/Cuiaba", NOW, { weekdayForTomorrow: true })).toEqual({ day: "sexta-feira", time: "10h", daysAhead: 1 });
  });
  it("revelação já feita e revelação ao terminar sem data", () => {
    expect(inviteLines({ ...base, revealStatus: "revelada" }, NOW)[1].head).toBe("As fotos já foram reveladas.");
    expect(inviteLines({ ...base, revealAt: null }, NOW)[1]).toEqual({ head: "Revela quando a festa terminar.", tail: "Até lá, só Emy pode ver." });
  });
});

describe("pré-permissão da câmera", () => {
  it("diz quando as fotos aparecem para todos", () => {
    expect(cameraPromptWhen(base, NOW)).toBe("domingo, às 10h");
    expect(cameraPromptWhen({ ...base, revealStatus: "desativada", revealAt: null }, NOW)).toBe("na hora");
    expect(cameraPromptWhen({ ...base, revealAt: null }, NOW)).toBe("quando a festa terminar");
  });
});
