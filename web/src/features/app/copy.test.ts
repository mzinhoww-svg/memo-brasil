import { describe, expect, it } from "vitest";
import { copyFor } from "./copy";

describe("textos por modo", () => {
  it("nenhuma string 'neste aparelho' renderizada quando backendMode='supabase'", () => {
    const c = copyFor("supabase");
    const all = JSON.stringify(c);
    expect(all).not.toMatch(/neste aparelho|só neste|Esta versão só abre/i);
    expect(c.inviteInvalid).toBe("Código não confere. Confira as 8 letras e números no card da mesa.");
    expect(c.inviteInvalidBody).toBe("Confira as 8 letras e números no card da mesa.");
    expect(c.errorBody).toBe("Algo deu errado. Suas fotos enviadas estão guardadas.");
    expect(c.downloadsSaved(1, 0)).toBe("Baixamos 1 foto.");
    expect(c.downloadsSaved(3, 2)).toMatch(/3 de 5 fotos.*2.*Tente de novo/);
    expect(c.deleteQuestion).toBe("Excluir este evento e todas as fotos?");
  });
  it("modo local mantém os textos atuais", () => {
    const c = copyFor("local");
    expect(c.inviteInvalidBody).toMatch(/neste aparelho/);
    expect(c.downloadsSaved(3, 2)).toBe("Baixamos 3 fotos. 2 não estavam neste aparelho.");
    expect(c.errorBody).toMatch(/neste aparelho/);
  });
});
