/**
 * Tempo limite nas chamadas do navegador ao Supabase: sem isso, uma rede que trava (festa com sinal ruim) deixa o envio
 * pendurado para sempre. 15 s para RPC/REST/Auth e 60 s para o Storage (upload da foto). Estourou o prazo, a falha
 * vira um `TypeError` igual ao de rede caída, que os adaptadores já traduzem para `unavailable` (tentar de novo).
 */
export const REST_TIMEOUT_MS = 15_000;
export const STORAGE_TIMEOUT_MS = 60_000;

const urlOf = (input: RequestInfo | URL): string => (typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

export function timeoutFor(input: RequestInfo | URL): number {
  return urlOf(input).includes("/storage/v1/") ? STORAGE_TIMEOUT_MS : REST_TIMEOUT_MS;
}

export function timedFetch(base: typeof fetch = (...a) => fetch(...a)): typeof fetch {
  return async (input, init) => {
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(new DOMException("tempo esgotado", "TimeoutError")); }, timeoutFor(input));
    const outer = init?.signal;
    const relay = () => ctrl.abort(outer?.reason);
    if (outer?.aborted) relay(); else outer?.addEventListener("abort", relay, { once: true });
    try {
      return await base(input, { ...init, signal: ctrl.signal });
    } catch (e) {
      if (timedOut) throw new TypeError("Failed to fetch (tempo esgotado)");
      throw e;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", relay);
    }
  };
}
