import { describe, expect, it, vi } from "vitest";
import { clearAppData, createSwrStore, markAppDataStale, storeFor } from "./data-cache";

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

describe("createSwrStore", () => {
  it("guarda o valor, avisa quem assina e devolve na hora na próxima leitura", async () => {
    const s = createSwrStore<number>();
    const cb = vi.fn();
    const off = s.subscribe("k", cb);
    expect(s.get("k")).toBeUndefined();
    await s.revalidate("k", async () => 1);
    expect(s.get("k")?.value).toBe(1);
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    await s.revalidate("k", async () => 2, { force: true });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(s.get("k")?.value).toBe(2);
  });

  it("junta leituras simultâneas da mesma chave numa só (sem force)", async () => {
    const s = createSwrStore<number>();
    const d = deferred<number>();
    const fetcher = vi.fn(() => d.promise);
    const a = s.revalidate("k", fetcher);
    const b = s.revalidate("k", fetcher);
    d.resolve(7);
    expect(await a).toBe(7);
    expect(await b).toBe(7);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("com force, a leitura mais nova vence mesmo que a antiga responda depois", async () => {
    const s = createSwrStore<string>();
    const old = deferred<string>();
    const neu = deferred<string>();
    const a = s.revalidate("k", () => old.promise);
    const b = s.revalidate("k", () => neu.promise, { force: true });
    neu.resolve("novo");
    await b;
    old.resolve("velho");
    await a;
    expect(s.get("k")?.value).toBe("novo");
  });

  it("falha não apaga o que já estava guardado", async () => {
    const s = createSwrStore<number>();
    await s.revalidate("k", async () => 1);
    await expect(s.revalidate("k", async () => { throw new Error("offline"); }, { force: true })).rejects.toThrow("offline");
    expect(s.get("k")?.value).toBe(1);
  });

  it("patch altera as entradas escolhidas e avisa; invalidate marca como velha sem apagar; clear apaga", async () => {
    const s = createSwrStore<{ n: number }>();
    await s.revalidate("a", async () => ({ n: 1 }));
    await s.revalidate("b", async () => ({ n: 2 }));
    const cb = vi.fn();
    s.subscribe("a", cb);
    s.patch((v) => v.n === 1, (v) => ({ n: v.n + 10 }));
    expect(s.get("a")?.value.n).toBe(11);
    expect(s.get("b")?.value.n).toBe(2);
    expect(cb).toHaveBeenCalledTimes(1);
    s.invalidate();
    expect(s.get("a")?.stale).toBe(true);
    expect(s.get("a")?.value.n).toBe(11);
    s.clear();
    expect(s.get("a")).toBeUndefined();
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("a sequência cresce a cada gravação (permite saber o que chegou depois de montar a tela)", async () => {
    const s = createSwrStore<number>();
    const before = s.seq();
    await s.revalidate("k", async () => 1);
    expect(s.get("k")!.seq).toBeGreaterThan(before);
  });
});

describe("storeFor / clearAppData / markAppDataStale", () => {
  it("um conjunto de caches por instância de repositórios; limpar e invalidar valem para todos os caches dela", async () => {
    const r1 = {};
    const r2 = {};
    const a = storeFor<number>(r1, "eventos");
    expect(storeFor<number>(r1, "eventos")).toBe(a);
    expect(storeFor<number>(r2, "eventos")).not.toBe(a);
    await a.revalidate("k", async () => 1);
    await storeFor<number>(r1, "outros").revalidate("k", async () => 2);
    markAppDataStale(r1);
    expect(a.get("k")?.stale).toBe(true);
    expect(storeFor<number>(r1, "outros").get("k")?.stale).toBe(true);
    clearAppData(r1);
    expect(a.get("k")).toBeUndefined();
    expect(storeFor<number>(r1, "outros").get("k")).toBeUndefined();
  });
});
