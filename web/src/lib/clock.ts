/**
 * Relógio da aplicação. Em builds de teste (NEXT_PUBLIC_MM_TEST_CLOCK=1) aceita `?agora=<epoch ms>`
 * para simular o fim/revelação nos testes E2E. Em produção sempre devolve Date.now().
 */
export function now(): number {
  if (process.env.NEXT_PUBLIC_MM_TEST_CLOCK === "1" && typeof window !== "undefined") {
    const raw = window.sessionStorage.getItem("mm-agora") ?? new URLSearchParams(window.location.search).get("agora");
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n)) {
      window.sessionStorage.setItem("mm-agora", String(n));
      return n;
    }
  }
  return Date.now();
}
