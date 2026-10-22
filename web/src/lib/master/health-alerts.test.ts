import { describe, expect, it } from "vitest";
import { healthAlerts, PURGE_QUEUE_MAX_AGE_S, type Health } from "./health-alerts";

const ok: Health = { cronAvailable: true, jobs: [{ name: "mm-reveal-due", active: true, lastRun: { status: "succeeded" } }], reveals: { overdue: 0, maxDelaySeconds: 0 }, purgeQueue: { size: 0, oldestAgeSeconds: 0 }, uploads: { stalled: 0, failed: 0 } };
const com = (p: Partial<Health>): Health => ({ ...ok, ...p });

describe("healthAlerts", () => {
  it("saudável: nenhum alerta", () => expect(healthAlerts(ok)).toEqual([]));
  it("fila de purga no limite (7200 s) ainda não alerta", () => expect(healthAlerts(com({ purgeQueue: { size: 3, oldestAgeSeconds: PURGE_QUEUE_MAX_AGE_S } }))).toEqual([]));
  it("fila de purga acima de 7200 s alerta com a idade em minutos", () => {
    const a = healthAlerts(com({ purgeQueue: { size: 3, oldestAgeSeconds: PURGE_QUEUE_MAX_AGE_S + 60 } }));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: "purge-queue", text: expect.stringContaining("121 min") });
  });
  it("revelação vencida, envio parado e pg_cron fora geram alertas próprios", () => {
    const ids = healthAlerts(com({ cronAvailable: false, reveals: { overdue: 2, maxDelaySeconds: 900 }, uploads: { stalled: 1, failed: 0 } })).map((x) => x.id);
    expect(ids).toEqual(["cron-off", "reveal-overdue", "upload-stalled"]);
  });
  it("job inativo ou com última execução falha alerta; job sem execução ainda não", () => {
    const a = healthAlerts(com({ jobs: [{ name: "mm-a", active: false, lastRun: null }, { name: "mm-b", active: true, lastRun: { status: "failed" } }, { name: "mm-c", active: true, lastRun: null }] }));
    expect(a.map((x) => x.id)).toEqual(["job-mm-a", "job-mm-b"]);
  });
});
