import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/event-theme/contrast";
import { CAPACITY_OPTIONS, SHOTS_OPTIONS } from "./options";
import { canEditEnd, canJoin, endAt, eventStatus, isRevealed, retrospectiveOpen, revealAt, shotsLeft, validateDraft, type MemoEvent } from "./event";
import { SHARE_CODE_ALPHABET, extractShareCode, generateShareCode, normalizeShareCode } from "./share-code";
import { canPost, hide, moderationQueue, remove, report, setReaction, visiblePhotos, type Photo, type Reaction } from "./photo";

const H = 3600000;
const D = 24 * H;
const base: MemoEvent = {
  id: "e1", code: "NFVARBQX", title: "Emy e Igor", category: "casamento", hostId: "h1", hostName: "Emy",
  startAt: 1_000_000, durationHours: 6, cameraStyle: "original", revealEnabled: true, revealAt: 6 * 3_600_000, revealAnchor: "fim", revealOffsetDays: 0, revealedAt: null, version: 1, timezone: "America/Cuiaba", revealStatus: "pendente",
  capacity: 50, shotsPerPerson: 24, everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone",
  place: "Chalés Taíba, CE", moments: ["O sim", "Pôr do sol"], tables: 10, createdAt: 1_000_000,
};

describe("código de convite", () => {
  it("usa o alfabeto sem 0, O, 1, I, L e tem 8 caracteres", () => {
    expect(SHARE_CODE_ALPHABET).toBe("23456789ABCDEFGHJKMNPQRSTUVWXYZ");
    for (let i = 0; i < 200; i++) expect(generateShareCode()).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });
  it("é determinístico com rng injetado", () => {
    expect(generateShareCode(() => 0)).toBe("22222222");
  });
  it("normaliza maiúsculas, espaços e hífens", () => {
    expect(normalizeShareCode(" nfv-arbqx ")).toBe("NFVARBQX");
  });
  it("rejeita tamanho errado e caracteres ambíguos", () => {
    expect(normalizeShareCode("NFVARBQ")).toBeNull();
    expect(normalizeShareCode("NFVARBQ0")).toBeNull();
    expect(normalizeShareCode("NFVARBQL")).toBeNull();
    expect(normalizeShareCode("")).toBeNull();
  });
  it("extrai o código de links", () => {
    expect(extractShareCode("https://memoriesmt.app/e/nfvarbqx")).toBe("NFVARBQX");
    expect(extractShareCode("/e/NFVARBQX/agora")).toBe("NFVARBQX");
    expect(extractShareCode("nfvarbqx")).toBe("NFVARBQX");
    expect(extractShareCode("https://exemplo.com/lixo")).toBeNull();
  });
});

describe("tempo do evento", () => {
  it("fim = início + duração em horas", () => {
    expect(endAt(base)).toBe(1_000_000 + 6 * H);
  });
  it("encerramento manual antecipa o fim", () => {
    expect(endAt({ ...base, endedAt: 1_000_000 + H })).toBe(1_000_000 + H);
  });
  it("fronteira: em endAt o evento já está encerrado", () => {
    expect(eventStatus(base, endAt(base) - 1)).toBe("ativo");
    expect(eventStatus(base, endAt(base))).toBe("encerrado");
  });
  it("revelação: desligada = visível desde o início; ligada = no horário configurado", () => {
    expect(revealAt({ ...base, revealEnabled: false, revealAt: null })).toBe(base.startAt);
    expect(revealAt(base)).toBe(base.revealAt);
    expect(isRevealed(base, base.revealAt! - 1)).toBe(false);
    expect(isRevealed(base, base.revealAt!)).toBe(true);
    expect(isRevealed({ ...base, revealEnabled: false, revealAt: null }, base.startAt)).toBe(true);
  });
  it("rolo: ilimitado é null; senão desconta usadas sem ficar negativo", () => {
    expect(shotsLeft({ ...base, shotsPerPerson: null }, 99)).toBeNull();
    expect(shotsLeft(base, 4)).toBe(20);
    expect(shotsLeft(base, 30)).toBe(0);
  });
  it("não reabre álbum encerrado com fotos", () => {
    const after = endAt(base) + 1;
    expect(canEditEnd(base, 3, after)).toBe(false);
    expect(canEditEnd(base, 0, after)).toBe(true);
    expect(canEditEnd(base, 3, after - 10)).toBe(true);
  });
});

describe("entrada no evento", () => {
  it("bloqueia encerrado e lotado, libera quem já é membro", () => {
    expect(canJoin(base, 10, base.startAt + H, false)).toEqual({ ok: true });
    expect(canJoin(base, 50, base.startAt + H, false)).toEqual({ ok: false, reason: "lotado" });
    expect(canJoin(base, 50, base.startAt + H, true)).toEqual({ ok: true });
    expect(canJoin(base, 1, endAt(base), false)).toEqual({ ok: false, reason: "encerrado" });
    expect(canJoin({ ...base, capacity: null }, 9999, base.startAt, false)).toEqual({ ok: true });
  });
});

describe("opções", () => {
  it("expõe as opções confirmadas pelo REA", () => {
    expect(CAPACITY_OPTIONS).toEqual([5, 10, 20, 50, 100, 150, 200, null]);
    expect(SHOTS_OPTIONS).toEqual([5, 10, 16, 24, 36, null]);
  });
});

describe("rascunho de evento", () => {
  const now = 5_000_000;
  const ok = { title: "Nossa festa", startAt: now, durationHours: 1 };
  it("exige nome e término a pelo menos 30 minutos", () => {
    expect(validateDraft(ok, now)).toEqual({});
    expect(validateDraft({ ...ok, title: "  " }, now)).toEqual({ title: "obrigatorio" });
    expect(validateDraft({ ...ok, durationHours: 0.4 }, now)).toEqual({ termino: "curto" });
    expect(validateDraft({ ...ok, durationHours: 0.5 }, now)).toEqual({});
  });
});

describe("contraste", () => {
  it("calcula WCAG", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFFFFF", "#1C1917")).toBeGreaterThan(15);
    expect(contrastRatio("#AAB4A2", "#FFFFFF")).toBeCloseTo(2.2, 1);
  });
});

const ph = (o: Partial<Photo>): Photo => ({ id: "p", eventId: "e1", authorId: "a", authorName: "Ana", createdAt: 1, moment: "O sim", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta", ...o });

const T = (authorId: string) => ({ eventId: "e1", photoId: "p1", authorId });
describe("postar e reagir", () => {
  it("bloqueia rolo esgotado e evento encerrado", () => {
    expect(canPost(base, 23, base.startAt + 1)).toEqual({ ok: true });
    expect(canPost(base, 24, base.startAt + 1)).toEqual({ ok: false, reason: "rolo" });
    expect(canPost(base, 0, endAt(base))).toEqual({ ok: false, reason: "encerrado" });
    expect(canPost({ ...base, shotsPerPerson: null }, 500, base.startAt)).toEqual({ ok: true });
  });
  it("uma reação por autor e foto; mesma reação desfaz; outra troca", () => {
    let r: Reaction[] = [];
    r = setReaction(r, T("u1"), "amei");
    r = setReaction(r, T("u1"), "uau");
    expect(r).toEqual([{ eventId: "e1", photoId: "p1", authorId: "u1", kind: "uau" }]);
    r = setReaction(r, T("u2"), "amei");
    expect(r).toHaveLength(2);
    r = setReaction(r, T("u1"), "uau");
    expect(r).toEqual([{ eventId: "e1", photoId: "p1", authorId: "u2", kind: "amei" }]);
  });
});

describe("visibilidade e moderação", () => {
  const mine = ph({ id: "m", authorId: "me" });
  const other = ph({ id: "o", authorId: "x" });
  const hidden = ph({ id: "h", authorId: "x", status: "oculta" });
  const gone = ph({ id: "g", authorId: "x", status: "removida" });
  const all = [mine, other, hidden, gone];
  const viewer = { id: "me", host: false };
  it("antes da revelação o convidado não vê nenhuma foto, nem as próprias (câmera descartável)", () => {
    expect(visiblePhotos(base, all, viewer, base.startAt + H).map((p) => p.id)).toEqual([]);
  });
  it("depois da revelação vê as visíveis, nunca ocultas ou removidas", () => {
    expect(visiblePhotos(base, all, viewer, base.revealAt!).map((p) => p.id)).toEqual(["m", "o"]);
  });
  it("revelação desligada mostra na hora", () => {
    expect(visiblePhotos({ ...base, revealEnabled: false, revealAt: null }, all, viewer, base.startAt).map((p) => p.id)).toEqual(["m", "o"]);
  });
  it("sem 'todos veem todas' o convidado só vê as próprias, e só depois da revelação", () => {
    const e = { ...base, everyoneSeesAll: false };
    expect(visiblePhotos(e, all, viewer, base.startAt).map((p) => p.id)).toEqual([]);
    expect(visiblePhotos(e, all, viewer, base.revealAt!).map((p) => p.id)).toEqual(["m"]);
  });
  it("anfitrião vê tudo, menos removidas", () => {
    expect(visiblePhotos(base, all, { id: "h1", host: true }, base.startAt).map((p) => p.id)).toEqual(["m", "o", "h"]);
  });
  it("fila de moderação reúne denunciadas e ocultas", () => {
    const q = moderationQueue([mine, report(other), hidden, gone]);
    expect(q.map((p) => p.id).sort()).toEqual(["h", "o"]);
    expect(hide(other).status).toBe("oculta");
    expect(remove(other).status).toBe("removida");
  });
});

describe("retrospectiva", () => {
  it("só abre para convidados depois do fim E da revelação; anfitrião sempre", () => {
    const imediata = { ...base, revealEnabled: false, revealAt: null };
    expect(retrospectiveOpen(imediata, base.startAt + H, false)).toBe(false); // revelada, mas o evento segue
    expect(retrospectiveOpen(imediata, endAt(base), false)).toBe(true);
    const depois = { ...base, revealAt: endAt(base) + D };
    expect(retrospectiveOpen(depois, endAt(base), false)).toBe(false);
    expect(retrospectiveOpen(depois, endAt(base) + D, true)).toBe(true);
    expect(retrospectiveOpen(depois, endAt(base) + D, false)).toBe(true);
    expect(retrospectiveOpen(base, base.startAt, true)).toBe(true);
  });
});
