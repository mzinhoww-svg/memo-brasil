import { describe, expect, it } from "vitest";
import { isMissingThemeSchema } from "./compat";

describe("isMissingThemeSchema", () => {
  it("reconhece a ausência da tabela/relacionamento event_themes (servidor ainda na V1)", () => {
    expect(isMissingThemeSchema({ code: "PGRST200", message: "Could not find a relationship between 'events' and 'event_themes' in the schema cache" })).toBe(true);
    expect(isMissingThemeSchema({ code: "PGRST205", message: "Could not find the table 'public.event_themes' in the schema cache" })).toBe(true);
    expect(isMissingThemeSchema({ code: "42P01", message: 'relation "public.event_themes" does not exist' })).toBe(true);
  });
  it("não mascara outros erros", () => {
    expect(isMissingThemeSchema({ code: "42501", message: "permission denied for table event_themes" })).toBe(false);
    expect(isMissingThemeSchema({ code: "PGRST200", message: "relationship between 'events' and 'participants'" })).toBe(false);
    expect(isMissingThemeSchema(null)).toBe(false);
    expect(isMissingThemeSchema(new Error("rede"))).toBe(false);
  });
});
