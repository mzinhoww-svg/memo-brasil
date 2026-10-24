/** Navegação de página inteira para o Checkout Pro do Mercado Pago. Isolada para ser trocada nos testes. */
export function goToCheckout(url: string): void {
  window.location.assign(url);
}
