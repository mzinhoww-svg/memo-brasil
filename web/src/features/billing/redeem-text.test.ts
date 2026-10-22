import { describe, expect, it } from "vitest";
import { REDEEM_TEXT, redeemMessage } from "./RedeemCode";

describe("redeemMessage", () => {
  it("mapeia os motivos conhecidos e evento_encerrado", () => {
    expect(redeemMessage("invalido")).toBe(REDEEM_TEXT.invalido);
    expect(redeemMessage("muitas_tentativas")).toBe(REDEEM_TEXT.muitas_tentativas);
    expect(redeemMessage("ja_incluido")).toBe(REDEEM_TEXT.ja_incluido);
    expect(redeemMessage("evento_encerrado")).toBe("Este evento já terminou. O código continua livre para outra festa.");
  });
  it("motivo desconhecido vira mensagem neutra (nunca revela se o código existe)", () => {
    expect(redeemMessage("qualquer_coisa")).toBe(REDEEM_TEXT.invalido);
  });
});
