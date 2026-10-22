/** Folga de lotação: espelha `capacity_grace_slots` do servidor (ceil), só para exibir. Quem barra é o servidor. */
export const graceSlots = (capacity: number | null, pct: number): number => (capacity === null ? 0 : Math.ceil((capacity * Math.min(Math.max(pct, 0), 100)) / 100));

/** Aviso "Lotação chegando" a partir de 80% da capacidade; `limit` é até onde ninguém é barrado. */
export function capacityState(guests: number, capacity: number | null, pct: number): { near: boolean; limit: number | null } {
  if (capacity === null) return { near: false, limit: null };
  return { near: guests >= capacity * 0.8, limit: capacity + graceSlots(capacity, pct) };
}
