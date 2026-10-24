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

## Webhook e reembolso: verificação de 2026-10-24 (rodada seguinte)

**Webhook.** O que se verificou com os acessos disponíveis:
- `payment_events` não tem nenhuma linha de webhook (só `apply.reconcile`). A função grava o evento só depois de validar a assinatura; assinatura inválida responde 401 sem tocar no banco. Logo, "nenhuma linha" não distingue "não entregue" de "entregue com assinatura recusada".
- Endpoint alcançável: POST sem assinatura responde 401 (probe de hoje).
- `notifications_history` (MCP) devolve vazio para a aplicação `1592042337972998`; para a aplicação de teste do vendedor `4326309413049449` devolve "OAuth ownership validation failed" (a aplicação pertence à conta de teste, não ao OAuth do MCP).
- Log da Function: `query_logs` do conector Supabase recusa com "You do not have permission to perform this action" (restrição explícita do conector; não contornada).
- Explicação provável, pela documentação oficial: a URL do modo teste serve ao teste com "credenciais de teste de usuários produtivos"; o pagamento da homologação foi feito na conta do **vendedor de teste** `3786688395`, cuja aplicação (`4326309413049449`) tem webhook e segredo próprios, que o agente não consegue configurar (conta de teste, outro dono). Portanto a ausência de entrega no sandbox **não prova** defeito do webhook, e o sandbox também não o prova. O webhook de produção só se comprova na compra controlada (`LAUNCH-CRITERIA.md`, critério A).
- Segredo: `MERCADOPAGO_WEBHOOK_SECRET` está cadastrado (só o nome foi conferido; valor não lido). Nada foi pedido, regenerado ou exposto.

**Reembolso.**
- Implementação conferida contra a referência: `POST /v1/payments/{id}/refunds`, `X-Idempotency-Key`, corpo vazio (total), credencial = a do ambiente do pedido (sandbox), recebedor do pagamento `3786688395` = dono da credencial, `testUser:true`.
- Pagamento: `approved`, `collector_id=3786688395`, `refunded_cents=0`, pedido `pago`. A API do Mercado Pago devolve `live_mode=true` para pagamentos de contas de teste; o banco guarda o `live_mode` efetivo (`false`) pela regra `withEffectiveLiveMode`.
- A documentação de reembolsos consultada não descreve reembolso de pagamentos de usuários de teste nem o erro "Unauthorized use of live credentials".
- **Causa não comprovada.** Nenhuma falha de implementação ou de configuração foi encontrada; nada foi alterado no código. Não se declara que o provedor "não suporta" reembolso em sandbox: declara-se que não foi provado e que o reembolso real é verificado na compra controlada (critério A3 de `LAUNCH-CRITERIA.md`).

**D3/D5/D6 (conteúdo exato que falta, já definido no backlog `PAY-OPS-005`).**
- D3: reembolso/arrependimento (CDC art. 49): prazo, quem pode pedir, se o plano já usado é reembolsável, e o texto nos Termos.
- D5: razão social, CNPJ (rodapé e `/ajuda`), contatos de suporte. **Contato já fornecido:** `mazinhoww@gmail.com`, gravado em `support_email` por `supabase/ops/payments_support_contact.sql`. Faltam razão social, CNPJ e, opcional, telefone.
- D6: NFS-e e regime fiscal.
- Revisão jurídica dos Termos/Política versão `2026-10-22-v1`.

**Pix.** A documentação oficial diz que a opção Pix só aparece com chave Pix cadastrada no Mercado Pago. Não há API pública disponível ao agente que liste chaves Pix; criar uma cobrança Pix para testar geraria cobrança real. Fica pendente a confirmação no app do Mercado Pago e uma cobrança Pix real depois da compra controlada. O Pix não paga no sandbox.

## Botão "Pagar" bloqueado no Checkout Pro (2026-10-24): causa comprovada

**Sintoma.** Tela "Revise os dados antes de pagar" com o botão Pagar desabilitado (cadeado), sem mensagem, nos planos Festa (R$ 29) e Teste R$ 1.

**Evidência (browser, somente leitura, sem pagar e sem digitar dados):**
- A integração está correta até o Mercado Pago: o pedido de produção `86a514f3…` tem preferência `3786909683-…`, `checkout_url` em `www.mercadopago.com.br`, R$ 1,00, validade de 1 h; o link abre as telas "Escolha como pagar" e "Revise os dados".
- Na tela de revisão `Pagar` está `disabled`. Trocando a forma para **Pix** o botão `Gerar código` também fica `disabled`. Logo o bloqueio **não é do cartão nem de CVV** (não há iframe nem campo de CVV na página, e o console não tem erro).
- O estado da própria página do Mercado Pago traz `userId = 3786909683` e `payer_id = 3786909683`. O prefixo do `pref_id` (collector) é `3786909683` e é a conta dona das aplicações. **O comprador logado é a própria conta recebedora.**

**Causa.** Pagador = recebedor. O Mercado Pago desabilita Pagar e Gerar código nesse caso, sem exibir mensagem. Não é falha da integração, do valor, do plano nem do evento (por isso criar outro evento ou trocar o valor não resolve). Nada no projeto contorna esse controle e nenhuma tentativa foi feita de habilitar o botão.

**O que continua não provado.** O Mercado Pago não publica essa regra na documentação consultada; a atribuição vem da correspondência exata dos ids acima mais o bloqueio de ambos os meios. A prova final é um pagamento aprovado por comprador distinto.

**Como retomar (instrução ao titular).** Abra o link do pedido em janela anônima (sem login no Mercado Pago) e pague como visitante com cartão ou Pix, ou entre com **outra** conta do Mercado Pago. Não entre com a conta recebedora. Depois do pagamento, confira: pedido `pago`, 1 cobrança `approved`, 1 direito, e se há linha de webhook (`payment:*`, `aplicado`) ou apenas conciliação (`apply.reconcile`).

**Backlog.** PAY-MP-011 (IN_REVIEW até a compra por comprador distinto). Compra produtiva controlada continua pendente.

## Duas tentativas recusadas em produção (2026-10-24 16:40Z): causa documentada e verificação do backend

**Transações (consulta oficial pela API, via `payments-diagnose` Master, sem expor token):**

| Pagamento | Meio | status | status_detail | env | collector | pagador = recebedor | amount | referência (pedido) |
|---|---|---|---|---|---|---|---|---|
| `184864803413` | Pix | `rejected` | `rejected_high_risk` | produção (`live_mode` true) | `3786909683` | **não** | R$ 1,00 BRL | `0c665ac5…` |
| `185906847586` | Cartão (Mastercard) | `rejected` | `cc_rejected_high_risk` | produção (`live_mode` true) | `3786909683` | **não** | R$ 1,00 BRL | `0c665ac5…` |

**Causa documentada.** Nas duas tentativas a recusa é de **prevenção a fraude do Mercado Pago** (`*_rejected_high_risk`; documentação "Por que um pagamento é recusado?", seção "Recusas por prevenção contra fraudes"). A documentação acrescenta que `cc_rejected_high_risk` pode ocorrer quando dois pagamentos consecutivos usam itens e `payer` muito semelhantes (a segunda tentativa veio ~1 minuto depois da primeira) e que os pagamentos seguintes podem ficar temporariamente bloqueados; recomenda evitar novas tentativas imediatas com os mesmos dados. **A razão interna do score de risco não é exposta pela API**; saber por que a primeira tentativa (Pix) foi classificada como risco exige o Mercado Pago. O diagnóstico anterior (pagador = recebedor) explicava o botão desabilitado na sessão logada; **não** explica estas duas recusas, porque nestas `payerIsCollector` é falso.

**Backend (verificado no banco):**
- Os dois pagamentos foram registrados como cobranças `role=attempt`, `status=rejected`, produção, collector correto, R$ 1,00, ligadas ao pedido `0c665ac5…`.
- **Webhook comprovado em produção:** `payment_events` tem `payment:payment.created` (16:40:04Z e 16:41:11Z) seguidos de `apply.webhook` com `outcome=tentativa_recusada`. Essas linhas só existem depois de assinatura válida do `MERCADOPAGO_WEBHOOK_SECRET`, logo a entrega autenticada e o processamento estão provados para esses eventos. Ainda **não** há webhook de um pagamento aprovado.
- O pedido ficou `pendente`, sem `needs_refund`, sem `mp_payment_id` e **nenhum direito foi concedido** (o único direito ativo pago continua o do sandbox `235e0088…`). Nada foi cobrado.

**Correção na integração (lacuna comprovada).** O código descartava `status_detail` e não dava como saber o motivo da recusa. `normalizePayment` agora expõe `statusDetail` e `payerIsCollector` (só o booleano; o id do pagador nunca sai) e o `payments-diagnose` os devolve na consulta `{paymentId}`. Teste: `mercadopago.test.ts` (RED→GREEN), functions 122/122, `deno check` ok; `payments-diagnose` publicada. Não foi alterada a gravação em `payment_events` (guardar `status_detail` ali exige migration; fica no backlog PAY-MP-012).

**Restrição da conta recebedora.** A API não mostra nenhuma restrição da conta recebedora; o que se observa é recusa por risco. A exigência exata e a solução oficial dependem do Mercado Pago (suporte do desenvolvedor), com os dois `payment_id` acima. Pedido pronto para o suporte (a enviar pelo titular):

> "Conta 3786909683 (produção). Os pagamentos 184864803413 (Pix, rejected_high_risk) e 185906847586 (cartão, cc_rejected_high_risk), de R$ 1,00, referência 0c665ac5-4e7d-41e0-a5fd-a7eb9836c607, foram recusados por risco. Preciso saber o motivo, se há restrição na conta recebedora ou nas credenciais de produção e o que fazer para liberar os recebimentos. A integração é Checkout Pro (preferências), notification_url configurada, itens com category_id e description."

**Pagamentos continuam NO-GO** até haver uma compra aprovada, a liberação correta do plano (uma única vez) e, de preferência, webhook de um pagamento aprovado. Não repetir tentativas agora (a documentação alerta para bloqueio temporário por tentativas consecutivas semelhantes).
