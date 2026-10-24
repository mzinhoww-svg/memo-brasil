# Integração Mercado Pago (Checkout Pro por Preferences)

Contrato de projeto: `docs/superpowers/specs/2026-10-23-mercadopago-design.md`. Operação: `docs/supabase/PAYMENTS-RUNBOOK.md`.

- **Fluxo:** o servidor cria o pedido (preço e moeda do catálogo) → `POST /checkout/preferences` com `external_reference = id do pedido`, `notification_url`, `back_urls` fixas, expiração de 60 min, `payment_methods` sem boleto/ATM → redireciona ao Checkout Pro → retorno é só dica → o backend reconsulta o pagamento (webhook, `payments-status` e conciliação a cada 5 min) e a RPC `payments_apply_payment` decide, de forma idempotente.
- **Ambientes:** `payments_env` (desligado/sandbox/production) no banco; credenciais por ambiente (`MERCADOPAGO_ACCESS_TOKEN`, `..._SANDBOX`); em sandbox só o Master compra. O ambiente de um pagamento é decidido pela identidade do recebedor (`/users/me`, tag `test_user`): pagamentos de contas de teste voltam com `live_mode=true`.
- **Validações da RPC:** pedido da referência, recebedor, moeda BRL, valor, status; divergência nunca concede plano e marca `needs_refund`.
- **Webhook:** `payments-webhook` (sem JWT) autentica por `x-signature` (HMAC), aceita dois segredos (produção e sandbox) e sempre reconsulta o pagamento pela API.
- **Direitos:** um direito ativo por pedido (`event_entitlements`), limites reaplicados ao fechar a janela de teste.
- **Aplicações:** `1592042337972998` (em uso), `2913393311286674` (Checkout Pro, sem uso).
