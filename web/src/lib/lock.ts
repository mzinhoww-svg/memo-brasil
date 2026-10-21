/**
 * Exclusão mútua por chave. Usa Web Locks (vale entre abas) quando existe; senão uma fila em memória
 * (vale só na aba). Serve para ler-contar-gravar sem passar do limite (rolo, vagas, denúncias).
 */
const queues = new Map<string, Promise<unknown>>();

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks?.request) return locks.request(`mm:${key}`, fn) as Promise<T>;
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(key, next.catch(() => undefined));
  return next;
}
