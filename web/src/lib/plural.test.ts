import { describe, expect, it } from "vitest";
import { plural } from "./plural";

describe("plural", () => {
  it("1 usa o singular; 0 e demais usam o plural (pt-BR)", () => {
    expect(plural(1, "foto", "fotos")).toBe("foto");
    expect(plural(0, "foto", "fotos")).toBe("fotos");
    expect(plural(2, "foto", "fotos")).toBe("fotos");
    expect(plural(1, "convidado entrou", "convidados entraram")).toBe("convidado entrou");
  });
});
