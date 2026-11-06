import type { ValidaPayEnvironment } from "./validapay-client";
import { centsToReais } from "../../../../supabase/functions/_shared/payment-money";

export type SandboxCard = { number: string; holderName: string; cvv: string; expiration: string };
export type SandboxCustomer = { name: string; email: string; document: string; phone: string;
  address: { zipCode: string; street: string; number: string; neighborhood: string; city: string; state: string } };

/** Ephemeral browser values only. Environment comes from trusted server configuration. */
export async function prepareCard(config: { publicId: string; environment: ValidaPayEnvironment }, amountCents: number, card: SandboxCard, customer: SandboxCustomer) {
  const { publicId, environment } = config;
  if (environment !== "sandbox" && environment !== "production") throw new Error("Ambiente de pagamento indisponível.");
  const match = /^(0[1-9]|1[0-2])\/(20\d{2})$/.exec(card.expiration);
  const now = new Date();
  let sum = 0, double = false;
  for (let i = card.number.length - 1; i >= 0; i--) {
    let n = Number(card.number[i]);
    if (double) { n *= 2; if (n > 9) n -= 9; }
    sum += n; double = !double;
  }
  if (!publicId || !/^\d{13,19}$/.test(card.number) || sum % 10 !== 0 || !/^\d{3,4}$/.test(card.cvv) || card.holderName.trim().length < 2 ||
    !match || Number(match[2]) * 12 + Number(match[1]) < now.getFullYear() * 12 + now.getMonth() + 1 ||
    !customer.name || !customer.email || !/^(\d{11}|\d{14})$/.test(customer.document) || !/^\d{10,13}$/.test(customer.phone) ||
    !customer.address || Object.values(customer.address).some((v) => !v.trim())) throw new Error("Confira os dados do cartão e do comprador.");
  const amount = Number(centsToReais(amountCents));
  const [{ collectDevice, tokenize }, { authenticate }] = await Promise.all([import("@validapay/tokenize/browser"), import("@validapay/3ds")]);
  const { deviceId } = await collectDevice({ publicId, environment });
  if (!deviceId) throw new Error("Não foi possível identificar este dispositivo.");
  const authentication = await authenticate({ publicId, environment, amount, card, customer, statementDescriptor: "MemoriesMT" });
  if (!authentication?.authenticationId || !authentication.cardId) throw new Error("A autenticação do banco não está disponível. Tente mais tarde.");
  const token = await tokenize({ publicId, environment, card, customer, authentication });
  if (!/^ctk_[A-Za-z0-9_-]+$/.test(token.cardToken)) throw new Error("Não foi possível proteger os dados do cartão.");
  return { cardToken: token.cardToken, deviceId, authentication: { authenticationId: authentication.authenticationId, cardId: authentication.cardId } };
}

/** Compatibility entry point: sandbox callers never fall back to production. */
export function prepareSandboxCard(publicId: string, amountCents: number, card: SandboxCard, customer: SandboxCustomer) {
  return prepareCard({ publicId, environment: "sandbox" }, amountCents, card, customer);
}
