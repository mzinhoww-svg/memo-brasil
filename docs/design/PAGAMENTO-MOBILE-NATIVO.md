# Jornada de pagamento no celular e adaptação para iOS/Android

Escopo: plano → resumo → Checkout Pro do Mercado Pago → retorno → liberação. Estratégia de checkout inalterada: **Checkout Pro por redirecionamento** (sem formulário próprio de cartão, sem segundo checkout, sem pop-up).

## O que a web faz hoje
- **Resumo antes de pagar** (`resumo-pedido`): plano, total e "pagamento único, sem assinatura"; botão `Pagar com Mercado Pago · R$ …`, com estado `Abrindo o Mercado Pago…` (`aria-busy`) e proteção contra clique duplo (`inflight` + idempotência de pedido).
- **Abertura**: navegação de página inteira por `CheckoutBridge.open` (sem `window.open`, que o mobile bloqueia).
- **Retorno**: `back_urls` fixas (`?retorno=sucesso|pendente|falha`) só mudam o texto; **a liberação depende do backend** (webhook + conciliação + reconsulta do status).
- **Recuperação**: abrir o plano de novo mostra o pedido aberto com "Continuar para o Mercado Pago" (um pedido aberto por evento; nada duplica).
- **Rede**: 3 consultas seguidas falhando mostram aviso com "Atualizar"; pedido sem link ainda mostra "Atualizar"; ao voltar à página (`visibilitychange`, `pageshow` do bfcache) o status é consultado na hora; nunca há carregamento sem saída.
- **Layout**: botão fixo na base em telas < 900 px, com `env(safe-area-inset-bottom)`; alvos ≥ 44 px; sem rolagem lateral em 360/390/430 px.

## Pontos de adaptação nativa (não implementados)
`web/src/features/billing/checkout-nav.ts` define `CheckoutBridge { open(url); resumeEvents(cb) }`. Um app (por exemplo Capacitor) chama `setCheckoutBridge(...)` com uma ponte própria:
- `open(url)`: abrir o Checkout Pro no navegador do sistema (Android Custom Tabs, iOS `SFSafariViewController`/`ASWebAuthenticationSession`), não numa WebView sem barra de endereço.
- `resumeEvents(cb)`: chamar `cb` no retorno do app para primeiro plano (`appStateChange`) e ao receber o deep link de retorno.
- **Retorno**: as `back_urls` hoje são `https://<domínio>/painel/<evento>/plano?retorno=…`. No app, configurar Universal Links (iOS) / App Links (Android) para esse domínio, ou um esquema próprio, devolvendo à mesma tela. O deep link continua sendo só uma dica; o estado vem do servidor.
- **Pix no mesmo celular**: o Checkout Pro mostra o código "copia e cola" e o app do banco abre pela própria página do Mercado Pago; a volta ao MemoriesMT é manual ou pelo botão da página. Nada depende de escanear QR no mesmo aparelho.

## O que NÃO está provado (não declarar como feito)
| Item | Situação |
|---|---|
| Layout 360/390/430 px | **Emulação** no Chromium (Playwright) com backend simulado; capturas em `docs/evidence/pagamento-mobile/`. Não é aparelho físico. |
| Teclado aberto | **Não provado**: a emulação não reduz a viewport de layout como um teclado real. Verificar em aparelho. |
| Checkout Pro real no celular (Safari/Chrome), saída para app do banco e retorno | **Não executado** em aparelho físico. |
| Pix | **Sandbox não paga Pix** (documentação oficial). Exige chave Pix cadastrada na conta recebedora; sem ela o Mercado Pago não oferece Pix. Só validável em produção com valor real. |
| Cartão aprovado/recusado/pendente (APRO/OTHE/CONT) | Fluxo preparado; **depende de um comprador de teste logado** (ver runbook §17). Sandbox oficial ainda sem pagamento aprovado. |
| App iOS/Android | **Não existe**. Compatibilidade web não comprova compatibilidade nativa. |
| Regras das lojas (Apple/Google) | Depende de revisão: venda de serviço consumido fora do app vs. bens digitais dentro do app. Decidir antes de publicar um app com pagamento. |
