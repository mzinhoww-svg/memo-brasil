import type { PlannedNotification } from "@/domain/notifications";
import type { NotificationScheduler } from ".";

/**
 * Agenda avisos com setTimeout enquanto o app está aberto. Sem alarme do sistema e sem push,
 * por isso "melhor esforço": o push real vem com o backend (docs/supabase).
 */
export interface NativeNoticeReceipts { enroll(eventId:string):void|Promise<void>; shown(eventId:string):void|Promise<void> }
export function createLocalScheduler(show: (n: PlannedNotification) => Notification|void = defaultShow,receipts?:NativeNoticeReceipts): NotificationScheduler {
  const timers = new Map<string, ReturnType<typeof setTimeout>[]>();
  const MAX = 2 ** 31 - 1;
  return {
    schedule(eventId, plan) {
      this.cancel(eventId);
      const now = Date.now();
      const record=(kind:"enroll"|"shown")=>{try{void Promise.resolve(receipts?.[kind](eventId)).catch(()=>undefined);}catch{/* observação indisponível não interrompe o aviso local */}};
      if(plan.some(n=>n.kind==="revelou")&&typeof Notification!=="undefined"&&Notification.permission==="granted")record("enroll");
      timers.set(
        eventId,
        plan.filter((n) => n.at - now <= MAX).map((n) => setTimeout(() => {
          const note=show(n);
          if(n.kind==="revelou"&&note&&typeof Notification!=="undefined"&&Notification.permission==="granted")note.addEventListener("show",()=>record("shown"),{once:true});
        }, Math.max(0, n.at - now))),
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
    return note;
  }
}
