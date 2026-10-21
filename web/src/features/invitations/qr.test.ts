import { describe, expect, it } from "vitest";
import { qrDataUrl } from "./qr";

describe("qrDataUrl", () => {
  it("gera PNG em data URL para o link do convite", async () => {
    const url = await qrDataUrl("https://memoriesmt.app/e/NFVARBQX?mesa=Mesa+8");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan(500);
  });
});
