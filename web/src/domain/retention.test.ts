import { describe, expect, it } from "vitest";
import { RETENTION_DAYS, photosAvailableUntil } from "./retention";

const DAY = 86_400_000;
const base = { startAt: 1_000_000, durationHours: 6 };

describe("disponibilidade das fotos (90 dias após o encerramento)", () => {
  it("evento sob a política: fim planejado + 90 dias", () => {
    expect(RETENTION_DAYS).toBe(90);
    expect(photosAvailableUntil({ ...base, retentionPolicy: "2026-10-22-v1" })).toBe(1_000_000 + 6 * 3_600_000 + 90 * DAY);
  });
  it("encerrar antes acompanha o fim antecipado (o prazo conta do encerramento)", () => {
    const endedAt = 1_000_000 + 2 * 3_600_000;
    expect(photosAvailableUntil({ ...base, endedAt, retentionPolicy: "2026-10-22-v1" })).toBe(endedAt + 90 * DAY);
  });
  it("evento anterior à política não tem prazo automático: nada é exibido", () => {
    expect(photosAvailableUntil({ ...base })).toBeNull();
    expect(photosAvailableUntil({ ...base, retentionPolicy: undefined })).toBeNull();
  });
});
