import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepositories, type Repositories, type User } from "@/repositories";
import { PRESETS, type ThemeSpec } from "@/lib/event-theme/spec";
import { createEvent, reconcileReveal, type EventInput } from "./service";
import { restoreDefaultTheme, saveTheme } from "./theme";

const NOW = 1_800_000_000_000;
const host: User = { id: "host", name: "Emy", createdAt: 1 };
const input: EventInput = {
  title: "Emy e Igor", category: "casamento", durationHours: 6, reveal: { enabled: true, kind: "ao-terminar", days: 1, date: "", time: "", timezone: "America/Cuiaba" }, cameraStyle: "original",
  capacity: 5, shotsPerPerson: 5, everyoneSeesAll: true, palette: "salvia", eventFont: "birthstone",
};
const oceano: ThemeSpec = { preset: "oceano", colors: { ...PRESETS.oceano.dia }, font: "pinyon", welcomeMessage: "Que bom ter você aqui!", qrStyle: "pontos" };
let repos: Repositories;
let a: string, b: string;
beforeEach(async () => {
  repos = createMemoryRepositories();
  const ra = await createEvent(repos, host, input, NOW); const rb = await createEvent(repos, host, { ...input, title: "Outro" }, NOW);
  if (!ra.ok || !rb.ok) throw new Error("setup");
  a = ra.event.id; b = rb.event.id;
});

describe("saveTheme", () => {
  it("grava o tema válido só no evento alvo (isolamento)", async () => {
    const r = await saveTheme(repos, a, oceano, NOW);
    expect(r.ok && r.event.theme?.preset).toBe("oceano");
    expect((await repos.events.get(a))?.theme?.qrStyle).toBe("pontos");
    expect((await repos.events.get(b))?.theme).toBeUndefined();
  });
  it("recusa tema sem contraste e não grava nada", async () => {
    const bad = { ...oceano, colors: { ...oceano.colors, texto: "#EEEEEE" } };
    const r = await saveTheme(repos, a, bad, NOW);
    expect(r).toMatchObject({ ok: false, reason: "invalido" });
    expect((await repos.events.get(a))?.theme).toBeUndefined();
  });
  it("recusa evento inexistente", async () => {
    expect(await saveTheme(repos, "nada", oceano, NOW)).toEqual({ ok: false, reason: "inexistente" });
  });
  it("bloqueia a edição depois da revelação", async () => {
    const e = (await repos.events.get(a))!;
    const depois = (e.revealAt ?? NOW) + 1000;
    await reconcileReveal(repos, a, depois);
    expect(await saveTheme(repos, a, oceano, depois)).toEqual({ ok: false, reason: "bloqueado" });
  });
});

describe("restoreDefaultTheme", () => {
  it("remove o tema personalizado e volta à paleta do evento", async () => {
    await saveTheme(repos, a, oceano, NOW);
    const r = await restoreDefaultTheme(repos, a, NOW);
    expect(r.ok && r.event.theme).toBeUndefined();
    expect((await repos.events.get(a))?.palette).toBe("salvia");
  });
});
