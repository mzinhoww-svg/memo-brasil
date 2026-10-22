/** Limite do runbook: fila de purga parada por mais de 7200 s (SCV-009). */
export const PURGE_QUEUE_MAX_AGE_S = 7200;

export interface Health {
  cronAvailable: boolean;
  jobs: { name: string; active: boolean; lastRun: { status: string } | null }[];
  reveals: { overdue: number; maxDelaySeconds: number };
  purgeQueue: { size: number; oldestAgeSeconds: number };
  uploads: { stalled: number; failed: number };
}
export interface HealthAlert { id: string; text: string }

/** Gatilhos de ação do OPERATIONAL-RECOVERY.md, calculados sobre o retorno de admin_health(). */
export function healthAlerts(h: Health): HealthAlert[] {
  const out: HealthAlert[] = [];
  if (!h.cronAvailable) out.push({ id: "cron-off", text: "pg_cron indisponível: nenhuma tarefa agendada está rodando." });
  if (h.reveals.overdue > 0) out.push({ id: "reveal-overdue", text: `${h.reveals.overdue} revelação(ões) vencida(s) e não executada(s); maior atraso ${Math.round(h.reveals.maxDelaySeconds / 60)} min.` });
  if (h.purgeQueue.oldestAgeSeconds > PURGE_QUEUE_MAX_AGE_S) out.push({ id: "purge-queue", text: `Fila de limpeza parada: item mais antigo com ${Math.round(h.purgeQueue.oldestAgeSeconds / 60)} min (limite ${PURGE_QUEUE_MAX_AGE_S / 60} min).` });
  if (h.uploads.stalled > 0) out.push({ id: "upload-stalled", text: `${h.uploads.stalled} foto(s) presa(s) em envio há mais de 1 h.` });
  for (const j of h.jobs) {
    if (!j.active) out.push({ id: `job-${j.name}`, text: `Tarefa ${j.name} está inativa.` });
    else if (j.lastRun && j.lastRun.status !== "succeeded") out.push({ id: `job-${j.name}`, text: `Tarefa ${j.name}: última execução ${j.lastRun.status}.` });
  }
  return out;
}
