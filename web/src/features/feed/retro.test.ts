import { describe, expect, it } from "vitest";
import type { Photo, Reaction } from "@/domain/photo";
import { retroHeadline, retrospective } from "./retro";

const at = (h: number, m = 0, day = 15) => Date.UTC(2027, 2, day, h, m); // UTC
const photo = (id: string, authorId: string, ts: number, moment = "Festa"): Photo => ({ id, eventId: "e", authorId, authorName: authorId.toUpperCase(), createdAt: ts, moment, status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta" });
const opts = { tz: "UTC", shotsPerPerson: 36 };
const labels = (r: ReturnType<typeof retrospective>) => r.bars.map((b) => b.label);
const counts = (r: ReturnType<typeof retrospective>) => r.bars.map((b) => b.n);

describe("retrospectiva", () => {
  const photos = [
    photo("1", "bia", at(21, 2)), photo("2", "bia", at(21, 4), "Primeira dança"), photo("3", "bia", at(21, 8), "Primeira dança"), photo("4", "rafa", at(19, 30)), photo("5", "lu", at(22, 15)),
  ];
  const reactions: Reaction[] = [{ eventId: "e", photoId: "1", authorId: "x", kind: "amei" }, { eventId: "e", photoId: "2", authorId: "x", kind: "uau" }];
  const r = retrospective(photos, reactions, opts);

  it("conta fotógrafos e reações e mostra o pico como faixa de 10 minutos, com a nota do momento dominante", () => {
    expect(r.tiles).toEqual([
      { label: "Fotógrafos", value: "3" },
      { label: "Reações", value: "2" },
      { label: "Pico (10 min)", value: "21:00–21:10", range: true, note: "Primeira dança" },
    ]);
  });
  it("horas contínuas, com as vazias no meio em zero, a mais cheia marcada e proporcional", () => {
    expect(labels(r)).toEqual(["19h", "20h", "21h", "22h", "23h"]);
    expect(counts(r)).toEqual([1, 0, 3, 1, 0]);
    expect(r.bars.map((b) => b.on)).toEqual([false, false, true, false, false]);
    expect(r.bars.map((b) => b.pct)).toEqual([33, 0, 100, 33, 0]);
  });
  it("quem mais fotografou, com o rolo do evento", () => {
    expect(r.shooters[0]).toEqual({ avatar: "B", name: "BIA", n: 3, total: 36 });
    expect(r.shooters).toHaveLength(3);
  });
  it("só conta reações de fotos contadas", () => {
    const x = retrospective(photos.slice(2), reactions, opts);
    expect(x.tiles[1].value).toBe("0");
  });

  it("sem fotos não quebra", () => {
    const e = retrospective([], [], { tz: "UTC", shotsPerPerson: null });
    expect(e.tiles[2].value).toBe("–");
    expect(e.bars).toEqual([]);
    expect(e.shooters).toEqual([]);
  });
  it("uma foto: barra única com vizinhas vazias só para contexto", () => {
    const x = retrospective([photo("1", "a", at(19, 40))], [], opts);
    expect(counts(x)).toEqual([0, 0, 1, 0, 0]);
    expect(x.bars[2]).toMatchObject({ label: "19h", n: 1, pct: 100, on: true });
    expect(x.tiles[2].value).toBe("19:40–19:50");
  });
  it("duas fotos na mesma hora somam na mesma barra", () => {
    const x = retrospective([photo("1", "a", at(19, 5)), photo("2", "b", at(19, 50))], [], opts);
    expect(x.bars.find((b) => b.n > 0)).toMatchObject({ label: "19h", n: 2 });
  });
  it("pct mínimo 8 distingue 1 de 0 quando há uma hora muito mais cheia", () => {
    const many = Array.from({ length: 40 }, (_, i) => photo(`m${i}`, "a", at(20, i % 60)));
    const x = retrospective([...many, photo("s", "b", at(18, 10))], [], opts);
    const one = x.bars.find((b) => b.label === "18h");
    expect(one).toMatchObject({ n: 1, pct: 8 });
    expect(x.bars.find((b) => b.label === "19h")).toMatchObject({ n: 0, pct: 0 });
  });
  it("empate: só a primeira barra mais alta é marcada", () => {
    const x = retrospective([photo("1", "a", at(19)), photo("2", "a", at(20)), photo("3", "b", at(21))], [], opts);
    expect(x.bars.filter((b) => b.on).map((b) => b.label)).toEqual(["19h"]);
  });
  it("empate no pico de 10 minutos fica com a janela mais cedo", () => {
    const x = retrospective([photo("1", "a", at(21, 31)), photo("2", "a", at(20, 12))], [], opts);
    expect(x.tiles[2].value).toBe("20:10–20:20");
  });
  it("sem momento dominante a nota é omitida", () => {
    const x = retrospective([photo("1", "a", at(21, 1), "Festa"), photo("2", "b", at(21, 2), "Bolo")], [], opts);
    expect(x.tiles[2].note).toBeUndefined();
    const y = retrospective([photo("1", "a", at(21, 1), "")], [], opts);
    expect(y.tiles[2].note).toBeUndefined();
  });

  it("dias diferentes e virada de meia-noite: 23h, 0h, 1h contínuas, com o dia na virada", () => {
    const x = retrospective([photo("1", "a", at(23, 10)), photo("2", "a", at(0, 20, 16)), photo("3", "b", at(1, 5, 16))], [], opts);
    expect(labels(x)).toEqual(["22h", "23h", "0h", "1h", "2h"]);
    expect(counts(x)).toEqual([0, 1, 1, 1, 0]);
    expect(x.bars[2].day).toBe("ter"); // 16/mar/2027 é terça
    expect(x.bars[0].day).toBe("seg"); // o primeiro rótulo carrega o dia quando o gráfico cruza a meia-noite
    expect(x.bars[1].day).toBeUndefined();
  });
  it("fotos em dias distantes não colapsam na mesma hora do dia", () => {
    const x = retrospective([photo("1", "a", at(10, 0, 15)), photo("2", "a", at(10, 0, 16))], [], opts);
    expect(x.bars.reduce((a, b) => a + b.n, 0)).toBe(2);
    expect(x.bars.filter((b) => b.n > 0)).toHaveLength(2);
  });

  it("America/Cuiaba (UTC−4): hora e pico no relógio do evento", () => {
    const x = retrospective([photo("1", "a", at(23, 5)), photo("2", "a", at(23, 8)), photo("3", "b", at(1, 20, 16))], [], { tz: "America/Cuiaba", shotsPerPerson: null });
    expect(x.bars.filter((b) => b.n > 0).map((b) => [b.label, b.n])).toEqual([["19h", 2], ["21h", 1]]);
    expect(x.tiles[2].value).toBe("19:00–19:10");
  });
  it("fuso de 30 minutos (Asia/Kolkata, UTC+5:30): 22:00 UTC é 3h30 do dia seguinte", () => {
    const x = retrospective([photo("1", "a", at(22, 10)), photo("2", "a", at(22, 40)), photo("3", "b", at(23, 40))], [], { tz: "Asia/Kolkata", shotsPerPerson: null });
    expect(x.bars.filter((b) => b.n > 0).map((b) => [b.label, b.n])).toEqual([["3h", 1], ["4h", 1], ["5h", 1]]);
    expect(x.tiles[2].value).toBe("03:40–03:50");
    expect(x.bars.find((b) => b.label === "3h")?.n).toBe(1); // 22:10 UTC = 03:40 local; o balde é a hora local
  });

  it("evento longo: mais de 12 horas agrupam em blocos mantendo o rótulo da hora de início", () => {
    const longo = [photo("1", "a", at(8)), photo("2", "a", at(9)), photo("3", "b", at(20)), photo("4", "b", at(23, 59))];
    const x = retrospective(longo, [], opts);
    expect(x.bars.length).toBeLessThanOrEqual(12);
    expect(x.bars.reduce((a, b) => a + b.n, 0)).toBe(4);
    expect(x.bars[0]).toMatchObject({ label: "8h", n: 2, range: "8h às 10h" });
  });
  it("evento de vários dias agrupa em 6 h e marca a virada", () => {
    const x = retrospective([photo("1", "a", at(6)), photo("2", "a", at(6, 0, 17))], [], opts);
    expect(x.bars.length).toBeLessThanOrEqual(12);
    expect(x.bars.some((b) => b.day)).toBe(true);
    expect(x.bars.reduce((a, b) => a + b.n, 0)).toBe(2);
  });

  it("o intervalo fica limitado ao evento (+1 h): relógio errado não estica o gráfico", () => {
    const window = { start: at(18), end: at(22) };
    const x = retrospective([photo("1", "a", at(19)), photo("2", "a", at(21)), photo("3", "b", Date.UTC(2031, 0, 1))], [], { ...opts, window });
    expect(x.bars.length).toBeLessThanOrEqual(12);
    expect(x.bars.reduce((a, b) => a + b.n, 0)).toBe(3);
    expect(labels(x)[labels(x).length - 1]).toBe("23h"); // fim 22h + 1 h de margem
  });
});

describe("título da retrospectiva", () => {
  it("usa artigo e substantivo da categoria", () => {
    expect(retroHeadline("casamento", 418)).toEqual(["O casamento", "em 418 fotos"]);
    expect(retroHeadline("festa", 12)[0]).toBe("A festa");
    expect(retroHeadline("empresa", 12)[0]).toBe("O evento");
    expect(retroHeadline("viagem", 12)[0]).toBe("A viagem");
    expect(retroHeadline("outro", 12)[0]).toBe("O evento");
  });
  it("singular e plural, com milhar", () => {
    expect(retroHeadline("festa", 1)[1]).toBe("em 1 foto");
    expect(retroHeadline("festa", 0)[1]).toBe("em 0 fotos");
    expect(retroHeadline("festa", 1204)[1]).toBe("em 1.204 fotos");
  });
});
