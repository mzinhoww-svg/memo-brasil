/** E-mail técnico do link de volta do WhatsApp (convidado sem e-mail): nunca aparece na tela nem é usado como contato. */
export const isTechnicalEmail = (email: string | null | undefined): boolean => typeof email === "string" && /@retorno\.invalid$/i.test(email);
export const visibleEmail = (email: string | null | undefined): string | undefined => (email && !isTechnicalEmail(email) ? email : undefined);
