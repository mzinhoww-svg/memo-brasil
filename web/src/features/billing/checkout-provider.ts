/** Public build flags select the same checkout in the wizard and event panel. */
export function validapayCheckoutEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VALIDAPAY_CHECKOUT === "1" || process.env.NEXT_PUBLIC_VALIDAPAY_SANDBOX_PREVIEW === "1";
}
