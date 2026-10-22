import { describe, expect, it } from "vitest";
import { PRIVACY_VERSION, TERMS_VERSION } from "./consent";
import { LEGAL_UPDATED_AT, PRIVACY_TEXT, TERMS_TEXT, type LegalSection } from "./legal-text";

const flat = (sections: LegalSection[]) => sections.flatMap((s) => [s.title, ...s.blocks.flat()]).join("\n");

describe("textos legais 2026-10-22-v1", () => {
  it("têm dez seções cada, numeradas", () => {
    for (const t of [TERMS_TEXT, PRIVACY_TEXT]) {
      expect(t).toHaveLength(10);
      t.forEach((s, i) => expect(s.title.startsWith(`${i + 1}. `)).toBe(true));
    }
  });
  it("a versão vigente do código é a do texto publicado", () => {
    expect(TERMS_VERSION).toBe("2026-10-22-v1");
    expect(PRIVACY_VERSION).toBe("2026-10-22-v1");
    expect(LEGAL_UPDATED_AT).toBe("22 de outubro de 2026");
  });
  it("publicam os prazos de retenção: 90 dias de disponibilidade e exclusão em até 30 dias", () => {
    const t = flat(TERMS_TEXT);
    const p = flat(PRIVACY_TEXT);
    expect(t).toContain("As fotografias ficam disponíveis por 90 dias após o encerramento do evento.");
    expect(t).toContain("a exclusão do armazenamento ativo ocorrerá em até 30 dias");
    expect(p).toContain("As fotografias ficam disponíveis por 90 dias após o encerramento do evento.");
    expect(p).toContain("a exclusão do armazenamento ativo é concluída em até 30 dias");
    expect(p).toContain("eliminadas em até 30 dias adicionais à exclusão do armazenamento ativo");
  });
  it("identificam responsável e contato, sem inventar CNPJ, endereço ou certificação", () => {
    const all = flat(TERMS_TEXT) + flat(PRIVACY_TEXT);
    expect(all).toContain("Aurimar Espindola Nogueira");
    expect(all).toContain("mazinhoww@gmail.com");
    expect(all).not.toMatch(/CNPJ|CPF n[º°]|ISO ?27001|SOC ?2|certificad/i);
    expect(all).not.toMatch(/servidores? (est[aã]o|localizados?) (no|em) /i);
  });
  it("não afirmam revisão jurídica profissional nem aprovação por advogado", () => {
    const all = flat(TERMS_TEXT) + flat(PRIVACY_TEXT);
    expect(all).not.toMatch(/rascunho|revis[ãa]o jur[íi]dica|revisad[oa] por advogad|aprovad[oa] (por|pelo) (advogad|jur[íi]dic)/i);
  });
  it("não autorizam publicidade nem treinamento de IA com as fotos", () => {
    expect(flat(TERMS_TEXT)).toContain("não utilizará fotografias do evento em publicidade, divulgação comercial ou treinamento de modelos de inteligência artificial sem autorização específica e separada");
    expect(flat(PRIVACY_TEXT)).toContain("Não vendemos dados pessoais nem utilizamos fotografias dos eventos para publicidade ou treinamento de inteligência artificial sem autorização específica");
  });
  it("a Política fala em ciência, não em consentimento genérico", () => {
    expect(flat(PRIVACY_TEXT)).toContain("Aceitar os Termos ou declarar ciência desta Política não autoriza automaticamente publicidade, reconhecimento facial ou qualquer uso incompatível");
  });
});
