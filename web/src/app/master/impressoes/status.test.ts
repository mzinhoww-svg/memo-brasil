import { describe, expect, it } from "vitest";
import { isStatus, nextSteps } from "./status";

describe("status dos pedidos de impressão no Master", () => {
  it("segue solicitado → em produção → enviado → entregue e cancela só até o envio", () => {
    expect(nextSteps("solicitado").map((s) => s.to)).toEqual(["em_producao", "cancelado"]);
    expect(nextSteps("em_producao").map((s) => s.to)).toEqual(["enviado", "cancelado"]);
    expect(nextSteps("enviado").map((s) => s.to)).toEqual(["entregue"]);
    expect(nextSteps("entregue")).toEqual([]);
    expect(nextSteps("cancelado")).toEqual([]);
  });
  it("cancelar exige motivo", () => {
    expect(nextSteps("solicitado").find((s) => s.to === "cancelado")?.needsReason).toBe(true);
    expect(nextSteps("solicitado").find((s) => s.to === "em_producao")?.needsReason).toBeUndefined();
  });
  it("valida o filtro da URL", () => {
    expect(isStatus("enviado")).toBe(true);
    expect(isStatus("x")).toBe(false);
    expect(isStatus(undefined)).toBe(false);
  });
});
