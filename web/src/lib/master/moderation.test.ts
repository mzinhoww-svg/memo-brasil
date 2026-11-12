import { describe, expect, it } from "vitest";
import { ACTION_LABEL, moderationCall, modTab, reasonChips, rowActions, shortPhotoId, sheetText } from "./moderation";

describe("moderação (M26)", () => {
  it("a foto vira só 'foto 3f1a…' (4 caracteres do id)", () => {
    expect(shortPhotoId("3f1a9c04-0000-4000-8000-000000000001")).toBe("foto 3f1a…");
  });
  it("motivos agregados em etiquetas, maior contagem primeiro", () => {
    expect(reasonChips({ outro: 1, improprio: 2 })).toEqual(["2 Conteúdo impróprio", "1 Outro motivo"]);
    expect(reasonChips({ constrangedora: 3, improprio: 1 })).toEqual(["3 Foto constrangedora", "1 Conteúdo impróprio"]);
    expect(reasonChips({ ofensivo: 2, spam: 5 })).toEqual(["5 Spam", "2 Ofensivo"]);
    expect(reasonChips({ nao_quero_aparecer: 2 })).toEqual(["2 Não quero aparecer"]);
    expect(reasonChips({ sem_motivo: 1, x: 0 })).toEqual(["1 Sem motivo informado"]);
    expect(reasonChips(undefined)).toEqual([]);
  });
  it("aba desconhecida cai em fotos", () => {
    expect(modTab("comentarios")).toBe("comentarios");
    expect(modTab("bloqueados")).toBe("bloqueados");
    expect(modTab("x")).toBe("fotos");
    expect(modTab(undefined)).toBe("fotos");
  });
  it("visível: Manter e Esconder; escondida: Manter e Excluir", () => {
    expect(rowActions(false).map((a) => ACTION_LABEL[a])).toEqual(["Manter", "Esconder"]);
    expect(rowActions(true).map((a) => ACTION_LABEL[a])).toEqual(["Manter", "Excluir"]);
  });
  it("texto da folha de esconder foto = desenho M26.f1", () => {
    const t = sheetText("photo", "esconder", "foto 3f1a… · Chá da Maria · 3 denúncias");
    expect(t.title).toBe("Esconder esta foto?");
    expect(t.body).toBe("foto 3f1a… · Chá da Maria · 3 denúncias. Ela sai do feed para todos os convidados.");
    expect(t.confirm).toBe("Esconder foto");
  });
  it("chamada ao servidor: foto usa admin_moderate_photo; comentário usa moderate_comment com as palavras do banco", () => {
    expect(moderationCall("photo", "p1", "excluir", "Motivo válido aqui")).toEqual({ fn: "admin_moderate_photo", args: { p_photo: "p1", p_action: "excluir", p_reason: "Motivo válido aqui" } });
    expect(moderationCall("comment", "c1", "manter", "Motivo válido aqui").args.p_action).toBe("mostrar");
    expect(moderationCall("comment", "c1", "excluir", "Motivo válido aqui").args.p_action).toBe("remover");
    expect(moderationCall("comment", "c1", "esconder", "Motivo válido aqui").args.p_action).toBe("esconder");
  });
});
