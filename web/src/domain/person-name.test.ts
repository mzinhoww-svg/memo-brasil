import { describe, expect, it } from "vitest";
import { cleanPersonName } from "./person-name";

// Mesmos casos da função SQL public.clean_person_name (supabase/tests/database/13_person_names.test.sql).
describe("cleanPersonName", () => {
  it("remove a repetição colada ou com espaço", () => {
    expect(cleanPersonName("Aurimar NogueiraAurimar")).toBe("Aurimar Nogueira");
    expect(cleanPersonName("Ana SilvaAna Silva")).toBe("Ana Silva");
    expect(cleanPersonName("Ana Silva Ana Silva")).toBe("Ana Silva");
    expect(cleanPersonName("José ÁvilaJosé")).toBe("José Ávila");
  });
  it("mantém nomes legítimos", () => {
    for (const n of ["Aurimar Nogueira", "McDonald", "Lala", "Ana", "João Pedro", "Maria Maria", "DeAndre Jordan", "Emy e Igor"]) expect(cleanPersonName(n)).toBe(n);
  });
  it("apara e junta espaços; nulo vira vazio", () => {
    expect(cleanPersonName(null)).toBe("");
    expect(cleanPersonName("  Ana   Paula ")).toBe("Ana Paula");
  });
});
