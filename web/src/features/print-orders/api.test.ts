import { beforeEach, describe, expect, it } from "vitest";
import { cancelPrintOrder, createPrintOrder, listMyPrintOrders, PrintOrderError, printErrorText } from "./api";
import type { PrintDraft } from "./model";

const draft: PrintDraft = {
  product: "album", quantity: 2, photoIds: ["a", "b"], allPhotos: false, contactName: " Maria Souza ", contactPhone: "(65) 99999-1234", contactEmail: "",
  shipping: { cep: "78000-000", street: "Rua das Flores", number: "10", neighborhood: "Centro", city: "Cuiabá", state: "mt" }, note: "",
};
const args = (id: string, userId = "u1") => ({ id, eventId: "e1", eventTitle: "Ana & Leo", userId, draft, now: Date.parse("2026-11-10T12:00:00Z") });

describe("pedido de impressão no modo local", () => {
  beforeEach(() => localStorage.clear());
  it("cria, normaliza contato e endereço e lista só os meus", async () => {
    const o = await createPrintOrder(args("o1"));
    expect(o.status).toBe("solicitado");
    expect(o.contactName).toBe("Maria Souza");
    expect(o.contactPhone).toBe("65999991234");
    expect(o.shipping.cep).toBe("78000000");
    expect(o.shipping.state).toBe("MT");
    expect(o.photoCount).toBe(2);
    expect((await listMyPrintOrders("u1", "e1")).map((x) => x.id)).toEqual(["o1"]);
    expect(await listMyPrintOrders("u2")).toEqual([]);
  });
  it("reenviar com o mesmo id não duplica", async () => {
    await createPrintOrder(args("o1"));
    await createPrintOrder(args("o1"));
    expect(await listMyPrintOrders("u1")).toHaveLength(1);
  });
  it("cancela enquanto solicitado, só o próprio", async () => {
    await createPrintOrder(args("o1"));
    await expect(cancelPrintOrder("u2", "o1", 0)).rejects.toMatchObject({ code: "forbidden" });
    expect((await cancelPrintOrder("u1", "o1", 0)).status).toBe("cancelado");
    expect((await cancelPrintOrder("u1", "o1", 0)).status).toBe("cancelado");
  });
  it("não cancela o que já está em produção", async () => {
    await createPrintOrder(args("o1"));
    const rows = JSON.parse(localStorage.getItem("mm:print-orders:v1")!);
    rows[0].status = "em_producao";
    localStorage.setItem("mm:print-orders:v1", JSON.stringify(rows));
    await expect(cancelPrintOrder("u1", "o1", 0)).rejects.toBeInstanceOf(PrintOrderError);
  });
  it("mensagens de erro em português", () => {
    expect(printErrorText(new PrintOrderError("ratelimited"))).toMatch(/muitos pedidos/);
    expect(printErrorText(new PrintOrderError("estado"))).toMatch(/produção/);
    expect(printErrorText(new Error("x"))).toMatch(/Tente de novo/);
  });
});
