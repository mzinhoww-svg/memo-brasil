/**
 * Falhas simuladas para os testes de ponta a ponta (só no build de teste, em localhost): o modo local não tem rede,
 * então `window.__mmFaults = { join: "rate-limited", attach: 2 }` faz a entrada recusar uma vez e o envio de bytes
 * falhar duas vezes. Em produção a variável de build é falsa e esta função não faz nada.
 */
type Faults = { join?: "rate-limited" | "forbidden" | "unavailable"; attach?: number };

export function takeFault(name: "join"): NonNullable<Faults["join"]> | undefined;
export function takeFault(name: "attach"): boolean;
export function takeFault(name: "join" | "attach"): unknown {
  const off = name === "attach" ? false : undefined;
  if (process.env.NEXT_PUBLIC_MM_TEST_CLOCK !== "1" || typeof window === "undefined" || !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return off;
  const f = (window as unknown as { __mmFaults?: Faults }).__mmFaults;
  if (!f) return off;
  if (name === "join") {
    const v = f.join;
    f.join = undefined;
    return v;
  }
  if (!f.attach || f.attach <= 0) return false;
  f.attach -= 1;
  return true;
}
