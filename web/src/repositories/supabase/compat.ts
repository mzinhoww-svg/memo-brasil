/** Compatibilidade de implantação: o front V2 pode subir antes das migrations V2. Sem `event_themes` no servidor, o app segue como V1 (sem tema personalizado). */
export function isMissingThemeSchema(err: unknown): boolean {
  const e = (err ?? {}) as { code?: string; message?: string };
  if (!e.code || !e.message) return false;
  return ["PGRST200", "PGRST205", "42P01"].includes(e.code) && /event_themes/.test(e.message);
}
