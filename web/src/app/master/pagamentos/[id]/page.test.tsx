import { beforeEach, expect, it, vi } from "vitest";
import PagamentoDetalhe from "./page";

const m = vi.hoisted(() => ({ rpc: vi.fn(), requireMaster: vi.fn().mockResolvedValue({}), context: null as unknown }));
vi.mock("../../data", () => ({ rpc: m.rpc, requireMaster: m.requireMaster }));
const id = "47000000-0000-4000-8000-000000000200";
const order = { orderId: id, eventId: "evento1", createdAt: "2026-11-01T10:00:00Z", paidAt: "2026-11-01T10:01:00Z", eventTitle: "Festa", planName: "Celebração", planCode: "celebracao", amountCents: 8900, provider: "validapay", providerEnv: "production", status: "pago" };
beforeEach(() => {
  m.context = { webhookAt: null, grant: null };
  m.rpc.mockReset();
  m.rpc.mockImplementation(async (_sb, name: string) => ({ state: "ok", data:
    name === "admin_master_payment_context" ? { order, hostName: "Júlia", ...m.context as object } : [] }));
});
it("não transforma paidAt em prova de webhook ou concessão", async () => {
  const view = await PagamentoDetalhe({ params: Promise.resolve({ id }) });
  expect(view.props.caption).toBe("Festa · Júlia · Celebração");
  expect(view.props.timeline).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: "pago", tone: "bad", meta: "— · confirmação de webhook indisponível" }),
    expect.objectContaining({ key: "plano", tone: "bad", meta: "— · concessão não registrada para este pedido" }),
  ]));
  expect(JSON.stringify(view.props.timeline)).not.toContain("assinatura válida");
  expect(m.rpc.mock.calls.some(call => call[1] === "admin_list_payments")).toBe(false);
});
it("exibe só horário e limites comprovados pela RPC do pedido", async () => {
  m.context = { webhookAt: "2026-11-01T10:02:00Z", grant: { at: "2026-11-01T10:03:00Z", maxGuests: 100, maxShots: 24 } };
  const view = await PagamentoDetalhe({ params: Promise.resolve({ id }) });
  expect(view.props.timeline).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: "pago", tone: "ok", meta: expect.stringContaining("assinatura válida") }),
    expect.objectContaining({ key: "plano", tone: "ok", meta: expect.stringContaining("100 convidados, 24 poses") }),
  ]));
  expect(m.rpc).toHaveBeenCalledWith({}, "admin_master_payment_context", { p_order: id });
});
