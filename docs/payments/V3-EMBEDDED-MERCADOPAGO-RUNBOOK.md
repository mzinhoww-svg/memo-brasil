# MemoriesMT — Checkout incorporado Mercado Pago V3

Estado em 2026-10-24: **implementação em branch; NÃO ativado remotamente; NÃO homologado**.
PR: https://github.com/mzinhoww-svg/memo-brasil/pull/23
Branch: \`feat/payment-v3-appllama-mercadopago\`

## Problema resolvido no código

A jornada V3 anterior era apenas um paywall que chamava \`startCheckout()\` e \`goToCheckout(checkoutUrl)\`, indo para o Checkout Pro hospedado. A nova rota padrão \`/painel/[id]/plano\` usa \`V3PaymentJourney\` e \`EmbeddedPaymentCheckout\`, com \`Payment Brick\` oficial do SDK JS v2 dentro do MemoriesMT. Pix mostra QR Code e copia-e-cola na própria página; cartão é tokenizado pelo SDK Mercado Pago. O usuário não digita PAN ou CVV em inputs controlados pelo MemoriesMT. O caminho antigo \`payments-checkout\` fica intacto no repositório e no backend para pedidos já existentes.

## Mudanças de código

- \`web/src/app/painel/[id]/plano/page.tsx\` agora abre V3 diretamente.
- \`web/src/features/billing/V3PaymentJourney.tsx\`: recomendação contextual, catálogo real e cotação.
- \`web/src/features/billing/EmbeddedPaymentCheckout.tsx\`: SDK JS, Pix QR, polling, confirmação, falhas.
- \`web/src/features/billing/embedded.ts\`: cliente de \`payments-embedded\`, sem chave privada.
- \`supabase/functions/payments-embedded/index.ts\`: auth real, verificação de host via \`payments_open_order\`, método reservado no banco, API \`/v1/payments\`, reconciliação e recuperação Pix para o titular.
- \`supabase/functions/_shared/mercadopago.ts\`: POST /v1/payments com \`X-Idempotency-Key=orderId\`, sem preço ou e-mail controlados pelo browser.
- \`supabase/migrations/20261024000300_payments_embedded.sql\`: bloqueio de corrida entre os modos, reserva do método e encerramento de tentativas recusadas.
- Testes: \`embedded.test.ts\`, \`embedded-client.test.ts\`, \`v3-plan.test.ts\`.

## Autoridade financeira

O único preço autoritativo vem de \`payments_quote\` e \`payments_open_order\`. O backend ignora \`formData.transaction_amount\`, ignora e-mail do browser, exige login Google com e-mail verificado, distingue sandbox/produção, consulta pagamento no provedor e só então usa \`payments_apply_payment\`. A RPC existente ainda verifica \`external_reference\`, valor BRL, collector_id, live_mode, saldo, duplicatas, status, estornos e direitos comerciais. O browser não marca a compra como paga.

O catálogo remoto, na data da análise, trazia \`grande\` (500 pessoas; R$349) como plano adequado a 272 convidados. "Premium" é apenas linguagem visual da oferta.

## Configuração para homologação, NÃO feita ainda

1. Testar a migration e RPCs em Supabase local usando o runbook e a suite pgTAP. Não aplicar cegamente em produção.
2. Configurar no Supabase Edge Secrets (sem colar valores em Git, Markdown, chat ou Vercel):
   - \`MERCADOPAGO_PUBLIC_KEY_SANDBOX\` = chave pública da **mesma aplicação** e conta vendedora usadas pelo token sandbox existente;
   - \`MERCADOPAGO_PUBLIC_KEY\` = chave pública da mesma aplicação vendedora do token de produção existente;
   - \`PAYMENTS_EMBEDDED_ENABLED=true\` **somente após** a validação do ambiente sandbox.
   - Manter \`PAYMENTS_EMBEDDED_PRODUCTION_ENABLED\` ausente ou \`false\` até aceite financeiro explícito.
3. Confirmar o token Mercado Pago correspondente ao mesmo par de public key, país BR, webhook payments-webhook, chave Pix do vendedor e conta pagadora de teste **distinta** da vendedora. Não trocar credenciais/tokens atuais.
4. Aplicar migration mediante revisão de rollback e backup, depois publicar \`payments-embedded\` com JWT obrigatório. Nunca substituir \`payments-checkout\` ou \`payments-webhook\`.
5. Com \`payments_env='sandbox'\`, teste integrado restrito ao Master. Em ambiente production, Checkout incorporado permanece desabilitado até a aprovação explícita e a segunda flag. **Hoje payments_env reportou production**, então testar sandbox demanda um ambiente/clonagem seguro, não alternar produção livremente.
6. Concluir o E2E (pagamento aprovado/pendente/recusado, prova webhook/status, Pix expiração, cartão 3DS quando exigido, duplicatas, upgrade, reembolso, disputa, mobile Safari/Chrome, volta à galeria e concessão de quota).
7. Registrar prova auditável por pedido/ID mascarado, Vercel SHA, ambiente, banco, migrations e webhook. Somente então discutir ativação em produção.

## Limitações atuais

- Nenhuma migration foi aplicada remotamente nesta rodada.
- \`payments-embedded\` ainda não foi publicada no Supabase remoto; o frontend deve mostrar "checkout incorporado ainda não habilitado" e NÃO retornar ao checkout antigo.
- O Vercel da equipe atingiu \`build-rate-limit\` nos commits recentes; **não há novo preview READY da versão incorporada**.
- Os testes adicionados são código de teste, não resultado de execução. Sem logs de CI e E2E comprovados, o estado continua NO-GO.
- O novo fluxo do cartão pode exigir 3DS, o que precisará ser tratado/homologado conforme Mercado Pago.
- O código integrado usa SDK Payment Brick externo oficial, não captura cartão por campos customizados da nossa aplicação.

## Critérios GO

- npm ci/typecheck/lint/test/build sem erro para SHA final; screenshot e navegação mobile/desktop.
- Testes de RLS e RPC cobrindo guest/anon/organizador/master e tentativas concorrentes.
- Pix real em sandbox com QR e copiável sem navegação externa, e pagamento confirmado sem duplicidade.
- Cartão tokenizado em ambiente de teste com falha, aprovação, 3DS aplicável e idempotência.
- Retorno, recarga, polling, status, evento e limites conforme webhook e consulta ao provedor.
- Ativação de flags apenas no ambiente planejado e promoção com rollback documentado.
- Crédito ao consumidor apenas após confirmação auditável no banco.

**GO/NO-GO hoje: NO-GO. Nenhuma cobrança real foi criada nesta tarefa.**
