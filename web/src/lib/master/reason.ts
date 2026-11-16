/** Motivo das ações sensíveis do Master (10 a 500 caracteres; o servidor confere de novo, MM011) e a tradução dos erros das RPCs. */
export const REASON_MIN = 10;
export const REASON_MAX = 500;

/** Tamanho que vale para o servidor: o texto sem espaços nas pontas. */
export const reasonLength = (reason: string): number => reason.trim().length;
export const reasonValid = (reason: string): boolean => {
  const n = reasonLength(reason);
  return n >= REASON_MIN && n <= REASON_MAX;
};

/** Mensagem de erro do motivo ou null quando válido. */
export function reasonError(reason: string): string | null {
  const n = reasonLength(reason);
  if (n < REASON_MIN) return `Escreva o motivo com pelo menos ${REASON_MIN} caracteres.`;
  if (n > REASON_MAX) return `O motivo pode ter no máximo ${REASON_MAX} caracteres.`;
  return null;
}

/** Tradução dos erros das RPCs/função para o operador. */
export function adminErrorText(code: string | undefined, message: string): string {
  if (code === "MM011" || /reasonrequired/.test(message)) return `Escreva o motivo com ${REASON_MIN} a ${REASON_MAX} caracteres.`;
  if (code === "MM004" || /forbidden/.test(message)) return "Sem permissão para esta ação.";
  if (code === "MM008" || /revealed/.test(message)) return "Este evento já foi revelado.";
  if (code === "MM005" || /invalid/.test(message)) return "Ação recusada pelo servidor: confira os dados e o estado atual.";
  return "Não foi possível concluir. Tente de novo.";
}
