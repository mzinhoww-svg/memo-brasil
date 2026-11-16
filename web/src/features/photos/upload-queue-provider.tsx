"use client";
/* Liga a fila de envio (upload-queue.ts) à sessão: montado no layout do convidado, fora da tela da câmera. */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useApp } from "@/features/app/provider";
import { rollBase, uploadQueue, usedFrom, type LastShot, type QueueEntry, type RollBase, type UploadQueue } from "./upload-queue";

/**
 * Retoma a fila ao abrir o app e quando a internet volta; `onConfirmed` (o refresh do evento) roda a cada foto confirmada.
 * Enquanto houver foto só na memória (ainda revelando), pede confirmação antes de fechar a aba.
 */
export function UploadQueueProvider({ onConfirmed, children, queue = uploadQueue }: { onConfirmed?: () => unknown; children?: ReactNode; queue?: UploadQueue }) {
  const { repos, user } = useApp();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    void queue.configure({ repos, userId, onConfirmed });
    return () => queue.release(onConfirmed);
  }, [queue, repos, userId, onConfirmed]);
  useEffect(() => {
    const online = () => queue.retryNow();
    const visible = () => { if (document.visibilityState === "visible") void queue.resume(); };
    const leaving = (e: BeforeUnloadEvent) => { if (queue.unsaved() > 0) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("beforeunload", leaving);
    return () => {
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("beforeunload", leaving);
    };
  }, [queue]);
  return <>{children}</>;
}

const NONE: QueueEntry[] = [];
/** Itens da fila deste evento e desta pessoa, e a prévia da última foto (se for daqui). */
export function useUploadQueue(eventId: string, userId: string, queue: UploadQueue = uploadQueue): { entries: QueueEntry[]; lastShot: LastShot | undefined } {
  const all = useSyncExternalStore(queue.subscribe, queue.getSnapshot, () => NONE);
  const last = useSyncExternalStore(queue.subscribe, queue.getLastShot, () => undefined);
  const entries = all.filter((e) => e.eventId === eventId && e.userId === userId);
  return { entries, lastShot: last && last.eventId === eventId && last.userId === userId ? last : undefined };
}

/**
 * Poses usadas com a fila: a contagem real congela quando a fila começa a ter itens e cada disparo pendente desconta na hora.
 * Quando a fila esvazia (depois do refresh da última confirmação), volta a valer só a contagem real. O odômetro não volta.
 */
export function useQueuedUsed(realUsed: number, entries: QueueEntry[]): number {
  const [base, setBase] = useState<RollBase | null>(null);
  const next = rollBase(base, realUsed, entries);
  if (next !== base) setBase(next);
  return usedFrom(realUsed, next);
}
