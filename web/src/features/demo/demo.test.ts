import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseRepos = vi.hoisted(() => vi.fn(() => {
  throw new Error("adaptador ativo não pode ser usado pelo exemplo");
}));
vi.mock("@/lib/supabase/env", () => ({ backendMode: () => "supabase", backendStatus: () => "supabase", supabaseConfig: () => ({ url: "https://x.supabase.co", key: "k" }) }));
vi.mock("@/repositories/supabase", () => ({ createSupabaseRepositories: supabaseRepos }));

import { createExampleParty } from "./example";

beforeEach(() => { supabaseRepos.mockClear(); });

describe("festa de exemplo (/exemplo)", () => {
  it("demo usa repositório em memória mesmo com backend supabase", async () => {
    const party = await createExampleParty(1_800_000_000_000);
    expect(supabaseRepos).not.toHaveBeenCalled();
    const photos = await party.repos.photos.listByEvent(party.event.id);
    expect(photos.length).toBeGreaterThan(5);
    expect(party.event.title).toBe("Lu faz 40");
    expect(party.shotsLimit).toBe(5);
  });
  it("cada chamada devolve um repositório novo e isolado", async () => {
    const a = await createExampleParty(1_800_000_000_000);
    const b = await createExampleParty(1_800_000_000_000);
    expect(await b.repos.events.getByCode(a.event.code)).toBeUndefined();
  });
});
