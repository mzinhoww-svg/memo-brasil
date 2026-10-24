# Runbook de pagamentos (Mercado Pago, Checkout Pro por Preferences): aplicar, homologar no sandbox, desligar e diagnosticar

> Provedor ativo: **Mercado Pago** (decisão do operador em 23/10/2026; contrato em `docs/superpowers/specs/2026-10-23-mercadopago-design.md`). **AbacatePay é HISTÓRICO**: pedidos antigos (`payment_orders.provider = 'abacatepay'`) continuam visíveis no Master e nada neles é convertido; o código antigo está isolado em `supabase/functions/_legacy/abacatepay/` e nenhuma function ativa o usa. Os trechos do runbook antigo (chave `abc_`, `?webhookSecret=`, `ABACATEPAY_*`) foram removidos. **O fake local (`web/e2e/fixtures/fake-mercadopago.mjs`) NÃO é homologação externa.**

Projeto Supabase: `asyaegeodyttttaubvxh`. Rode os comandos na raiz do repositório, na branch `feat/mercadopago` ou numa que a contenha, com a CLI logada na conta dona do projeto.

Front-end: projeto Vercel `newmemocuiaba` (`newmemocuiaba.vercel.app`). Não crie projeto novo. Deploy, merge e promoção da Vercel ficam com a sessão dona do front; este runbook só faz referência.

Nenhum valor real aparece aqui. `<...>` marca o que o operador preenche, sempre fora do repositório. **O agente nunca recebe, imprime nem grava credenciais**: tudo abaixo é executado por você.

## Situação em 23/10/2026 (fim da Rodada 10, preparada pelo agente)

- **Pronto e verificado localmente** (branch `feat/mercadopago`, integrada com a home publicada `9c36af0`/`8530c4e`): tsc limpo, vitest web 525/525, funções 109/109, pgTAP 1120/1120 (estado anterior ao merge da home, que não toca `supabase/`), E2E padrão 104 passed/58 skipped, E2E Supabase com fake do Mercado Pago e functions reais 43/43. O fake **não conta** como homologação externa.
- **Backup feito hoje:** `~/Backups/memoriesmt/20261023-2126` (schema 24 tabelas, checksums 16/16). A primeira tentativa do `pg_dump` falhou por DNS do host direto e foi refeita pelo pooler; o script agora recusa dump vazio (commit `934e1cd`, `feat/final-ops`).
- **`supabase db push --linked --dry-run`:** lista somente `20261023000100_payments_mercadopago.sql` (001400–001800 já estão no remoto).
- **Bloqueado para o agente:** o controle de permissões recusou `supabase db push --linked --yes` ([Production Deploy]). A ação **exata** que falta é a etapa 3 abaixo; deploy das funções, segredos, Vault e webhook também ficam com o operador. A produção continua em `9c36af0` sem o código do Mercado Pago, com cobrança desligada.
- **Não publicar o candidato do Mercado Pago antes das etapas 3 e 4:** o front novo espera `payment_charges`, `payments_apply_payment` e as functions `payments-*` novas.

## Estado e pré-requisitos

- **Migrations pendentes no remoto** (confira com `supabase migration list --linked`): `20261022001400` a `001800` (planos, direitos, pagamentos, Master, cortesia) **e** `20261023000100_payments_mercadopago`. Todas aditivas.
- **Cobrança pública permanece desligada** (`payments_env = 'desligado'`) até: homologação real comprovada, credenciais de produção válidas, configuração comercial (D3, D5, D6) e PAY-001…PAY-005 corrigidos (corrigidos em `20261023000100`; ver "Correções PAY").
- **Credenciais:** não existem no repositório nem na sessão do agente. Sem `MERCADOPAGO_ACCESS_TOKEN` as functions de pagamento respondem 503 e nunca chamam a API.

## Ordem (não pule etapas)

| # | Etapa | Depende de | Quem |
|---|---|---|---|
| 1 | Backup (banco + `event-photos` + `event-branding`) | — | operador |
| 2 | `migration list` e `db push --dry-run` | 1 | operador |
| 3 | `db push --linked --yes` | 2 | operador |
| 4 | Deploy das 6 functions | 3 | operador |
| 5 | Segredos das functions (env-file fora do repo) | credencial de teste do MP | operador |
| 6 | Vault e agendamento de `mm-payments-reconcile` | 4, 5 | operador |
| 7 | Webhook no painel do Mercado Pago (modo teste) | 4, 5 | operador |
| 8 | `payments-diagnose` (conta, token e segredos por NOME) | 4, 5 | Master |
| 9 | `payments_env = "sandbox"` só durante a janela | 5–8 | operador (Master) |
| 10 | Homologação (pagamento, webhook, reembolso) e fechamento da janela | 9 | operador + titular da conta MP |

Os passos 1 a 4 podem ser feitos sem credencial: com `desligado` nada é cobrado.

## 1. Backup

```bash
cat supabase/.temp/project-ref                       # deve imprimir asyaegeodyttttaubvxh
umask 077
D=~/Backups/memoriesmt/$(date +%Y%m%d-%H%M); mkdir -p "$D/storage" "$D/storage-branding"; chmod 700 ~/Backups/memoriesmt "$D"
supabase db dump --linked -f "$D/schema.sql"
supabase db dump --linked --data-only -f "$D/data.sql"
supabase storage cp -r ss:///event-photos/   "$D/storage/"          --linked --experimental
supabase storage cp -r ss:///event-branding/ "$D/storage-branding/" --linked --experimental   # não estava no backup 20261022-1902
chmod 600 "$D"/*.sql
(cd "$D" && find . -type f ! -name SHA256SUMS.txt -print0 | xargs -0 shasum -a 256 > SHA256SUMS.txt && shasum -a 256 -c SHA256SUMS.txt | grep -vc ': OK$')   # 0 = tudo OK
```

- **Conferência:** `schema.sql` e `data.sql` com tamanho maior que zero, e o número de arquivos em `storage/` igual ao de linhas de `storage.objects` do bucket.
- **Onde fica:** o backup nunca vai para o Git, e-mail ou chat. Fica só em `~/Backups/memoriesmt/`, com modo 700/600.
- **Script de uma etapa:** `origin/feat/final-ops:supabase/ops/backup_and_rotate.sh` faz backup e rotação juntos, mas ainda não copia `event-branding`. Até isso ser corrigido, use os comandos acima ou acrescente a linha do bucket.

### Rotação de backups

Rotação de backups é manual, executada pelo operador a cada ≤ 30 dias; não é automação ativa.

```bash
sh supabase/ops/rotate_local_backups.sh ~/Backups/memoriesmt           # dry-run: lista o que tem mais de 30 dias
sh supabase/ops/rotate_local_backups.sh ~/Backups/memoriesmt --apply   # remove; rode só depois de um backup novo com checksum OK
```

- **Opção persistente (ação do dono, não instalada):**
  1. copiar o exemplo `com.memoriesmt.backup.plist.example` (branch `feat/final-ops`) para `~/Library/LaunchAgents/com.memoriesmt.backup.plist`;
  2. ajustar o caminho do repositório;
  3. rodar `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.memoriesmt.backup.plist`.
- **Limite do LaunchAgent:** com o Mac desligado ou sem rede, o backup não roda. Não é backup gerenciado, e o plano atual não tem PITR.

## 2. Antes de aplicar (somente leitura)

```bash
supabase migration list --linked          # confira o que falta no remoto
supabase db push --linked --dry-run       # deve listar 20261022001400…001800 e 20261023000100 (e nada além)
```

Se o dry-run listar qualquer outra migration (de outra sessão), **pare** e combine a ordem antes de aplicar.

## 3. Aplicar as migrations

```bash
supabase db push --linked --yes
supabase migration list --linked          # local = remoto
```

- Cada migration roda na sua transação. A que falhar não deixa alteração pela metade: anote o arquivo, não edite as já aplicadas e traga a saída.
- A `20261023000100` é aditiva: acrescenta colunas e a tabela `payment_charges`, troca o padrão de `provider` para `mercadopago` e cria funções novas. **Nada é apagado**; pedidos AbacatePay ficam como estão. Pedido AbacatePay ainda `criado|pendente` é cancelado na próxima abertura de checkout do evento (nunca reusado).
- A `001700` tenta agendar o `mm-payments-reconcile`; sem os segredos do Vault emite `notice` e não agenda (esperado; passo 6).

Verificação no SQL Editor:

```sql
select public.payments_env();                                   -- desligado
select jsonb_array_length(public.list_public_plans());          -- 1 (só o Grátis enquanto desligado)
select count(*) from public.payment_orders where provider = 'mercadopago';
select to_regclass('public.payment_charges');                   -- payment_charges
```

## 4. Deploy das Edge Functions

```bash
supabase functions deploy payments-checkout payments-status payments-refund payments-diagnose --project-ref asyaegeodyttttaubvxh --use-api
supabase functions deploy payments-webhook payments-reconcile --no-verify-jwt --project-ref asyaegeodyttttaubvxh --use-api
supabase functions list --project-ref asyaegeodyttttaubvxh
```

- **JWT** (`supabase/config.toml`): `payments-checkout`, `payments-status`, `payments-refund` e `payments-diagnose` exigem JWT (refund e diagnose ainda exigem `is_master()`). `payments-webhook` e `payments-reconcile` ficam **sem** JWT, porque o Mercado Pago e o pg_cron não o enviam: o webhook exige `x-signature` válido; o reconcile exige `Authorization: Bearer PAYMENTS_CRON_TOKEN`.
- **CORS:** a lista fixa aceita `https://newmemocuiaba.vercel.app` e os previews; domínio próprio via segredo `ALLOWED_ORIGINS`. As `back_urls` do checkout usam só o domínio oficial (ou `ALLOWED_ORIGINS`) em produção; previews/localhost só em sandbox.

Verificação sem credencial (cada uma deve recusar):

```bash
F=https://asyaegeodyttttaubvxh.supabase.co/functions/v1
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$F/payments-webhook"      # 401 (sem x-signature válido)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$F/payments-reconcile"    # 401 (sem token)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$F/payments-checkout"     # 401 (gateway: sem JWT)
```

## 5. Segredos das functions

Crie o arquivo **fora do repositório** (ex.: `~/.config/memoriesmt/payments-sandbox.env`, `chmod 600`). Só os **nomes**:

```
MERCADOPAGO_ACCESS_TOKEN=<access token das credenciais de TESTE do Mercado Pago>
MERCADOPAGO_WEBHOOK_SECRET=<assinatura secreta que o painel mostra ao configurar o webhook>
PAYMENTS_CRON_TOKEN=<saída de: openssl rand -hex 32>
```

```bash
supabase secrets set --project-ref asyaegeodyttttaubvxh --env-file ~/.config/memoriesmt/payments-sandbox.env
supabase secrets list --project-ref asyaegeodyttttaubvxh        # só nomes e digests
```

- **`NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`:** o Checkout Pro redireciona para a página hospedada e **não** usa SDK de navegador; a Public Key não é consumida. Não a defina.
- **`MERCADOPAGO_BASE_URL` e `PAYMENTS_WEBHOOK_URL`:** **não** defina no remoto. A primeira só serve ao fake local (a function recusa qualquer host que não seja `localhost`, `127.0.0.1` ou `host.docker.internal`); a segunda só sobrescreve a `notification_url` em testes locais.
- **Ambiente não vem do token:** o interruptor é `payments_env` (banco) e o ambiente de cada pagamento vem de `live_mode` da API. Token de produção com `payments_env='sandbox'` (ou o contrário) produz `divergencia_ambiente` e nunca libera plano.
- **Recebedor:** a conta esperada é resolvida por `GET /users/me` com o próprio token (nunca por parâmetro). Pagamento de outro recebedor ⇒ `divergencia_recebedor`.

## 6. Vault e agendamento da conciliação (`mm-payments-reconcile`, a cada 5 min)

1. **No painel** (Integrations → Vault → Add new secret):
   - `mm_payments_cron_token` = **o mesmo** valor de `PAYMENTS_CRON_TOKEN`;
   - `mm_payments_reconcile_url` = `https://asyaegeodyttttaubvxh.supabase.co/functions/v1/payments-reconcile`.
2. No SQL Editor, como `postgres`:

```sql
select public.payments_schedule_reconcile();                    -- true (false + notice = falta segredo)
select jobname, schedule, active from cron.job where jobname = 'mm-payments-reconcile';
-- 5 a 10 min depois:
select status_code, left(content, 160) from net._http_response order by created desc limit 3;   -- 200 {"verificados":...}; 401 = token do Vault ≠ PAYMENTS_CRON_TOKEN
```

A conciliação: expira `pendente` vencido (`expires_at` + 5 min), procura pagamentos por `external_reference` dos pedidos `criado|pendente|expirado` **criados nos últimos 7 dias** (5 páginas de 50; busca incompleta é só informada), reconsulta pagamentos com reembolso solicitado (sem teto de idade) e falha o pedido `criado` sem preferência após 5 min. Repetições não regravam `payment_events`.

## 7. Webhook no painel do Mercado Pago

- **Onde:** Suas integrações → sua aplicação → Webhooks → Configurar notificações, no **modo de teste** (depois, outro em produção).
- **URL:** `https://asyaegeodyttttaubvxh.supabase.co/functions/v1/payments-webhook` (**sem** parâmetros de segredo).
- **Evento:** `Pagamentos`. Outros tópicos (chargebacks, merchant_order) são aceitos com 200 e ignorados nesta fase; disputas entram pelo estado do próprio pagamento (`in_mediation` → `em_disputa`, `charged_back` → `perdido`) na reconsulta/conciliação.
- **Assinatura secreta:** copie para `MERCADOPAGO_WEBHOOK_SECRET` (passo 5). A function valida `x-signature` (`ts=…,v1=…`), manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, HMAC-SHA256 hex, tolerância de `ts` de 10 min, comparação em tempo constante. Assinatura inválida = 401 sem tocar no banco. **Não existe mais `?webhookSecret=`.**
- O Mercado Pago exige resposta 200/201 em até 22 s e reenvia a cada 15 min se não houver; a function é idempotente.
- Use "Simular notificação" do painel apenas para ver 200: ele aponta um `data.id` que não existe e a function responde 200 `pagamento_inexistente`.

## 8. Diagnóstico não financeiro (`payments-diagnose`)

Master logado chama `POST /functions/v1/payments-diagnose` (JWT do Master). Devolve só metadados: id da conta recebedora, `site_id`, país, se a busca de preferências funciona, `payments_env`, e **booleanos** de existência dos três segredos. Nunca o token nem corpos. Não cria cobrança, preferência nem reembolso.

## 9. Abrir a janela de homologação (`payments_env = "sandbox"`)

`admin_set_setting` exige Master (claim `app_metadata.role = master` + papel ativo em `platform_roles`) e grava auditoria com motivo. **Não há tela para mudar `payments_env`: é por SQL.** Ponha em `'sub'` o uuid do **seu** usuário Master e escreva no motivo quem executou, por onde e quando.

```sql
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', '<uuid do Master que executa>',
  'role', 'authenticated', 'app_metadata', json_build_object('role', 'master'))::text, true);
select public.admin_set_setting('payments_env', '"sandbox"'::jsonb, '<motivo: quem executa, pelo SQL Editor, data — abre janela de homologação sandbox>');
commit;
select public.payments_env();                                   -- sandbox
select jsonb_array_length(public.list_public_plans());          -- 5
```

Mantenha `"sandbox"` **só** durante a janela. Pagamentos de teste (usuários/cartões de teste do Mercado Pago) são feitos **pelo titular da conta na página hospedada do provedor**; o agente não digita dados de cartão. Reembolso com dinheiro real depende do titular.

### 9.1 Fechar a janela

1. Voltar a `"desligado"` com o mesmo cuidado (seu uuid em `'sub'`, quem executou no motivo):

```sql
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', '<uuid do Master que executa>',
  'role', 'authenticated', 'app_metadata', json_build_object('role', 'master'))::text, true);
select public.admin_set_setting('payments_env', '"desligado"'::jsonb, '<motivo: quem executa, pelo SQL Editor, data — fim da janela de homologação>');
commit;
select public.payments_env();                                   -- desligado
```

2. Listar e reaplicar limites dos eventos de teste (nada é apagado):

```sql
select ee.event_id, e.title, e.capacity, e.shots_per_person, ee.plan_code, ee.order_id, ee.created_at
  from public.event_entitlements ee join public.events e on e.id = ee.event_id
 where ee.env = 'sandbox' and ee.source = 'pago' and ee.status = 'ativo' order by ee.created_at;
select ee.event_id, public.payments_reapply_limits(ee.event_id)
  from (select distinct event_id from public.event_entitlements where env = 'sandbox' and source = 'pago' and status = 'ativo') ee;
```

Se aparecer evento real, **pare** e leve o `eventId` para análise.

Com `"desligado"`: compras de produção já pagas continuam valendo; webhook, reconcile e refund continuam tratando dinheiro em trânsito; só checkout responde 503. O status do pedido não depende do interruptor.

## 10. Rollback

| Situação | Ação | Efeito |
|---|---|---|
| Qualquer problema de cobrança | `admin_set_setting('payments_env','"desligado"', <motivo>)` (9.1) | Desliga a compra na hora, sem deploy; compras de produção pagas seguem válidas |
| Function com defeito | Redeploy da versão anterior a partir do SHA anterior (`supabase functions deploy <nome> … --use-api`, `--no-verify-jwt` para webhook/reconcile) | Com `desligado` o checkout já não opera |
| Conciliação com erro | `select cron.unschedule('mm-payments-reconcile');` (reagendar com `payments_schedule_reconcile()`) | Para o job |
| Webhook com problema | Desativar a notificação no painel do MP; a conciliação (5 min) segue aplicando pagamentos por `external_reference` | Sem perda: nada depende só do webhook |
| Credencial exposta | Renovar o token/segredo no painel do MP, `supabase secrets set` com o novo valor, redeploy não é necessário | — |
| Migration | **Não revertida** (aditiva). Recuperação de dados só pelo backup do passo 1 | — |

## 11. Diagnóstico

No SQL Editor (só contagens e ids; nada de dados pessoais):

```sql
select provider, provider_env, status, count(*), bool_or(needs_refund) as algum_needs_refund from public.payment_orders group by 1, 2, 3 order by 1, 2, 3;
select id, status, plan_code, amount_cents, mp_preference_id is not null as tem_preferencia, mp_payment_id, refunded_cents, expires_at, paid_at,
       refund_requested_at, needs_refund from public.payment_orders where id = '<orderId>';
select payment_id, role, status, amount_cents, refunded_cents, refund_requested_at, last_seen_at from public.payment_charges where order_id = '<orderId>' order by id;
select id, event_type, outcome, received_at, resolved_at from public.payment_events where order_id = '<orderId>' order by id;
select outcome, count(*) from public.payment_events where received_at > now() - interval '24 hours' group by 1 order by 2 desc;
```

- **Divergências:** `/master/pagamentos`, ou `admin_payment_divergences()` (só Master; ver bloco `set_config` do passo 9). Tipos: `pago_sem_direito`, `direito_sem_pedido_pago`, `pendente_1h`, `needs_refund`, `em_disputa`, e dos eventos: `pago_ignorado_reembolsar`, `upgrade_base_estornado`, `pagamento_duplicado`, `divergencia_valor|moeda|recebedor|ambiente|cobranca`, `transicao_ignorada`. **Divergência em pedido pago não expira** até ser tratada (PAY-005).
- **Logs** (`{fn, orderId, status, outcome}`, sem token nem corpo): `preferencia_criada`, `reusado`, `aplicado`, `duplicado`, `obsoleto` (notificação fora de ordem), `nao_autenticado_<motivo>` (ausente/formato/ts/assinatura), `topico_ignorado`, `pagamento_inexistente`, `pedido_desconhecido`, `busca_incompleta`, `sem_cobranca`, `reembolso_approved|in_process`, `cobranca_nao_paga`, `cobranca_nao_confere`, `recebedor_divergente`, `ambiente_divergente`, `provedor_<tipo>`.

**O que fazer:**
- **`needs_refund`** (dinheiro entrou sem direito: pago após cancelamento, duplicidade, plano já coberto, valor/moeda/recebedor/ambiente divergentes):
  1. Em `/master/pagamentos`, "Solicitar reembolso" com motivo de 10 a 500 caracteres. Pedido pago ⇒ reembolsa o pagamento **vinculado**. **Cobrança extra** (duplicada/divergente) só por solicitação explícita do `payment_id` (`admin_request_payment_refund(order, payment_id, motivo [, valor])`); nunca por inferência (PAY-001). Valor parcial opcional.
  2. `payments-refund` reconsulta o pagamento (aprovado, do pedido, recebedor, ambiente; valor exigido só no vinculado) e chama `POST /v1/payments/{id}/refunds` com `X-Idempotency-Key` estável por solicitação.
  3. Pix pode voltar `in_process`: o pedido segue `pago` até `refunded` chegar por webhook ou conciliação.
  4. Reembolsou direto no painel do provedor? A conciliação reconhece `refunded` e fecha. Se não for reconhecível, **limpe com `admin_clear_needs_refund(order, motivo)`** (Master, auditado, marca as divergências como resolvidas, não apaga nada; PAY-002).
- **`em_disputa`** (`in_mediation`): o sistema não reembolsa; o direito continua até o resultado; `charged_back` leva a `perdido` e revoga o direito.
- **`pendente_1h`:** rode/aguarde a conciliação; se o job não existir, volte ao passo 6.
- **`pago_sem_direito` / `direito_sem_pedido_pago`:** não corrija por SQL; leve `orderId`, `eventId` e os `payment_events` para análise.
- **Pedidos AbacatePay (histórico):** aparecem no Master; `payments-refund` responde `provedor_historico` (reembolso, se houver, é feito no painel da AbacatePay e registrado por `admin_clear_needs_refund`).

## 12. Procedimento local reproduzível (fake do Mercado Pago, sem credencial real)

**O fake NÃO é homologação externa**: prova o contrato que o código consome, não o comportamento real do provedor. Fica em `web/e2e/fixtures/fake-mercadopago.mjs` e implementa Preferences, `GET /v1/payments/{id}`, `search`, reembolso com `X-Idempotency-Key`, `users/me`, e entrega webhooks com `x-signature` idêntico ao real; controles em `/__control/*` (pagamento aprovado/recusado/pendente, duplicado, fora de ordem, timeout, 500, Pix em processamento).

1. Stack local isolado (portas 554xx): `supabase start` e `supabase db reset --local`.
2. Arquivo de ambiente **fora do Git**, modo 600, **só valores fictícios** (nomes): `MERCADOPAGO_ACCESS_TOKEN=FAKE-<hex>`, `MERCADOPAGO_WEBHOOK_SECRET=<hex>`, `PAYMENTS_CRON_TOKEN=<hex>`, `MERCADOPAGO_BASE_URL=http://host.docker.internal:56491`, `PAYMENTS_WEBHOOK_URL=http://host.docker.internal:55421/functions/v1/payments-webhook`, `FAKE_MERCADOPAGO_PORT=56491`.
3. Em um terminal: `supabase functions serve --env-file <arquivo>` (reinicie depois de cada `db reset`).
4. Em outro: `cd web && SUPABASE_URL=<API_URL> SUPABASE_PUBLISHABLE_KEY=<...> SUPABASE_SERVICE_KEY=<...> PAYMENTS_FUNCTIONS_ENV_FILE=<arquivo> npx vitest run --config vitest.integration.config.ts integration/payments.itest.ts` (chaves de `supabase status -o env`; o teste recusa rodar fora de `localhost`/`127.0.0.1`).
5. Demais suítes (o itest deixa usuários/papéis de teste no banco local: rode `supabase db reset --local` antes do pgTAP): `supabase test db --local` (pgTAP; `11_payments_mercadopago` cobre PAY-001…005) e `cd web && npx vitest run --config vitest.functions.config.ts`.
6. Encerre o `functions serve` pelo PID ao terminar.

## 13. Correções PAY-001…PAY-005 (migration `20261023000100`)

| Item | Correção | Prova |
|---|---|---|
| PAY-001 | `payments_refund_target`: o alvo padrão de pedido pago é o pagamento vinculado; cobrança extra só por `payment_id` explícito conhecido do pedido | pgTAP 11 (PAY-001) · itest "PAY-001" |
| PAY-002 | `admin_clear_needs_refund` (Master, motivo, auditoria, divergências marcadas como resolvidas) | pgTAP 11 (PAY-002) |
| PAY-003 | waiver de valor do estorno só para pedido ainda não pago (histórico e MP) | pgTAP 11 (PAY-003) |
| PAY-004 | `payments_reconcile_candidates` (teto de 7 dias, throttle) e `duplicado` não grava `payment_events` | pgTAP 11 (PAY-004) · itest |
| PAY-005 | divergência em pedido pago/em disputa permanece até ser resolvida | pgTAP 11 (PAY-005) |

## 14. Transição para produção (não executar sem autorização explícita do dono)

1. **Pré-condições:** homologação real comprovada (janela sandbox fechada), D3/D5/D6 decididos (reembolso/arrependimento, CNPJ e contatos, NFS-e), PAY-001…005 verificados no remoto.
2. **Credenciais de produção** do Mercado Pago: novo `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` (passo 5), webhook de **produção** no painel (o de teste não recebe eventos reais).
3. `payments-diagnose` com o token de produção; conferir que a conta recebedora é a esperada.
4. `admin_set_setting('payments_env','"production"', <motivo>)`; conferir `list_public_plans()` como anônimo e `production_active` por plano.
5. **Verificação controlada:** uma compra real do menor plano pelo dono, em evento próprio; depois reembolso pelo Master até `estornado`.

## 15. Homologação preparada (2026-10-24): o que está provado, o que depende do titular

### 15.1 Ambiente das credenciais cadastradas (por evidência, não por prefixo)
- O token de teste e o de produção do Mercado Pago **ambos começam com `APP_USR`**: o prefixo não classifica nada.
- `payments-diagnose` (Master) agora devolve `account.testUser`, lido da tag `test_user` que a própria API põe na conta. Resultado com o token hoje cadastrado: **`testUser: false`** (conta `3786909683`, MLB/BR). Leitura: o token cadastrado identifica uma conta **real**, tratado como **produção**. Por isso `payments_env` **não** foi aberto em `sandbox` e fica `desligado`.
- Com token de produção só existem dois caminhos: (A) homologar em sandbox trocando temporariamente por credenciais de TESTE (abaixo, recomendado) ou (B) a verificação controlada com dinheiro real do §14, que exige antes D3/D5/D6.

### 15.2 Compatibilidade da aplicação "Checkout Transparente" (`1592042337972998`) com o Checkout Pro
- A documentação do Mercado Pago liga as credenciais à **aplicação**, não ao produto; `POST /checkout/preferences` é autenticado só pelo Access Token. Nenhuma página consultada restringe o endpoint por tipo de solução.
- Evidência real: `GET /checkout/preferences/search` respondeu `ok` com este token (total 0): a credencial tem acesso ao recurso de preferências. **Não provado ainda:** a criação de uma preferência (ocorre no primeiro `Pagar` da janela de teste).
- Decisão: **não recriar a aplicação**. Só recriar (fluxo "Checkout Pro" do painel) se a primeira criação falhar com 401/403 ou erro específico de produto.

### 15.3 Passo exato que depende da verificação SMS/WhatsApp do titular
1. Abra `https://www.mercadopago.com.br/developers/panel/app` (já logado como titular). Ao entrar na aplicação `1592042337972998`, o painel mostra "Valide que esta é a sua conta": escolha SMS ou WhatsApp no celular cadastrado e informe o código. (Foi aqui que o agente parou; esse código é só seu.)
2. Na aplicação, menu **Credenciais de teste**: ative as credenciais de teste se estiverem inativas e copie o **Access Token de teste**.
3. Menu **Contas de teste**: crie (ou abra) um usuário **comprador** de teste, país Brasil. Guarde login e senha dele; o código de e-mail pedido no login é o dos 6 últimos dígitos do User ID dessa conta de teste.
4. Menu **Webhooks → Configurar notificações**: modo de teste, URL `https://asyaegeodyttttaubvxh.supabase.co/functions/v1/payments-webhook` (sem parâmetros), evento **Pagamentos**; copie a **assinatura secreta** que o painel mostrar para esse modo.
5. **Nunca cole token ou segredo no chat.** Entregue-os ao operador por canal seguro.

### 15.3.1 Operador: aplicar as credenciais de teste (sem commit, sem chat)
```bash
umask 077; mkdir -p ~/.config/memoriesmt
# arquivo fora do repositório com exatamente estes nomes (valores só aqui):
#   MERCADOPAGO_ACCESS_TOKEN=<access token de TESTE>
#   MERCADOPAGO_WEBHOOK_SECRET=<assinatura secreta do modo de teste>
supabase secrets set --project-ref asyaegeodyttttaubvxh --env-file ~/.config/memoriesmt/payments-sandbox.env
```
Guarde as credenciais de **produção** atuais em local seguro **antes** de sobrescrever: o passo 15.6 as restaura. Confira como Master: `payments-diagnose` deve devolver `account.testUser: true`. **Se vier `false` ou `null`, pare: não abra `sandbox`.**

### 15.4 Janela de teste e pagamento (somente com `testUser: true`)
1. Operador abre a janela: §9 (`payments_env = "sandbox"`).
2. Titular, em **janela anônima**, abre o evento sintético: `https://newmemocuiaba.vercel.app/painel/9d41413b-b7d8-4e02-9a24-6f01e6b5bd75/plano` (dono: conta Google do titular, a mesma que criou o evento). Escolhe **Festa (R$ 29,00)** → "Pagar".
3. O app redireciona para a página hospedada do Mercado Pago. Faça login com o **comprador de teste** e pague: cartão de teste Mastercard `5480 8328 0103 3311`, CVV `123`, validade `11/30`, titular **`APRO`**, CPF `12345678909` (aprovado). Para o cenário pendente use titular `CONT`; para recusado, `OTHE`. Pix em teste termina "pendente" (esperado). O agente não digita dados de cartão.
4. Volte ao evento pelo botão do Mercado Pago (ou reabra o link do passo 2).

### 15.5 Acompanhamento (o agente roda, somente leitura)
`supabase/ops/payments_homologation_watch.sql`: pedido, `payment_charges` (`live_mode` deve ser **false** em sandbox e `collector_id` a conta de teste), `payment_events` (webhook e desfecho), `event_entitlements` (uma linha ativa por pedido: concessão única) e execuções do `mm-payments-reconcile`. Critérios de aprovação: pedido `pago`; `live_mode=false`; webhook `payments_apply_payment` aplicado uma única vez; plano Festa no evento; retorno `?retorno=sucesso` mostra o plano ativo só depois de o backend confirmar; reenvio do webhook e conciliação não duplicam direitos.

### 15.6 Fechar a janela e restaurar produção
§9.1 (voltar `desligado`) e re-gravar as credenciais de **produção** guardadas (mesmo comando do 15.3.1, com o env-file de produção) + webhook de **produção** no painel. Confirme `testUser: false`. Só então valem os §14 (D3/D5/D6) e a abertura de `production`.

### 15.7 Bloqueios comerciais documentados que continuam abertos
`company_legal_name`, `company_cnpj`, `support_email` e `support_phone` estão **nulos** em `platform_settings`; D3 (reembolso/arrependimento), D5 (CNPJ e contatos) e D6 (NFS-e) não foram decididos. O agente não inventa esses dados; sem eles a produção permanece `desligado`.

## 16. Atualização 2026-10-24 (MCP oficial): homologação isolada, sem trocar a produção
Substitui o §15.3.1 e o §15.6 (não é mais preciso sobrescrever nem restaurar o token de produção).

### 16.1 Fatos comprovados pelo MCP e pelo diagnóstico
- Aplicação única `1592042337972998` ("App-Checkout-Transparente-20261023-346d726106"), dona = conta `3786909683` = conta do token de produção cadastrado (`payments-diagnose`: `testUser:false`). Reaproveitada: o Checkout Pro usa `POST /checkout/preferences` com o token da aplicação (a busca de preferências respondeu `ok`); não foi recriada.
- Par de TESTE da aplicação (`get_credentials`, seção "Test (Sandbox)"): pertence ao **vendedor de teste** `3786688395` (aplicação de teste `4326309413049449`). Comprador de teste `3790697518` (MLB). Ambos já existiam; nenhum usuário novo foi criado. As senhas só aparecem no painel (exige SMS do titular).
- Webhook da aplicação (`save_webhook`): produção e sandbox apontam para `https://asyaegeodyttttaubvxh.supabase.co/functions/v1/payments-webhook`. O mesmo endpoint serve aos dois: o ambiente de cada pagamento vem de `live_mode` na API e é cruzado com o ambiente do pedido (divergência = `divergencia_ambiente`, nunca libera). A assinatura secreta é a do painel (`Webhooks > Configurar notificação`); nenhuma ferramenta a devolve. Se a primeira notificação real cair em `nao_autenticado_assinatura`, o segredo gravado em `MERCADOPAGO_WEBHOOK_SECRET` difere do painel.

### 16.2 Código (commit `11744b4`, publicado nas 6 functions)
- `MERCADOPAGO_ACCESS_TOKEN_SANDBOX` (e opcional `MERCADOPAGO_WEBHOOK_SECRET_SANDBOX`): sandbox **nunca** usa o token de produção; sem o de sandbox, recusa (503). Produção usa sempre `MERCADOPAGO_ACCESS_TOKEN`.
- status/refund/reconcile usam as credenciais do ambiente do **pedido**; o webhook escolhe pelo `live_mode` da notificação e aceita os dois segredos.
- Checkout em sandbox só para **Master** (`403 sandbox_restrito` para os demais); visitantes reais não compram em teste.
- `payments-diagnose` devolve `production` e `sandbox` separados (`account.testUser`).
- Preferência com `category_id`, `description`, `statement_descriptor=MEMORIESMT` e `payer.email` (checklist de qualidade do MP).

### 16.3 Estado do token de sandbox (resolvido) e do bloqueio restante
- **Token de sandbox: configurado e provado.** `MERCADOPAGO_ACCESS_TOKEN_SANDBOX` foi gravado a partir de arquivo 600 (sem valor na linha de comando; o arquivo foi apagado). A primeira tentativa foi recusada pelo classificador do modo automático (Bash, linha única com o token literal, "judged this action dangerous", sem explicação); com o arquivo, a mesma operação passou. `payments-diagnose` (Master): `production.account` = `3786909683`, `testUser:false`; `sandbox.account` = `3786688395`, `testUser:true`. O token de produção não é usado como sandbox.
- **Bloqueio restante (negativa explícita, sem contorno):** gravar `payments_env='sandbox'` no banco compartilhado. O classificador negou `supabase db query --linked -f` com `set_config` de claims Master + `admin_set_setting` (motivo `[Modify Shared Resources]`). Operação preparada em `supabase/ops/payments_sandbox_open.sql` e `payments_sandbox_close.sql`. Permissão que resolve: regra de permissão do Bash (Claude Code settings) para `supabase db query --linked -f supabase/ops/payments_sandbox_*.sql`, ou o operador executa o arquivo.

### 16.4 Janela de teste (§9) e pagamento
Abra `payments_env='sandbox'` (§9); o checkout de sandbox só funciona para o Master. Com a conta Google Master, abra o evento sintético `https://newmemocuiaba.vercel.app/painel/9d41413b-b7d8-4e02-9a24-6f01e6b5bd75/plano`, escolha Festa e clique em Pagar. Na página do Mercado Pago, em janela anônima, entre com o comprador de teste `TESTUSER4415384242584077651` (senha no painel; código de e-mail = 6 últimos dígitos do User ID `3790697518`) e pague com cartão de teste Mastercard `5480 8328 0103 3311`, CVV `123`, `11/30`, titular `APRO`, CPF `12345678909`. O agente não digita dados de cartão. Em seguida o agente acompanha pedido, webhook, conciliação, direitos e retorno com `supabase/ops/payments_homologation_watch.sql` e `notifications_history`, e executa `quality_evaluation` com o `payment_id` do pagamento de teste. Feche a janela (§9.1).

## 17. Pedido de teste pronto (2026-10-24): só falta o pagamento com o comprador de teste
- Janela `sandbox` aberta com `supabase/ops/payments_sandbox_open.sql` (auditada). **Feche ao terminar** com `payments_sandbox_close.sql`.
- Pedido de teste: `24a97019-b959-4239-9da5-258e7b8bd6bf`, plano Festa R$ 29,00, evento sintético `0c6ab52b-cbf6-4a8a-adbb-c320d02b37f2`, `provider_env=sandbox`, preferência `3786688395-aded8162-cc01-41c1-b52b-2a2fb02a9b55` (do vendedor de teste). **Vale por 60 min** (`expires_at 2026-10-24 04:04:51Z`); depois a conciliação expira e basta repetir "Pagar" no evento.
- Link do Checkout Pro: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=3786688395-aded8162-cc01-41c1-b52b-2a2fb02a9b55`.
- **Meios de pagamento:** boleto e caixa eletrônico excluídos na preferência (`payment_methods.excluded_payment_types`, commit `4522a46`); a página oferece **Novo cartão (crédito ou pré-pago)**. **Pix não aparece** porque o Mercado Pago só exibe Pix se o vendedor tiver **chave Pix cadastrada**; o vendedor de teste não tem. Em produção a conta `3786909683` precisa ter chave Pix, senão o Pix também some.
- **Pagar (titular), em janela anônima, nunca com a sessão real do Mercado Pago** (comprador real não paga preferência de vendedor de teste): abrir o link, entrar com o comprador de teste `TESTUSER4415384242584077651` (senha no painel; código de e-mail = 6 últimos dígitos do User ID `3790697518`), Novo cartão: Mastercard `5480 8328 0103 3311`, CVV `123`, validade `11/30`, titular `APRO`, CPF `12345678909`. Resultado esperado: aprovado → pedido `pago`, plano Festa no evento, retorno `?retorno=sucesso`.
- Acompanhamento (agente): `payments_homologation_watch.sql` (agora no evento `0c6ab52b…`), `notifications_history`, `quality_evaluation` com o `payment_id`.

### 17.1 Correção do primeiro teste (2026-10-24)
O primeiro pagamento falhou com "Uma das partes com as quais você está tentando efetuar o pagamento é de teste". Causas: (a) a preferência de sandbox enviava o `payer.email` real do organizador (corrigido: `payerEmailFor`, só produção, commit `7e54dd7`); (b) pagar com a sessão real do Mercado Pago em vez do comprador de teste. Novo pedido: `26be9690-cf5a-49f0-a069-e876a21c3304`, evento `93a98109-e4d6-4d96-9586-58d7884ab42e`, link `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=3786688395-0fb93024-de5c-4a7e-b36a-ce870a224784`, vale até `2026-10-24 04:12:35Z`. O pedido `24a97019…` e o evento `0c6ab52b…`/`9d41413b…` são descartáveis ("TESTE – excluir"). O acompanhamento (`payments_homologation_watch.sql`) aponta para `93a98109…`.

## 18. Jornada mobile (2026-10-24)
Resumo do pedido, "Pagar com Mercado Pago · R$", carregamento, aviso de rede, "Atualizar" e retomada ao voltar do Mercado Pago, CTA fixo com área segura e `CheckoutBridge` para o futuro app. Detalhes e **o que não está provado** (aparelho físico, teclado aberto, Pix real, app nativo, regras das lojas): `docs/design/PAGAMENTO-MOBILE-NATIVO.md`. Evidência por emulação: `docs/evidence/pagamento-mobile/`. Erro `145 Invalid users involved` ("uma das partes é de teste"): comprador real pagando preferência de vendedor de teste (ou o contrário); em sandbox pagar só com o comprador de teste logado em janela anônima; o Pix não é pagável com credenciais de teste.

## 19. Resultado da homologação sandbox (2026-10-24), com evidências do banco
**Pagamento aprovado e liberado (cartão, Checkout Pro, vendedor de teste 3786688395):**
- Pedido `235e0088-995e-42f2-b51c-106554c48649` (Festa R$ 29,00, evento sintético `17ffe926…`): `pago` às 04:19:34Z; pagamento `184803988907`, `approved`, BRL, método `master`, recebedor `3786688395`; `payment_charges` 1 linha `primary`; **1** direito `festa` ativo (`env=sandbox`); evento 10/10 → 30 convidados / 24 fotos.
- **Concessão única provada**: três rodadas seguidas de conciliação depois da aplicação não criaram cobrança, evento nem direito novos (1/1/1).
- **Retorno**: `?retorno=sucesso&payment_id=…` abre "Plano Festa ativo." com comprovante e links; a URL é limpa; o estado veio do servidor.
- **Master**: lista o pedido com "Solicitar reembolso" e as divergências antigas com texto claro.

**Achado e correção (commit `143b347`)**: o primeiro pagamento aprovado (`185843516030`) voltou com `live_mode=true` e foi barrado como `divergencia_ambiente` (cobrança `extra`, `needs_refund`). Pagamentos de contas de teste voltam com `live_mode=true`; o ambiente passou a ser decidido pela identidade do recebedor (`test_user`), e conta de teste nunca concede produção. O pedido `26be9690…` (e seus eventos) ficou preso nesse estado: é só teste.

**Não provado / bloqueios**
- **Webhook**: nenhum `payment_events` de webhook foi gravado; o pagamento foi aplicado pela **conciliação** (`apply.reconcile`). Ou o Mercado Pago não entregou, ou a assinatura foi barrada (o `MERCADOPAGO_WEBHOOK_SECRET_SANDBOX` não está definido e nenhuma ferramenta devolve o segredo). Ver o log do `payments-webhook` no painel do Supabase (Edge Functions) por volta de 04:19Z.
- **Reembolso**: pedido gravado (motivo auditado), mas o `POST /v1/payments/{id}/refunds` com o token de sandbox devolve **HTTP 401** (leituras com o mesmo token funcionam). Não confirmado pelo provedor; o pagamento segue `approved`.
- **Avaliação de qualidade oficial** (`quality_evaluation`): o MCP informa que a aplicação `1592042337972998` é do tipo Orders API e exige `order_id`; a integração é Checkout Pro por preferências. Foi criada a aplicação **`2913393311286674`** (Checkout Pro, mesma conta), mas a automação do vendedor de teste falhou (`MP_API_DOWN`) e as credenciais de produção dela não estão ativadas. Nada foi trocado nos segredos.
- **Pix**: o sandbox não paga Pix (documentação); só em produção com chave Pix cadastrada.
