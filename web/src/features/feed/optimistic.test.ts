import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRepositories, type Repositories } from "@/repositories";
import { createEvent, type EventInput } from "@/features/events/service";
import { joinEvent } from "@/features/participants/service";
import { postPhoto } from "@/features/photos/service";
import { cachedEventData, prefetchEventData } from "@/features/app/hooks";
import type { MemoEvent } from "@/domain/event";
import { reactOptimistic } from "./optimistic";

const NOW = 1_800_000_000_000;
const input: EventInput = {
  title: "Festa", category: "casamento", durationHours: 6, reveal: { enabled: false, kind: "ao-terminar", days: 1, date: "", time: "", timezone: "UTC" }, cameraStyle: "original",
  capacity: 10, shotsPerPerson: 5, everyoneSeesAll: true, palette: "salvia", eventFont: "birthstone",
};

let repos: Repositories, event: MemoEvent, photoId: string;
beforeEach(async () => {
  repos = createMemoryRepositories();
  const r = await createEvent(repos, { id: "host", name: "Ana", createdAt: 1 }, input, NOW);
  if (!r.ok) throw new Error();
  event = r.event;
  await joinEvent(repos, { id: "bia", name: "Bia", createdAt: 1 }, event.code, "Bia", NOW + 1);
  const p = await postPhoto(repos, event, { id: "bia", name: "Bia", createdAt: 1 }, { bytes: new ArrayBuffer(1), type: "image/jpeg" }, { moment: "x" }, NOW + 2);
  if (!p.ok) throw new Error();
  photoId = p.photo.id;
  await prefetchEventData(repos, { code: event.code }, "bia", NOW + 3);
});

describe("curtida otimista", () => {
  it("aparece no cache antes de a gravação terminar, sem reler o evento inteiro, e reconcilia só as reações", async () => {
    const get = vi.spyOn(repos.events, "getByCode");
    let release!: () => void;
    const put = repos.reactions.put;
    repos.reactions.put = (r) => new Promise((ok) => { release = () => void put(r).then(ok); });
    const done = reactOptimistic(repos, event, photoId, "bia", "amei", NOW + 4, undefined);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    expect(cachedEventData(repos, { code: event.code }, "bia")!.reactions).toEqual([{ eventId: event.id, photoId, authorId: "bia", kind: "amei" }]);
    release();
    expect(await done).toBe(true);
    await vi.waitFor(async () => expect(cachedEventData(repos, { code: event.code }, "bia")!.reactions).toEqual(await repos.reactions.listByEvent(event.id)));
    expect(get).not.toHaveBeenCalled();
  });

  it("falha na gravação desfaz a reação desta pessoa e devolve false", async () => {
    repos.reactions.put = async () => { throw new Error("offline"); };
    repos.reactions.listByEvent = async () => { throw new Error("offline"); };
    expect(await reactOptimistic(repos, event, photoId, "bia", "amei", NOW + 4, undefined)).toBe(false);
    expect(cachedEventData(repos, { code: event.code }, "bia")!.reactions).toEqual([]);
  });
});
