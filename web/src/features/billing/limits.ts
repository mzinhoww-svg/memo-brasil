/**
 * Opções de configuração limitadas ao plano efetivo (o servidor impõe de qualquer forma, MM012).
 * `max === null` = plano sem limite. O valor atual (evento legado acima do plano) fica sempre disponível para não sumir da tela.
 * `addMax` acrescenta o próprio limite do plano como opção (capacidade 30, 250, 500...).
 */
export function limitChoices<T extends number | null>(options: readonly T[], max: number | null, current: T, addMax = false): T[] {
  if (max === null) return [...options];
  const out = options.filter((o) => o !== null && o <= max);
  if (addMax && !out.includes(max as T)) out.push(max as T);
  out.sort((a, b) => (a as number) - (b as number));
  if (!out.includes(current)) out.push(current);
  return out as T[];
}
