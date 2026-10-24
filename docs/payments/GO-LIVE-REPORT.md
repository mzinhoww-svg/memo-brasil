# Relatório de go-live: Mercado Pago no MemoriesMT (2026-10-24)

## A. Resultado executivo
- **Produto (eventos, convites, fotos, planos grátis): GO**, em produção e estável.
- **Cobrança de produção: NO-GO.** `payments_env = 'desligado'`. Não há ressalva "não bloqueante": os itens abertos abaixo impedem a ativação legítima. Nada foi marcado como aprovado sem evidência.

## B. Integração e arquitetura (decisão com evidência)
- **Escolhida: A, manter Checkout Pro por Preferences/Payments API.** Já comprovada ponta a ponta no sandbox (pagamento aprovado, conciliado, plano liberado uma única vez, retorno e Master verificados).
- Descartadas B/C (migrar para Orders): a medição oficial de qualidade do Checkout Pro Orders usa `order_id` de teste dos últimos 7 dias, mas exigiria reescrever checkout, webhook, conciliação e reembolso, com risco financeiro e sem garantia de homologação; a criação do vendedor de teste da aplicação de Orders ainda falha (`MP_API_DOWN`). Reavaliar só se o Mercado Pago passar a exigir Orders para ativação.
- **Aplicação em uso:** `1592042337972998` (dona 3786909683; produto "Checkout Transparente", aceita preferências do Checkout Pro). Aplicação extra `2913393311286674` (Checkout Pro) criada, **sem uso**: produção não ativada e sem vendedor de teste. Sandbox: vendedor de teste `3786688395`, comprador `3790697518`.
- Credenciais por ambiente isoladas (`MERCADOPAGO_ACCESS_TOKEN` produção; `MERCADOPAGO_ACCESS_TOKEN_SANDBOX` teste); recebedor decide o ambiente (conta de teste nunca concede produção).

## C. Homologação
| Item | Resultado |
|---|---|
| Cartão aprovado (sandbox oficial) | **Aprovado e conciliado**: pedido `235e0088…` pago, pagamento `184803988907`, plano Festa, evento 30/24, direito único |
| Conciliação repetida / idempotência | **Provada** no remoto (3 rodadas, 1 cobrança, 1 evento, 1 direito) |
| Retorno `?retorno=sucesso` | **Provado**: backend confirma, URL limpa |
| Liberação só após backend | **Provada** (pedido com `live_mode` divergente foi barrado; depois corrigido pela identidade do recebedor) |
| Cartão recusado / pendente / expirado / cancelado (sandbox oficial) | **Não executado no Mercado Pago**: exige digitar cartão de teste na página hospedada, o que a política de segurança do ambiente de execução proíbe ao agente. Cobertos por testes locais com fake (E2E/vitest/pgTAP) |
| Webhook | **Não comprovado**: nenhum evento de webhook gravado; o pagamento foi aplicado pela conciliação. Falta log da function e segredo de assinatura de sandbox |
| Reembolso de teste | **Não confirmado**: Mercado Pago responde 401 (`Unauthorized use of live credentials`, limitação para pagamentos de conta de teste); pagamento segue `approved`, 0 reembolsado (consultado pela API) |
| Pix | **Não testável no sandbox** (documentação); exige chave Pix na conta recebedora |
| Avaliação oficial de qualidade | **Não executável agora**: para Preferences exige `payment_id` **produtivo** (pagamento real); a medição automática é mensal |

## D. Engenharia (commits principais em `feat/mercadopago`)
Credenciais por ambiente, sandbox restrito ao Master, `payer.email` só em produção, boleto/ATM excluídos, campos de qualidade na preferência, `effectiveLiveMode`, jornada mobile (`CheckoutBridge`, resumo, CTA fixo, aviso de rede), rótulo de cartão por bandeira, diagnóstico Master (`testUser`, consulta de pagamento), reembolso expõe tipo/status do provedor. **PAY-001 a PAY-005: DONE** (pgTAP 1120/1120 em Postgres real; PAY-004 também verificado no remoto).

## E. Produção
- Front: `https://newmemocuiaba.vercel.app` → `dpl_4bsUbpqdG4HqMcCQBvUpYU2fkDCQ`, `db9cbce` (anterior `dpl_58KzqgGh…`/`cf47ac9`). Functions `payments-*` publicadas (v8+). `payments_env=desligado`, janela sandbox fechada.
- Credenciais de produção cadastradas no Supabase (conta real, `testUser=false`), nunca usadas em teste.

## F. Pendências (somente impedimentos reais)
**Externos / provedor ou titular**
1. Webhook de produção/sandbox: ver log do `payments-webhook` e segredo de assinatura (`MERCADOPAGO_WEBHOOK_SECRET[_SANDBOX]`) no painel do Mercado Pago (exige o titular).
2. Reembolso confirmado: só possível com pagamento real (titular) ou com credenciais que o provedor aceite para teste.
3. Avaliação oficial de qualidade: depende de um pagamento produtivo legítimo.
4. Chave Pix na conta recebedora; ativação das credenciais de produção da app `2913393311286674` (se for adotada).
5. Dados comerciais: razão social, CNPJ, contato de suporte, regras D3/D5/D6 (não inventados).
**Do ambiente de execução**
6. Digitar cartão de teste em páginas hospedadas é vedado ao agente; os cenários negativos do sandbox oficial exigem outra via (ex.: um teste por um humano ou um provedor de execução com essa permissão).

## G. Evidências
Runbook `docs/supabase/PAYMENTS-RUNBOOK.md` §16 a §19; `docs/payments/QA-EVIDENCE.md`; backlog (`PAY-MP-*`, `PAY-MOB-*`); capturas `docs/evidence/pagamento-mobile/`.
