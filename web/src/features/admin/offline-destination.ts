/** O fallback do SW mantém a URL da navegação que falhou. Só aceita destinos internos. */
export function offlineDestination(href: string): string {
  const url = new URL(href);
  const candidate = url.pathname === '/offline' ? url.searchParams.get('from') ?? '/' : url.pathname + url.search + url.hash;
  if (!candidate.startsWith('/') || candidate.startsWith('//') || /[\\\u0000-\u001f]/.test(candidate)) return '/';
  const target = new URL(candidate, url.origin);
  if (target.origin !== url.origin || target.pathname === '/offline') return '/';
  return target.pathname + target.search + target.hash;
}
