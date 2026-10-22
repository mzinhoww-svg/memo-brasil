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
