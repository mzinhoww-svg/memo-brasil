import { describe, expect, it } from "vitest";
import { withLock } from "./lock";

describe("withLock", () => {
  it("serializa seções críticas da mesma chave", async () => {
    let inside = 0, max = 0;
    const run = () => withLock("k", async () => { inside++; max = Math.max(max, inside); await new Promise((r) => setTimeout(r, 5)); inside--; });
    await Promise.all(Array.from({ length: 8 }, run));
    expect(max).toBe(1);
  });
  it("uma falha não trava a fila", async () => {
    await expect(withLock("f", async () => { throw new Error("x"); })).rejects.toThrow("x");
    await expect(withLock("f", async () => 7)).resolves.toBe(7);
  });
});
