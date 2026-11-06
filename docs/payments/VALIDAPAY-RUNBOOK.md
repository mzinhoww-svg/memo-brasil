# ValidaPay — registro histórico da implementação sandbox

Este documento registra a avaliação do primeiro PR (#24). Para a preparação
posteriormente autorizada de produção, consulte [VALIDAPAY-PRODUCTION.md](VALIDAPAY-PRODUCTION.md).

## Parecer

**NO-GO para produção e para declarar homologação completa.** Não habilitar para
compradores reais nem promover este PR. Não houve deploy remoto, migration remota,
alteração financeira produtiva, reembolso real ou publicação de ambiente.

Há implementação local aditiva de Pix/cartão e evidência financeira real de
sandbox; faltam os gates abaixo. O Mercado Pago continua sendo o padrão.

## Arquitetura e arquivos

- `supabase/functions/_shared/payment-money.ts`: conversão decimal exata entre
  centavos inteiros e reais; recusa arredondamento e valores fora do inteiro SQL.
- `_shared/validapay.ts`: OAuth single-flight/cache/timeout, criação por externalId,
  rastreabilidade por externalTxid, consulta enxuta, detalhe validado e cancelamento
  após verificar o vínculo ao pedido. Nunca recebe credenciais produtivas no runtime.
- `_shared/validapay-signature.ts`: HMAC SHA-256 sobre timestamp e corpo bruto,
  janela de cinco minutos e verificação criptográfica.
- `payments-validapay`: configuração, reserva de preço, submissão, retomada,
  status e cancelamento; exige usuário real, master, flags e sandbox.
- `payments-validapay-webhook`: autentica antes de persistir somente identificadores;
  ACK após inbox durável, processamento assíncrono e reconsulta financeira.
- `payments-validapay-reconcile`: bearer próprio, claims com backoff/leases e
  retomada de eventos pendentes. Não usa corpos de webhook como prova financeira.
- `payments-validapay-refund`: solicitação integral explícita de sandbox, somente
  master. Reserva única no banco antes de POST, verifica referência e valor
  reservado antes de pedir devolução. Timeout não cria outro POST. A leitura de
  devoluções usa outro cliente OAuth com escopos de carteira.
- Migration `20261105000100_validapay_sandbox.sql`: novo provedor, inbox privada,
  RPCs, RLS/grants, exclusão mútua com abertura Mercado Pago. Reaproveita a máquina
  transacional existente para benefícios, sem reescrever pedidos históricos.
- `ValidaPayCheckout` e rota `/painel/[id]/checkout-validapay?plano=...`: UI nativa,
  Pix/QR/copia e cola, polling/retomada, reserva antes do 3DS, formulário de cartão,
  SDKs oficiais e prevenção de duplo envio. PAN/CVV vivem somente no navegador;
  nem estado persistido nem payload Supabase contêm esses dados.

Os SDKs estão fixados em `@validapay/tokenize@1.4.0` e `@validapay/3ds@1.2.0`.

## Evidência real, limites e diferenças da documentação

Arquivo: `evidence/2026-11-05-validapay-sandbox.json`. Não contém tokens, secrets,
publicId, dados de comprador ou número de cartão.

1. OAuth sandbox: 200 com credenciais específicas. Antes de o ambiente do par
   inicial ser identificado, ele foi testado no OAuth sandbox e recusado (401).
   Após a identificação pelo usuário, só se utilizou o par sandbox separado.
   Nenhuma API produtiva foi chamada e não houve operação financeira produtiva.
2. Pix: criação 200, pendente, repetição 409, cancelamento e estado CANCELED.
3. Outro Pix: simulação wallet/pay e detalhe PAID, amount/paidAmount corretos e BRL.
4. Prova integrada: RPC local cotou 139 centavos; adaptador do repositório criou
   R$1,39 no sandbox com referência validada; aplicação SQL pendente concedeu zero
   benefícios; confirmação PAID repetida concedeu exatamente um. A transação SQL
   foi revertida. Isso não comprova entrega de webhook nem a jornada no navegador.
5. Chromium executou os SDKs oficiais reais: tokenização e deviceId disponíveis.
   authenticate retornou null, portanto o produto bloqueia cartão. **Somente no
   diagnóstico isolado**, a API documentada sem 3DS aprovou o cartão de teste
   e recusou o cartão de recusa (402/CHARGE_FAILED).
6. O estorno sandbox da cobrança de cartão criada nesta tarefa foi CONFIRMED em
   R$1,25; a consulta confirmou. Não é prova do fluxo de estorno no MemoriesMT.
7. Prova integrada adicional com R$1,42: preço reservado pela RPC local, Pix
   sandbox PAID, benefício único após confirmação repetida, reserva única de
   estorno (segunda solicitação recusou novo claim), adaptador pediu devolução,
   API confirmou 142 centavos e a RPC local revogou o benefício. Confirmação de
   estorno repetida deixou zero benefícios ativos e status estornado. Toda a
   transação SQL foi revertida. Não é teste de entrega HTTP de webhook.

Diferenças observadas: IDs vêm com SANDBOX_cha_; recusa usa CHARGE_FAILED;
externalId não é devolvido no detalhe; referências distintas do mesmo comprador e
valor podem retornar DUPLICATE_CHARGE da cobrança anterior. O código exige que o
externalTxid persistido seja o UUID do pedido antes de vincular ou cancelar.
O comportamento de duplicidade precisa ser esclarecido pela ValidaPay antes de
produção: a proteção recusa dinheiro de outro pedido, mas não faz a compra avançar.

## Validação local

Executar na raiz: `npm test` e `npx supabase test db` (somente stack local).
Em `web`: `npm run typecheck`, `npm run lint`, `npm test`,
`npx vitest run --config vitest.functions.config.ts`, `npm run build`.
Tipos Edge: `npx deno check --node-modules-dir=auto --no-config` com os quatro
`supabase/functions/payments-validapay*/index.ts`.

Navegador, após build: em `web`,
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test --config playwright.validapay.config.ts`.
Esse teste verifica bloqueio sem configuração, recarga, ausência de chamadas ao
provedor, axe e ausência de overflow em Chromium desktop e mobile. Não valida
pagamento, câmera iPhone real, SDKs com CSP em produção nem desafio bancário 3DS.

Testes simulados têm esse rótulo no nome; não são usados como evidência financeira.

Resultados locais desta execução: 565 testes web, 181 testes puros de funções e
1.156 testes SQL passaram. A API legada passou em 203 testes e ignorou um.
Typecheck, tipos Deno das quatro funções e build passaram; lint tem zero erros
e 12 avisos preexistentes. Os dois testes de navegador (desktop/mobile) passaram.
Os payloads Pix/cartão foram aprovados pelo validate_request do MCP oficial.
O CI foi ampliado para incluir build, navegador bloqueado e banco local; consultar
os Checks do PR para o resultado do SHA publicado, sem inferi-lo dos testes locais.

O primeiro start completo local falhou porque health checks HTTP dos containers
passaram pelo proxy. A stack apenas PostgreSQL funcionou com todos os testes SQL.
Não se alterou TLS, checksum nem validação de pacotes para contornar isso.

## Ativação exclusivamente de homologação

**Não executar em produção.** Primeiro disponibilizar um projeto Supabase isolado
e revisar migration/RLS. O conector Supabase citado pelo usuário não foi exposto
às ferramentas desta sessão; nenhum estado do projeto remoto foi presumido.

Backend de homologação precisa de `VALIDAPAY_SANDBOX_CLIENT_ID`,
`VALIDAPAY_SANDBOX_CLIENT_SECRET`, `VALIDAPAY_SANDBOX_PUBLIC_ID`,
`VALIDAPAY_SANDBOX_WEBHOOK_SECRET`, `VALIDAPAY_SANDBOX_RECONCILE_TOKEN` e
`VALIDAPAY_SANDBOX_ENABLED=true`. Secrets nunca vão no frontend ou no Git.
Os nomes CLIENTID_VALIDAPAY/CLIENTSECRET_VALIDAPAY de produção não são lidos.
Os escopos necessários são checkouts/write, charges/read e charges/write para
checkout/cancelamento; a instância separada de estorno usa charges/read,
wallet/read e wallet/write. Requests financeiros têm timeout de oito segundos;
OAuth tem orçamento separado de vinte segundos. Houve timeouts reais em probes,
registrados como falhas, sem confundi-los com as provas aprovadas.

A configuração de banco precisa de payments_env=sandbox e da flag
validapay_checkout habilitada deliberadamente pelo operador de homologação. A
migration NÃO cria nem habilita essa flag. JWT master e propriedade do evento são
exigidos mesmo com as flags ligadas.

Frontend de preview precisa de configuração pública Supabase de homologação e
`NEXT_PUBLIC_VALIDAPAY_SANDBOX_PREVIEW=1` para encaminhar a seleção de plano à nova
rota e permitir hosts dos SDKs sandbox na CSP. A flag vem desligada por padrão.
As origens reais adicionais de desafio/fingerprint ainda precisam de verificação
no navegador com 3DS habilitado; não ampliar a CSP com curingas para mascarar erro.

O arquivo `supabase/config.toml` exige JWT no checkout e desliga apenas o JWT do
gateway para webhook e cron, que têm HMAC/bearer próprios. Nenhuma função foi
publicada. Nenhum cron ou webhook foi registrado remotamente.

## Gates pendentes

- Habilitar/testar 3DS da conta sandbox, incluindo desafio, recusa e timeout.
- Receber webhooks reais num endpoint público de homologação, verificar segredo,
  reentrega, duplicidade, ordem invertida e falhas de processamento.
- Validar Edge Functions sobre HTTP com Supabase isolado e a UI ativa em mobile
  e desktop, não apenas testes unitários/SQL e bloqueio sem configuração.
- Resolver/confirmar com o provedor o 409 entre referências distintas.
- Validar o endpoint HTTP e a UI de estorno no Supabase de homologação. O domínio
  agora confirma a soma das devoluções da cobrança na API, preserva benefícios em
  estorno parcial e revoga somente após devolução integral confirmada. Também trata
  estorno confirmado antes de registrar PAID, sem conceder benefício intermediário.
  Solicitação ambígua fica para leitura/conciliação e investigação manual; não há
  reenvio automático de POST. A prova local+PSP não substitui a validação HTTP.
- Verificar banco remoto, migrations reais e needs_refund históricos somente
  leitura; nenhum registro histórico foi inspecionado ou resolvido nesta sessão.
- Verificar CI do SHA final e preview funcional de homologação; nenhum deploy
  produtivo, merge ou promoção automática é permitido por esta tarefa.

## Rollback / desativação

Desligar primeiro a flag de frontend de preview e a flag validapay_checkout no
banco de homologação para bloquear novas compras; o Mercado Pago permanece.
Manter o runtime sandbox e a conciliação dos pedidos existentes até investigar
pendências. Desligar o runtime também interrompe consultas e conciliação.
Não apagar pedidos, eventos de inbox nem evidências financeiras; não remover
colunas/tabelas para rollback. A migration não tem reversão destrutiva automática.
Nenhum estorno deve ser inferido de uma desativação.
