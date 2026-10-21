import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClock } from "@/lib/server-clock";
import { createMemoryRepositories, RepositoryError, type Repositories, type User } from "@/repositories";
import { createEvent, type EventInput } from "../events/service";
import { joinEvent } from "../participants/service";
import { postPhoto } from "../photos/service";
import { localRevealAuthority, serverRevealAuthority } from "./index";

const NOW = 1_800_000_000_000;
const host: User = { id: "host", name: "Emy", createdAt: 1 };
const ana: User = { id: "ana", name: "Ana", createdAt: 1 };
const img = { bytes: new Uint8Array([1]).buffer, type: "image/jpeg" };
const input: EventInput = {
  title: "Emy e Igor", category: "casamento", durationHours: 6, reveal: { enabled: true, kind: "ao-terminar", days: 1, date: "", time: "", timezone: "UTC" }, cameraStyle: "original",
  capacity: 5, shotsPerPerson: 5, everyoneSeesAll: true, palette: "salvia", eventFont: "birthstone",
};
let repos: Repositories;
beforeEach(() => { repos = createMemoryRepositories(); });

describe("ITG-104: quem decide a revelação", () => {
  it("autoridade local (demo no aparelho) grava o espelho e o revealedAt na hora", async () => {
    const r = await createEvent(repos, host, input, NOW);
    if (!r.ok) throw new Error();
    const ev = await localRevealAuthority.tick(repos, r.event.id, r.event.revealAt! + 1);
    expect(localRevealAuthority.kind).toBe("local");
    expect(ev).toMatchObject({ revealStatus: "revelada", revealedAt: r.event.revealAt });
  });
  it("autoridade do servidor nunca grava: o cliente só lê o que a tarefa agendada gravou", async () => {
    const r = await createEvent(repos, host, input, NOW);
    if (!r.ok) throw new Error();
    const save = vi.spyOn(repos.events, "save");
    const ev = await serverRevealAuthority.tick(repos, r.event.id, r.event.revealAt! + 1);
    expect(serverRevealAuthority.kind).toBe("server");
    expect(save).not.toHaveBeenCalled();
    expect(ev).toMatchObject({ revealStatus: "pendente", revealedAt: null }); // ainda não gravado pelo servidor: o cliente não promove
    expect(await serverRevealAuthority.tick(repos, "inexistente", NOW)).toBeUndefined();
  });
});

describe("ITG-104: limites e relógio decididos pelo servidor", () => {
  const failing = (code: "shot-limit" | "event-ended" | "capacity-full" | "unavailable"): Repositories => ({
    ...repos,
    photos: { ...repos.photos, begin: async () => { throw new RepositoryError(code, "recusado pelo servidor"); } },
    participants: { ...repos.participants, put: async () => { throw new RepositoryError(code, "recusado pelo servidor"); } },
  });
  it("rolo cheio recusado no servidor vira a mesma razão da interface e não conta como foto", async () => {
    const r = await createEvent(repos, host, input, NOW);
    if (!r.ok) throw new Error();
    expect(await postPhoto(failing("shot-limit"), r.event, ana, img, { moment: "O sim" }, NOW + 1)).toEqual({ ok: false, reason: "rolo" });
    expect(await postPhoto(failing("event-ended"), r.event, ana, img, { moment: "O sim" }, NOW + 1)).toEqual({ ok: false, reason: "encerrado" });
    expect(await postPhoto(failing("unavailable"), r.event, ana, img, { moment: "O sim" }, NOW + 1)).toEqual({ ok: false, reason: "armazenamento" });
    expect(await repos.photos.count(r.event.id)).toBe(0);
  });
  it("lotação recusada no servidor vira 'lotado' na entrada", async () => {
    const r = await createEvent(repos, host, input, NOW);
    if (!r.ok) throw new Error();
    const guarded = failing("capacity-full");
    expect(await joinEvent({ ...repos, participants: guarded.participants, events: repos.events }, ana, r.event.code, "Ana", NOW + 1)).toEqual({ ok: false, reason: "lotado" });
  });
  it("relógio com correção do servidor: o horário do aparelho errado não decide a revelação", () => {
    let device = NOW - 3 * 3_600_000; // aparelho 3 h atrasado
    const clock = createServerClock({ read: () => device });
    expect(clock.now()).toBe(device);
    clock.sync(NOW, device); // o servidor informa o horário verdadeiro
    expect(clock.offset()).toBe(3 * 3_600_000);
    expect(clock.now()).toBe(NOW);
    device += 60_000;
    expect(clock.now()).toBe(NOW + 60_000); // continua andando com o aparelho
    expect(clock.skewed()).toBe(true);
  });
  it("aparelho certo não é marcado como desregulado", () => {
    const clock = createServerClock({ read: () => NOW });
    clock.sync(NOW + 500, NOW);
    expect(clock.skewed()).toBe(false);
  });
});
