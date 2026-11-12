/**
 * Idas ao servidor nas telas principais, medidas com o cliente Supabase falso (cada consulta/RPC/assinatura = 1 ida de
 * LATENCY ms). "calls" = idas; "serial" = idas em série até a tela ter o que mostrar. Os números de "antes" foram medidos
 * com este mesmo cliente no commit ca3979b (ver docs/evidence/perf/DADOS.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseRepositories } from "@/repositories/supabase";
import { readEventScoped } from "@/features/access/read";
import { loadMyEvents } from "@/features/app/my-events";
import { loadIdentity } from "@/features/app/identity";
import { loadPhotoUrls } from "@/features/app/photo-urls";
import { cachedEventData, prefetchEventData } from "@/features/app/hooks";
import { reactOptimistic } from "@/features/feed/optimistic";
import { CODE, EVENT, GUEST, HOST, fakeSupabase, measure } from "./fake-supabase";

const adv = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const guest = { userId: GUEST, role: "organizador" as const };
const host = { userId: HOST, role: "organizador" as const };
const rows: { tela: string; antes: string; depois: string }[] = [];
const rec = (tela: string, antes: [number, number] | string, calls: number, serial: number) => rows.push({ tela, antes: typeof antes === "string" ? antes : `${antes[0]} idas / ${antes[1]} em série`, depois: `${calls} idas / ${serial} em série` });

describe("idas ao servidor (antes → depois)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); });

  it("feed do convidado: leitura do evento + 20 fotos", async () => {
    const { sb, calls } = fakeSupabase({ me: GUEST });
    const r = createSupabaseRepositories(sb);
    const m = await measure(adv, async () => {
      const v = await readEventScoped(r, { code: CODE }, guest, 10_000);
      await loadPhotoUrls(r.photos, v.photos, "thumb");
    });
    rec("Feed do convidado (evento + 20 fotos)", [46, 45], calls.length, m.serial);
    expect([calls.length, m.serial]).toEqual([7, 3]);
  });

  it("evento do convidado / do anfitrião", async () => {
    const g = fakeSupabase({ me: GUEST });
    const mg = await measure(adv, () => readEventScoped(createSupabaseRepositories(g.sb), { code: CODE }, guest, 10_000));
    rec("readEventScoped convidado (layout, polling 45 s)", [6, 5], g.calls.length, mg.serial);
    const h = fakeSupabase({ me: HOST });
    const mh = await measure(adv, () => readEventScoped(createSupabaseRepositories(h.sb), { id: EVENT }, host, 10_000));
    rec("readEventScoped anfitrião (layout do painel)", [6, 5], h.calls.length, mh.serial);
    expect([g.calls.length, mg.serial, h.calls.length, mh.serial]).toEqual([6, 2, 5, 2]);
  });

  it("painel Conteúdo: evento + 20 miniaturas (sem miniatura no Storage)", async () => {
    const { sb, calls } = fakeSupabase({ me: HOST });
    const r = createSupabaseRepositories(sb);
    const m = await measure(adv, async () => {
      const v = await readEventScoped(r, { id: EVENT }, host, 10_000);
      await loadPhotoUrls(r.photos, v.photos, "thumb");
    });
    rec("Painel › Conteúdo (evento + 20 miniaturas)", [66, 65], calls.length, m.serial);
    expect([calls.length, m.serial]).toEqual([6, 3]);
  });

  it("abertura do app (provider): identidade + pode criar", async () => {
    const { sb, calls } = fakeSupabase({ me: HOST });
    const m = await measure(adv, () => loadIdentity(createSupabaseRepositories(sb), "supabase"));
    rec("Provider (identidade + canCreate)", [3, 3], calls.length, m.serial);
    expect([calls.length, m.serial]).toEqual([1, 1]);
  });

  it("/eventos: lista + contagens do destaque", async () => {
    const { sb, calls } = fakeSupabase({ me: HOST });
    const r = createSupabaseRepositories(sb);
    const m = await measure(adv, async () => {
      const d = await loadMyEvents(r, HOST, 10_000);
      const hero = d.active[0] ?? d.ended[0];
      await Promise.all([r.participants.count(hero.id), r.photos.count(hero.id)]);
    });
    rec("/eventos (listMine + contagens)", [4, 3], calls.length, m.serial);
    expect([calls.length, m.serial]).toEqual([4, 2]);
  });

  it("curtir no feed: espera até a tela mudar", async () => {
    const { sb, calls } = fakeSupabase({ me: GUEST });
    const r = createSupabaseRepositories(sb);
    await measure(adv, () => prefetchEventData(r, { code: CODE }, GUEST, 10_000));
    const v = cachedEventData(r, { code: CODE }, GUEST)!;
    const c0 = calls.length;
    const done = reactOptimistic(r, v.event!, v.photos[0].id, GUEST, "amei", 10_000, undefined);
    // a tela já mostra a curtida antes de qualquer ida terminar
    expect(cachedEventData(r, { code: CODE }, GUEST)!.reactions).toHaveLength(1);
    await measure(adv, () => done);
    await adv(500);
    rec("Curtir (até a tela mostrar a curtida)", [9, 8], 0, 0);
    rec("Curtir (idas em segundo plano: grava + reconcilia)", "— (tudo em primeiro plano)", calls.length - c0, 0);
    expect(calls.length - c0).toBe(4); // react(): foto, reações, gravação (inalterado) + releitura só das reações
  });

  it("voltar a uma tela com as mesmas fotos (ex.: Revelados → Feed → foto aberta)", async () => {
    const { sb, calls } = fakeSupabase({ me: GUEST });
    const r = createSupabaseRepositories(sb);
    const v = (await measure(adv, () => readEventScoped(r, { code: CODE }, guest, 10_000))).value;
    await measure(adv, () => loadPhotoUrls(r.photos, v.photos, "thumb"));
    const c0 = calls.length;
    const m = await measure(adv, async () => {
      await loadPhotoUrls(r.photos, v.photos, "thumb");
      await loadPhotoUrls(r.photos, v.photos.slice(0, 3), "full");
    });
    rec("Voltar ao feed com as mesmas 20 fotos (+ abrir uma)", [40, 40], calls.length - c0, m.serial);
    expect([calls.length - c0, m.serial]).toEqual([0, 0]);
    console.table(rows);
  });
});
