import { beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ collectDevice: vi.fn(), tokenize: vi.fn(), authenticate: vi.fn() }));
vi.mock("@validapay/tokenize/browser", () => ({ collectDevice: sdk.collectDevice, tokenize: sdk.tokenize }));
vi.mock("@validapay/3ds", () => ({ authenticate: sdk.authenticate }));
import { prepareSandboxCard } from "./validapay-card";

const card = { number: "4111111111111111", holderName: "PESSOA TESTE", cvv: "123", expiration: "12/2035" };
const customer = { name: "Pessoa Teste", email: "test@example.test", document: "12345678901", phone: "11999999999",
  address: { zipCode: "01310100", street: "Rua Teste", number: "1", neighborhood: "Centro", city: "São Paulo", state: "SP" } };
beforeEach(() => { vi.clearAllMocks(); sdk.collectDevice.mockResolvedValue({ deviceId: "device" }); sdk.authenticate.mockResolvedValue({ authenticationId: "auth", cardId: "card" }); sdk.tokenize.mockResolvedValue({ cardToken: "ctk_test" }); });

describe("browser card boundary (SDK simulation, not homologation)", () => {
  it("authenticates before tokenization, uses reais and returns no PAN/CVV", async () => {
    const result = await prepareSandboxCard("public-test", 18900, card, customer);
    expect(result).toEqual({ cardToken: "ctk_test", deviceId: "device", authentication: { authenticationId: "auth", cardId: "card" } });
    expect(JSON.stringify(result)).not.toContain(card.number);
    expect(JSON.stringify(result)).not.toContain(card.cvv);
    expect(sdk.authenticate.mock.calls[0][0]).toMatchObject({ amount: 189, environment: "sandbox", publicId: "public-test" });
    expect(sdk.authenticate.mock.invocationCallOrder[0]).toBeLessThan(sdk.tokenize.mock.invocationCallOrder[0]);
    expect(sdk.tokenize.mock.calls[0][0]).toMatchObject({ environment: "sandbox", authentication: { authenticationId: "auth", cardId: "card" } });
  });
  it("never tokenizes after a 3DS failure", async () => {
    sdk.authenticate.mockRejectedValue(new Error("bank declined"));
    await expect(prepareSandboxCard("public-test", 18900, card, customer)).rejects.toThrow();
    expect(sdk.tokenize).not.toHaveBeenCalled();
  });
  it("fails closed if 3DS is unavailable instead of silently bypassing it", async () => {
    sdk.authenticate.mockResolvedValue(null);
    await expect(prepareSandboxCard("public-test", 18900, card, customer)).rejects.toThrow();
    expect(sdk.tokenize).not.toHaveBeenCalled();
  });
  it("rejects invalid card input before loading SDK operations", async () => {
    await expect(prepareSandboxCard("public-test", 18900, { ...card, expiration: "01/2020" }, customer)).rejects.toThrow();
    expect(sdk.authenticate).not.toHaveBeenCalled();
  });
});

it.each(["production", "sandbox"] as const)("uses explicit %s for every SDK operation", async (environment) => {
  const { prepareCard } = await import("./validapay-card");
  await prepareCard({ publicId: "public", environment }, 2900, card, customer);
  for (const operation of [sdk.collectDevice, sdk.authenticate, sdk.tokenize]) expect(operation.mock.calls[0][0]).toMatchObject({ environment });
});
it("rejects an invalid trusted environment before contacting SDKs", async () => {
  const { prepareCard } = await import("./validapay-card");
  await expect(prepareCard({ publicId: "public", environment: "invalid" as "sandbox" }, 2900, card, customer)).rejects.toThrow();
  expect(sdk.collectDevice).not.toHaveBeenCalled();
});
