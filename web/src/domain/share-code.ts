export const SHARE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sem 0, O, 1, I, L (REA E-07)
export const SHARE_CODE_LENGTH = 8;

/** Gera código de 8 caracteres. `rng` devolve [0,1); por padrão usa crypto. */
export function generateShareCode(rng?: () => number): string {
  const pick = rng ?? (() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
  let out = "";
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) out += SHARE_CODE_ALPHABET[Math.floor(pick() * SHARE_CODE_ALPHABET.length)];
  return out;
}

const VALID = new RegExp(`^[${SHARE_CODE_ALPHABET}]{${SHARE_CODE_LENGTH}}$`);

/** Maiúsculas, sem espaços/hífens. Devolve null se não for um código válido. */
export function normalizeShareCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "");
  return VALID.test(s) ? s : null;
}

/** Aceita código puro, link completo (`/e/CODE`) ou caminho relativo. */
export function extractShareCode(input: string): string | null {
  const direct = normalizeShareCode(input);
  if (direct) return direct;
  const m = input.match(/\/e\/([^/?#\s]+)/i) ?? input.match(/\/([A-Za-z0-9]{8})(?:[/?#]|$)/);
  return m ? normalizeShareCode(m[1]) : null;
}
