import { describe, expect, it } from "vitest";
import { DENUNCIA_MOTIVOS_COMENTARIO, DENUNCIA_MOTIVOS_FOTO } from "@/revela/screens/FeedDenunciar";
import { COMMENT_REASON_CODES, PHOTO_REASON_CODES, REASON_LABEL, commentReasonAt, formatReasonCounts, listReportReasons, photoReasonAt } from "./report-reasons";

describe("motivos de denúncia", () => {
  it("cada item das listas do desenho tem um código, na mesma ordem", () => {
    expect(PHOTO_REASON_CODES).toHaveLength(DENUNCIA_MOTIVOS_FOTO.length);
    expect(COMMENT_REASON_CODES).toHaveLength(DENUNCIA_MOTIVOS_COMENTARIO.length);
    DENUNCIA_MOTIVOS_FOTO.forEach((label, i) => expect(REASON_LABEL[PHOTO_REASON_CODES[i]]).toBe(label));
    DENUNCIA_MOTIVOS_COMENTARIO.forEach((label, i) => expect(REASON_LABEL[COMMENT_REASON_CODES[i]]).toBe(label));
  });
  it("converte o índice escolhido em código; fora da lista não manda motivo", () => {
    expect(photoReasonAt(0)).toBe("nao_quero_aparecer");
    expect(photoReasonAt(3)).toBe("outro");
    expect(photoReasonAt(9)).toBeUndefined();
    expect(commentReasonAt(1)).toBe("spam");
  });
  it("formata a contagem por motivo, maior primeiro, sem identificar ninguém", () => {
    expect(formatReasonCounts({ outro: 1, improprio: 3, sem_motivo: 1 })).toBe("3 Conteúdo impróprio, 1 Outro motivo, 1 Sem motivo informado");
    expect(formatReasonCounts({})).toBe("");
    expect(formatReasonCounts(undefined)).toBe("");
    expect(formatReasonCounts({ inventado: 2 })).toBe("2 Outro motivo");
  });
  it("modo local não guarda motivos", async () => {
    expect(await listReportReasons("e")).toEqual({ photos: {}, comments: {} });
  });
});
