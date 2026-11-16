import { describe, expect, it } from "vitest";
import { toRepositoryError } from "./index";

describe("toRepositoryError", () => {
  it("traduz MM012 (limite acima do plano efetivo) para not-entitled", () => {
    const err = toRepositoryError({ code: "MM012", message: "notentitled" });
    expect(err.code).toBe("not-entitled");
    expect(err.message).toBe("notentitled");
  });

  it("mantém MM003 como capacity-full", () => {
    expect(toRepositoryError({ code: "MM003", message: "capacityfull" }).code).toBe("capacity-full");
  });
});

describe("join_event devolve {error} (o contador de tentativas persiste no banco)", () => {
  const mk = async (data: unknown) => {
    const { createSupabaseRepositories } = await import("./index");
    return createSupabaseRepositories({ rpc: async () => ({ data, error: null }) } as never);
  };
  it("converte MM005, MM007 e MM006 nos erros tipados de sempre", async () => {
    for (const [error, code] of [["MM005", "invalid"], ["MM007", "invalid-invite"], ["MM006", "rate-limited"]] as const) {
      const repos = await mk({ error });
      await expect(repos.events.join!("ABCD2345", "Bia")).rejects.toMatchObject({ code });
    }
  });
  it("entrada normal continua devolvendo papel e evento", async () => {
    const repos = await mk({ role: "membro", eventId: "e1" });
    await expect(repos.events.join!("ABCD2345", "Bia")).resolves.toEqual({ role: "membro", eventId: "e1" });
  });
});
