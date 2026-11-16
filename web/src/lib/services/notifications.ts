import type { PlannedNotification } from "@/domain/notifications";
import type { NotificationScheduler } from ".";

/**
 * Agenda avisos com setTimeout enquanto o app está aberto. Sem alarme do sistema e sem push,
 * por isso "melhor esforço": o push real vem com o backend (docs/supabase).
 */
export function createLocalScheduler(show: (n: PlannedNotification) => void = defaultShow): NotificationScheduler {
  const timers = new Map<string, ReturnType<typeof setTimeout>[]>();
  const MAX = 2 ** 31 - 1;
  return {
    schedule(eventId, plan) {
      this.cancel(eventId);
      const now = Date.now();
      timers.set(
        eventId,
        plan.filter((n) => n.at - now <= MAX).map((n) => setTimeout(() => show(n), Math.max(0, n.at - now))),
      );
    },
    cancel(eventId) {
      timers.get(eventId)?.forEach(clearTimeout);
      timers.delete(eventId);
    },
  };
}

function defaultShow(n: PlannedNotification) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    const note = new Notification(n.title, { body: n.body, icon: "/pwa/icon-192.png" });
    const href = n.href;
    if (href) note.onclick = () => { window.focus(); window.location.assign(href); };
  }
}
