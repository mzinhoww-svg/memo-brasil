/**
 * Ponte de abertura/retorno do Checkout Pro do Mercado Pago.
 *
 * Web: navegação de página inteira (sem pop-up, o fluxo recomendado para mobile) e retomada por `pageshow`
 * (voltar do Mercado Pago via bfcache) e `visibilitychange` (voltar do app do banco ou de outra aba).
 * App nativo (iOS/Android, ainda não implementado): troque a ponte por uma que abra o checkout num navegador do sistema
 * (Custom Tabs / ASWebAuthenticationSession) e dispare `onResume` no ciclo de vida do app e ao receber o deep link de
 * retorno. A UI não muda: o estado do pedido sempre vem do servidor. Ver docs/design/PAGAMENTO-MOBILE-NATIVO.md.
 */
export interface CheckoutBridge {
  /** Abre o Checkout Pro. */
  open(url: string): void;
  /** Registra um callback para quando o usuário volta ao app/página. Devolve a função que cancela o registro. */
  resumeEvents(onResume: () => void): () => void;
}

export const webCheckoutBridge: CheckoutBridge = {
  open(url) {
    window.location.assign(url);
  },
  resumeEvents(onResume) {
    const onPageShow = (e: Event) => { if ((e as PageTransitionEvent).persisted) onResume(); };
    const onVisibility = () => { if (document.visibilityState === "visible") onResume(); };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  },
};

let current: CheckoutBridge = webCheckoutBridge;
export const setCheckoutBridge = (b: CheckoutBridge): void => { current = b; };
export const getCheckoutBridge = (): CheckoutBridge => current;

/** Mantida por compatibilidade: abre o checkout pela ponte atual. */
export function goToCheckout(url: string): void {
  current.open(url);
}
