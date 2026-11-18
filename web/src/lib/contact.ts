/** Contato público único (Termos, Privacidade e Ajuda). O contato oficial passará a vir de `get_public_settings()`. */
export const CONTACT_EMAIL = "mazinhoww@gmail.com";

/** WhatsApp de vendas (festas acima de 300 convidados). `NEXT_PUBLIC_SALES_WHATSAPP` troca o número sem deploy de código. */
export const DEFAULT_SALES_WHATSAPP = "5565996227110";
export const SALES_WHATSAPP_TEXT = "Olá! Minha festa tem mais de 300 convidados e quero um orçamento.";

/** Link do contato de vendas: WhatsApp com mensagem pronta; número inválido (fora de 10–15 dígitos) cai no e-mail de contato. */
export function salesContactHref(
  env: string | undefined = process.env.NEXT_PUBLIC_SALES_WHATSAPP ?? DEFAULT_SALES_WHATSAPP,
  fallbackEmail: string = CONTACT_EMAIL,
): string {
  const digits = (env ?? "").replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15) return `https://wa.me/${digits}?text=${encodeURIComponent(SALES_WHATSAPP_TEXT)}`;
  return `mailto:${fallbackEmail}?subject=${encodeURIComponent("Festa com mais de 300 convidados")}`;
}
