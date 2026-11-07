/** Destinos OAuth só podem permanecer no site, inclusive após decodificação. */
export function safeNextPath(value: string | null): string {
  const original = value ?? "/";
  let decoded = original;
  for (;;) {
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return "/";
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return original;
      decoded = next;
    } catch { return "/"; }
  }
}
