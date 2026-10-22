import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL } from "./contact";
import { PRIVACY_TEXT } from "./legal-text";

describe("contato único", () => {
  it("coincide com o contato do texto legal v1", () => {
    expect(JSON.stringify(PRIVACY_TEXT)).toContain(CONTACT_EMAIL);
  });
});
