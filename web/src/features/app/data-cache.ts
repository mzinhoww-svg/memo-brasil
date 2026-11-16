/**
 * Cache de dados do cliente (stale-while-revalidate), no escopo do MÓDULO: sobrevive à troca de página, então voltar a
 * uma tela mostra na hora o que já foi lido e atualiza por baixo. Não é fonte de autorização: guarda só o que o servidor
 * (RLS/RPC) ou a fronteira `readEventScoped` já entregou para a pessoa atual, e as chaves levam o id dela.
 *
 * Um conjunto de caches por instância de `Repositories` (WeakMap): o modo local, o de memória e cada teste não se misturam.
 */

export interface Entry<T> {
  value: T;
  /** Quando foi lido (ms do relógio do aparelho). */
  at: number;
  /** Uma mutação conhecida aconteceu depois da leitura: mostrar ainda pode, mas a próxima montagem relê. */
  stale: boolean;
  /** Ordem de gravação no cache (crescente); compara com `seq()` para saber se chegou depois de um momento. */
  seq: number;
}

export interface SwrStore<T> {
  get(key: string): Entry<T> | undefined;
  subscribe(key: string, cb: () => void): () => void;
  /** Lê com `fetcher` e grava. Sem `force`, junta-se à leitura em andamento da mesma chave. */
  revalidate(key: string, fetcher: () => Promise<T>, opts?: { force?: boolean }): Promise<T>;
  set(key: string, value: T): void;
  /** Altera na hora (ex.: curtida otimista) todas as entradas que passam no filtro. */
  patch(match: (v: T, key: string) => boolean, fn: (v: T) => T): void;
  /** Marca entradas como velhas (todas, ou as que passam no filtro). */
  invalidate(match?: (v: T, key: string) => boolean): void;
  clear(): void;
  seq(): number;
}

let counter = 0; // global: a sequência é comparável entre caches

export function createSwrStore<T>(): SwrStore<T> {
  const entries = new Map<string, Entry<T>>();
  const listeners = new Map<string, Set<() => void>>();
  const inflight = new Map<string, { id: number; promise: Promise<T> }>();
  const latest = new Map<string, number>();
  const notify = (key: string) => listeners.get(key)?.forEach((cb) => cb());
  const write = (key: string, value: T) => {
    entries.set(key, { value, at: Date.now(), stale: false, seq: ++counter });
    notify(key);
  };

  return {
    get: (key) => entries.get(key),
    subscribe(key, cb) {
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(cb);
      return () => {
        set.delete(cb);
        if (!set.size) listeners.delete(key);
      };
    },
    revalidate(key, fetcher, opts) {
      const running = inflight.get(key);
      if (running && !opts?.force) return running.promise;
      const id = ++counter;
      latest.set(key, id);
      const promise = fetcher().then(
        (value) => {
          if (latest.get(key) === id) write(key, value); // uma leitura mais nova (force) já foi pedida: esta não sobrescreve
          return value;
        },
      ).finally(() => {
        if (inflight.get(key)?.id === id) inflight.delete(key);
      });
      inflight.set(key, { id, promise });
      return promise;
    },
    set: write,
    patch(match, fn) {
      for (const [key, e] of entries) {
        if (!match(e.value, key)) continue;
        entries.set(key, { ...e, value: fn(e.value), seq: ++counter });
        notify(key);
      }
    },
    invalidate(match) {
      for (const [key, e] of entries) {
        if (match && !match(e.value, key)) continue;
        entries.set(key, { ...e, stale: true });
        notify(key);
      }
    },
    clear() {
      const keys = [...entries.keys()];
      entries.clear();
      inflight.clear();
      latest.clear();
      keys.forEach(notify);
    },
    seq: () => counter,
  };
}

const registry = new WeakMap<object, Map<string, SwrStore<unknown>>>();

/** O cache `name` desta instância de repositórios (criado na primeira vez). */
export function storeFor<T>(repos: object, name: string): SwrStore<T> {
  let byName = registry.get(repos);
  if (!byName) registry.set(repos, (byName = new Map()));
  let s = byName.get(name);
  if (!s) byName.set(name, (s = createSwrStore<unknown>()));
  return s as SwrStore<T>;
}

/** Logout / troca de pessoa: nada do que a pessoa anterior viu continua na memória. */
export function clearAppData(repos: object): void {
  registry.get(repos)?.forEach((s) => s.clear());
}

/** Depois de uma mutação conhecida (postar, curtir, mudar o evento): tudo vira "velho" e a próxima tela relê. */
export function markAppDataStale(repos: object): void {
  registry.get(repos)?.forEach((s) => s.invalidate());
}
