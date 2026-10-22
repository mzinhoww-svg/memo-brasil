// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Executa o handler Deno real. Apenas o SDK remoto é substituído: nenhum Storage ou banco real é alterado.
const source = readFileSync(fileURLToPath(new URL("../../../supabase/functions/purge-storage/index.ts", import.meta.url)), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function worker(failure: "storage" | "queue" | null) {
  const pending = new Set(["photo-a", "photo-b"]);
  let handler!: (req: Request) => Promise<Response>;
  const admin = {
    from: (table: string) => {
      if (table !== "storage_purge_queue") throw new Error("unexpected table");
      return {
        select: () => ({ order: () => ({ limit: async () => ({ data: [...pending].map(path => ({ path, bucket: "event-photos" })), error: null }) }) }),
        delete: () => ({ eq: (_column: string, bucket: string) => ({ in: async (_key: string, paths: string[]) => {
          if (bucket !== "event-photos") throw new Error("unexpected bucket");
          if (failure === "queue") return { error: { message: "queue unavailable" } };
          paths.forEach(path => pending.delete(path));
          return { error: null };
        } }) }),
      };
    },
    storage: { from: (bucket: string) => ({ remove: async () => {
      if (bucket !== "event-photos") throw new Error("unexpected bucket");
      return { data: [], error: failure === "storage" ? { message: "storage unavailable" } : null };
    } }) },
  };
  runInNewContext(code, {
    exports: {}, Request, Response,
    require: (name: string) => {
      if (name !== "npm:@supabase/supabase-js@2") throw new Error(`unexpected dependency: ${name}`);
      return { createClient: () => admin };
    },
    Deno: { env: { get: (name: string) => name === "SUPABASE_URL" ? "https://test.invalid" : "test-only-service" }, serve: (fn: typeof handler) => { handler = fn; } },
  });
  return { pending, send: (token = "test-only-service") => handler(new Request("https://test.invalid/purge", { method: "POST", headers: { Authorization: `Bearer ${token}` } })) };
}

describe("purge-storage HTTP failure reporting (SCV-009)", () => {
  for (const failure of ["storage", "queue"] as const) {
    it(`returns HTTP 500 and retains retryable items after ${failure} failure`, async () => {
      const w = worker(failure);
      const response = await w.send();
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ ok: false, removidos: 0, falhas: 2, restante: 2 });
      expect([...w.pending]).toEqual(["photo-a", "photo-b"]);
    });
  }
  it("returns 200 only after the successful batch leaves the queue", async () => {
    const w = worker(null);
    const response = await w.send();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, removidos: 2, falhas: 0, restante: 0 });
    expect(w.pending.size).toBe(0);
  });
  it("refuses invalid credentials without consuming pending items", async () => {
    const w = worker(null);
    expect((await w.send("invalid-test-token")).status).toBe(403);
    expect(w.pending.size).toBe(2);
  });
});
