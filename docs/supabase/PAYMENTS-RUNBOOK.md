# Runbook de pagamentos (AbacatePay Pix transparente): aplicar, homologar no sandbox, desligar e diagnosticar

Projeto Supabase: `asyaegeodyttttaubvxh`. Rode os comandos na raiz do repositório, na branch `feat/product-production` ou numa branch que a contenha, com a CLI logada na conta dona do projeto.

Front-end: o projeto Vercel é `newmemocuiaba` (domínio `newmemocuiaba.vercel.app`). Não use `memoriesmt-v2` nem crie projeto novo. O deploy, o merge e a promoção da Vercel ficam com a sessão `memo-reverse-65` (branch `feat/final-ui`); este runbook só faz referência a eles.

Nenhum valor real aparece aqui. `<...>` marca o que o operador preenche, sempre fora do repositório.

## Estado em 22/10/2026 (conferido, somente leitura)

- **Migrations.** `supabase migration list --linked` mostra local = remoto até `20261022001300`. Pendentes, só no local: `20261022001400_plans_entitlements`, `001500_entitlement_enforcement`, `001600_payments`, `001700_payments_admin_public` e `001800_courtesy_codes`. O `db push --linked --dry-run` lista exatamente essas 5.
- **Por que não foram aplicadas.** O classificador de segurança da ferramenta negou `supabase db push --linked --yes` à sessão do agente, e isso não foi contornado: nada de MCP `apply_migration`, SQL Editor ou deploy de functions. A aplicação é do operador, pelos passos 2 a 4.
- **Backup.** O backup recente fica em `~/Backups/memoriesmt/20261022-1902`, com `schema.sql`, `data.sql`, `storage/` (bucket `event-photos`) e `SHA256SUMS.txt`. A conferência `shasum -c` deu 13/13 OK.
  - **Lacuna:** o bucket `event-branding` (logos e capas, criado pela migration `…0300`, já aplicada) **não** está nesse backup. O script copia só `event-photos`. Ver o passo 1.
- **Credencial.** Não existe chave AbacatePay, nem de sandbox nem de produção.
  - Depois de aplicadas as migrations, o remoto fica com `payments_env = 'desligado'` (valor do seed) e a cobrança pública desligada. Só o Grátis e "Fale com a gente" aparecem; o checkout responde 503.
  - Os passos 5 a 9 dependem da chave de sandbox.
- **Rotação de backups:** rotação de backups é manual, executada pelo operador a cada ≤ 30 dias; não é automação ativa.
  - O único agendador persistente no lugar onde os backups locais ficam é um LaunchAgent no Mac do operador. Há um exemplo, não instalado, em `origin/feat/final-ops:supabase/ops/com.memoriesmt.backup.plist.example`.
  - Instalá-lo é ação do dono (ver "Rotação de backups").

## Ordem (não pule etapas)

| # | Etapa | Depende de | Quem |
|---|---|---|---|
| 1 | Backup (banco + `event-photos` + `event-branding`) | — | operador |
| 2 | `migration list` e `db push --dry-run` | 1 | operador |
| 3 | `db push --linked --yes` (001400…001800) | 2 | operador |
| 4 | Deploy das 5 functions | 3 | operador |
| 5 | Segredos das functions (env-file fora do repo) | chave sandbox | operador |
| 6 | Vault e agendamento de `mm-payments-reconcile` | 4, 5 | operador |
| 7 | Webhook no sandbox AbacatePay | 4, 5 | operador |
| 8 | `payments_env = "sandbox"`, só durante a janela de homologação | 5–7 | operador (Master) |
| 9 | Homologação H-01…H-17 e volta a `"desligado"` | 8 | operador + agente |

Os passos 1 a 4 podem ser feitos já, sem chave. Com `payments_env='desligado'` nada é cobrado. Sem segredos, as functions de pagamento respondem 503 (configuração inválida) e nunca chamam a API real.

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
supabase migration list --linked          # remoto até 20261022001300; 001400…001800 só no local
supabase db push --linked --dry-run       # deve listar exatamente as 5: 20261022001400, 001500, 001600, 001700, 001800
```

Se o dry-run listar qualquer outra migration (por exemplo `≥ 20261022002000`, da outra sessão), **pare**. Combine a ordem com a sessão `memo-reverse-65` antes de aplicar.

## 3. Aplicar as migrations

```bash
supabase db push --linked --yes
supabase migration list --linked          # as 24 com local = remoto
```

- **Transação:** cada migration roda na sua. A que falhar não deixa alteração pela metade. Anote o arquivo, não edite as já aplicadas e traga a saída.
- **O que fica valendo:** as 5 são aditivas. Os eventos existentes ganham o direito `legado` (limites atuais preservados), e `payments_env` nasce `"desligado"`.
- **Agendamento:** a `001700` tenta agendar o `mm-payments-reconcile`. Sem os segredos do Vault, emite um `notice` e não agenda (esperado; ver o passo 6).

Verificação, no SQL Editor:

```sql
select public.payments_env();                                   -- desligado
select jsonb_array_length(public.list_public_plans());          -- 1 (só o Grátis enquanto desligado)
select code, price_cents, sandbox_active, production_active from public.plans order by sort;  -- preços aprovados: 0, 2900, 8900, 18900, 34900
select count(*) from public.events e where not exists (select 1 from public.event_entitlements x where x.event_id = e.id);  -- 0
select jobname from cron.job where jobname = 'mm-payments-reconcile';  -- 0 linhas até o passo 6
```

Conferido no stack local: os 5 planos com esses preços, `payments_env()` = `desligado` e `list_public_plans()` com 1 item.

## 4. Deploy das Edge Functions

```bash
supabase functions deploy payments-checkout payments-status payments-refund --project-ref asyaegeodyttttaubvxh --use-api
supabase functions deploy payments-webhook payments-reconcile --no-verify-jwt --project-ref asyaegeodyttttaubvxh --use-api
supabase functions list --project-ref asyaegeodyttttaubvxh      # as 5 ACTIVE (mais finalize-asset e purge-storage)
```

- **JWT:** `payments-checkout`, `payments-status` e `payments-refund` exigem JWT do usuário (`verify_jwt=true`). `payments-webhook` e `payments-reconcile` ficam **sem** JWT, porque a AbacatePay e o pg_cron não mandam JWT:
  - o webhook exige `?webhookSecret` mais `X-Webhook-Signature`;
  - o reconcile exige `Authorization: Bearer PAYMENTS_CRON_TOKEN`.
- **CORS:** a lista fixa já aceita `https://newmemocuiaba.vercel.app` e os previews `newmemocuiaba-*-mzinhoww-gmailcoms-projects.vercel.app`. Para domínio próprio, defina o segredo `ALLOWED_ORIGINS`.

Verificação sem credencial (cada uma deve recusar):

```bash
F=https://asyaegeodyttttaubvxh.supabase.co/functions/v1
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$F/payments-webhook"      # 401 (sem segredo) — ou 503 enquanto os segredos do passo 5 não existem
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$F/payments-reconcile"    # 401 (sem token)   — ou 503 sem segredos
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$F/payments-checkout"     # 401 (gateway: sem JWT)
```

## 5. Segredos das functions (só com a chave sandbox em mãos)

Crie o arquivo **fora do repositório**, por exemplo `~/.config/memoriesmt/payments-sandbox.env`, com `chmod 600`. Só os nomes aparecem aqui:

```
ABACATEPAY_API_KEY=<chave sandbox, começa com abc_dev_>
ABACATEPAY_ENV=sandbox
ABACATEPAY_WEBHOOK_SECRET=<saída de: openssl rand -hex 32>
ABACATEPAY_HMAC_KEY=<chave pública HMAC copiada de /pages/webhooks/security da AbacatePay>
PAYMENTS_CRON_TOKEN=<saída de: openssl rand -hex 32>
```

```bash
supabase secrets set --project-ref asyaegeodyttttaubvxh --env-file ~/.config/memoriesmt/payments-sandbox.env
supabase secrets list --project-ref asyaegeodyttttaubvxh        # só nomes e digests; os 5 nomes acima presentes
```

- **`ABACATEPAY_BASE_URL`:** **não** defina no remoto. Ela só serve para a fake local, e a função recusa qualquer host que não seja `localhost`, `127.0.0.1` ou `host.docker.internal`.
- **Prefixo da chave:** `abc_dev_` só vale com `ABACATEPAY_ENV=sandbox`, e `abc_prod_` só com `production`. Combinação trocada → 503.
- **Permissões da chave:** a chave precisa de `TRANSPARENT:CREATE`, `TRANSPARENT:READ` e `REFUND:CREATE`; para o passo 7 por API, também `WEBHOOK:CREATE`. As permissões não mudam depois de criada a chave.
- **Formato do segredo do webhook:** só hex (`openssl rand -hex 32`). Ele vai na query string, e caracteres como `+`, `/` ou `=` quebram a comparação.

## 6. Vault e agendamento da conciliação (`mm-payments-reconcile`, a cada 5 min)

1. **No painel** (Integrations → Vault → Add new secret), para o valor não ficar no histórico do SQL Editor:
   - `mm_payments_cron_token` = **o mesmo** valor de `PAYMENTS_CRON_TOKEN` do passo 5;
   - `mm_payments_reconcile_url` = `https://asyaegeodyttttaubvxh.supabase.co/functions/v1/payments-reconcile`. É obrigatório: não há URL fixa no job.
2. No SQL Editor, como `postgres`:

```sql
select public.payments_schedule_reconcile();                    -- true (false + notice = falta segredo; ler a mensagem)
select jobname, schedule, active from cron.job where jobname = 'mm-payments-reconcile';   -- */5 * * * *, true
-- 5 a 10 min depois:
select status_code, left(content, 120) from net._http_response order by created desc limit 3;   -- 200 {"ok":true,...}; 401 = token do Vault ≠ PAYMENTS_CRON_TOKEN
```

`cron.job_run_details` mostra `succeeded` mesmo quando o HTTP falha, porque o cron só enfileira a chamada. A resposta real aparece em `net._http_response`, que tem retenção de cerca de 6 h.

## 7. Webhook no sandbox AbacatePay

- **Onde criar:** no dashboard AbacatePay **em dev mode** (Webhooks → novo) ou por `POST https://api.abacatepay.com/v2/webhooks/create` com a chave sandbox.
- **Nome:** `MemoriesMT sandbox`.
- **Endpoint:** `https://asyaegeodyttttaubvxh.supabase.co/functions/v1/payments-webhook?webhookSecret=<ABACATEPAY_WEBHOOK_SECRET>`.
- **Secret:** o mesmo valor hex de `ABACATEPAY_WEBHOOK_SECRET`.
- **Eventos:** `transparent.completed`, `transparent.refunded`, `transparent.disputed` e `transparent.lost`.

Por API, com o corpo num arquivo temporário fora do repo, apagado depois:

```bash
curl -s -X POST https://api.abacatepay.com/v2/webhooks/create \
  -H "Authorization: Bearer <chave sandbox>" -H "Content-Type: application/json" \
  --data @<arquivo fora do repo com {"name","endpoint","secret","events"}>
```

- **Prova de autenticação:** uma entrega sem `webhookSecret` ou com assinatura errada recebe 401 e não muda nada (coberto na integração local).
- **Webhook de sandbox ≠ produção:** webhooks de dev mode não recebem eventos de produção. Na transição, crie outro webhook com segredo novo e desative este.

## 8. Abrir a janela de homologação (`payments_env = "sandbox"`)

`admin_set_setting` exige Master, isto é, claim `app_metadata.role = master` mais papel ativo em `platform_roles`, e grava a auditoria com o motivo. No SQL Editor, numa transação só:

```sql
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', (select user_id from public.platform_roles where role = 'master' and revoked_at is null order by granted_at limit 1),
  'role', 'authenticated', 'app_metadata', json_build_object('role', 'master'))::text, true);
select public.admin_set_setting('payments_env', '"sandbox"'::jsonb, '<motivo: janela de homologação sandbox, data e responsável>');
commit;
select public.payments_env();                                   -- sandbox
select jsonb_array_length(public.list_public_plans());          -- 5 (Grátis + 4 pagos ativos no sandbox)
```

- **Teste local:** o padrão foi testado no stack local, dentro de uma transação com ROLLBACK: `sandbox` e depois `desligado`.
- **Auditoria:** fica uma linha `platform_settings.update` em `audit_logs`, com o motivo e sem o valor.
- **Duração:** mantenha `"sandbox"` **só** durante a janela. Mesmo no sandbox, a interface pública oferece os planos e cria Pix de dinheiro fictício. Ao terminar:

```sql
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', (select user_id from public.platform_roles where role = 'master' and revoked_at is null order by granted_at limit 1),
  'role', 'authenticated', 'app_metadata', json_build_object('role', 'master'))::text, true);
select public.admin_set_setting('payments_env', '"desligado"'::jsonb, '<motivo: fim da janela de homologação sandbox>');
commit;
select public.payments_env();                                   -- desligado
```

Pedidos já abertos continuam sendo conciliados com `"desligado"`: webhook e reconcile processam os pedidos do ambiente da chave (Ruling 13). Só checkout, status e refund passam a responder 503.

**Pagar no sandbox:** depois do checkout pela interface, chame `POST /v2/transparents/simulate-payment` com a chave sandbox e o id da cobrança (`provider_charge_id`). O dinheiro é fictício (`devMode: true`).

## 9. Rollback

| Situação | Ação | Efeito |
|---|---|---|
| Qualquer problema de cobrança | `admin_set_setting('payments_env','"desligado"', <motivo>)` (passo 8) | Desliga a compra na hora, sem deploy. Só o Grátis; checkout 503 |
| Function com defeito | Redeploy da versão anterior, a partir de um checkout do SHA anterior: `supabase functions deploy <nome> --project-ref asyaegeodyttttaubvxh --use-api` (mais `--no-verify-jwt` para webhook/reconcile) | Na primeira publicação não há versão anterior: com `desligado` o checkout já não opera; em último caso, `supabase functions delete <nome> --project-ref …` |
| Conciliação disparando erro | `select cron.unschedule('mm-payments-reconcile');` | Para o job; reagendar com `payments_schedule_reconcile()` |
| Migration | **Não revertida.** As 5 são aditivas; recuperação de dados só pelo backup do passo 1, num projeto novo, por decisão do dono | — |
| Front-end | `vercel rollback <dpl>` no projeto `newmemocuiaba`, feito pela sessão `memo-reverse-65` (dona da Vercel) | Volta a promoção anterior |

Pedidos já pagos continuam válidos depois de qualquer rollback. Reembolsos são feitos pelo Master (`/master/pagamentos`).

## 10. Diagnóstico

No SQL Editor (só contagens e ids; não copie `brcode` nem dados pessoais para fora):

```sql
-- pedidos por estado e ambiente
select provider_env, status, count(*), bool_or(needs_refund) as algum_needs_refund from public.payment_orders group by 1, 2 order by 1, 2;
-- linha do tempo de um pedido
select id, status, plan_code, amount_cents, provider_charge_id is not null as tem_cobranca, expires_at, paid_at, refund_requested_at, needs_refund
  from public.payment_orders where id = '<orderId>';
select id, event_type, provider_event_id, outcome, received_at from public.payment_events where order_id = '<orderId>' order by id;
-- resultados de webhook/conciliação nas últimas 24 h
select outcome, count(*) from public.payment_events where received_at > now() - interval '24 hours' group by 1 order by 2 desc;
-- direito efetivo do evento
select public.effective_entitlement('<eventId>');
```

- **Divergências:** `admin_payment_divergences()` só responde a Master. Use `/master/pagamentos`, que lista as divergências com o selo "precisa de ação", ou o bloco `set_config` do passo 8 antes do `select * from public.admin_payment_divergences();`.
- **Tipos de divergência:**
  - do estado atual: `pago_sem_direito`, `direito_sem_pedido_pago`, `pendente_1h`, `needs_refund` e `em_disputa`;
  - dos `payment_events` dos últimos 30 dias: `pago_ignorado_reembolsar`, `upgrade_base_estornado`, `divergencia_valor`, `divergencia_ambiente`, `divergencia_cobranca` e `transicao_ignorada`.
- **Logs das functions:** em Edge Functions → `<função>` → Logs, filtre pelo texto do `orderId`. Cada linha é `{fn, orderId, status, outcome}`, sem chave, brCode nem corpo.
- **Valores comuns de `outcome`:**
  - `cobranca_criada`, `reusado` e `aplicado`: caminho normal;
  - `duplicado`: entrega repetida, ignorada;
  - `nao_autenticado`: webhook sem segredo ou com assinatura errada;
  - `ambiente_divergente`: o `devMode` não bate com o ambiente;
  - `pedido_desconhecido`;
  - `cobranca_adotada` e `cobranca_nao_confere`: create sem resposta;
  - `sem_cobranca`: virou `falhou`;
  - `cobranca_nao_paga`: o refund recusou porque o provedor não mostra PAID.

**O que fazer:**
- **`needs_refund`.** O dinheiro entrou, mas o plano não foi liberado: o pedido foi cancelado ou substituído, ou o plano já estava coberto.
  1. Conferir na divergência (`needs_refund` ou `pago_ignorado_reembolsar`).
  2. Em `/master/pagamentos`, "Solicitar reembolso", com motivo de 10 a 500 caracteres. Isso aceita `pago`, ou `cancelado` com `needs_refund` (Ruling 16).
  3. A função reconsulta o provedor, exige PAID e a mesma cobrança, e chama o refund.
  4. O webhook `transparent.refunded`, ou a conciliação, fecha em `estornado` e limpa `needs_refund`.
  5. Se aparecer "A AbacatePay já não mostra a cobrança como paga", aguarde a conciliação (até 5 min).
- **`em_disputa`.** O cliente contestou no banco.
  - O sistema **não** reembolsa: o provedor recusa reembolso de cobrança disputada (Ruling 14), e o botão não aparece.
  - O direito continua até o resultado.
  - Acompanhe no dashboard AbacatePay. `transparent.lost` leva a `perdido` e revoga o direito; ganho leva de volta a `pago`.
  - Registre a decisão no motivo de qualquer ação manual.
- **`pendente_1h`.** Rode a conciliação (espere o job ou confira `net._http_response`). Se o job não existir, volte ao passo 6.
- **`pago_sem_direito` / `direito_sem_pedido_pago`.** Incoerência entre pedido e direito: não corrija por SQL. Leve o `orderId`, o `eventId` e os `payment_events` para análise.

## 11. Procedimento local reproduzível (fake AbacatePay, sem chave real)

Serve para qualquer pessoa reproduzir a integração inteira sem rede externa. A fake fica em `web/e2e/fixtures/fake-abacatepay.mjs`. Ela implementa create, check, get, list, refund e simulate-payment, assina o webhook como o provedor (`?webhookSecret` + `X-Webhook-Signature`) e tem controles em `/__control/*`: forçar 500, desligar o webhook, reenviar com o mesmo id e trocar o `devMode`.

1. Stack local: `supabase start` (nesta worktree, use o wrapper isolado `.superpowers/sdd/2026-10-22-memoriesmt-product-production/sb` no lugar de `supabase`, com portas 564xx), seguido de `supabase db reset`.
2. Arquivo de ambiente **fora do Git**, com modo 600 e **só valores fictícios**:

```
ABACATEPAY_API_KEY=abc_dev_fake-<openssl rand -hex 8>
ABACATEPAY_BASE_URL=http://host.docker.internal:56490/v2
ABACATEPAY_ENV=sandbox
ABACATEPAY_WEBHOOK_SECRET=<openssl rand -hex 32>
ABACATEPAY_HMAC_KEY=<openssl rand -hex 32>
PAYMENTS_CRON_TOKEN=<openssl rand -hex 32>
FAKE_ABACATEPAY_PORT=56490
```

3. Em um terminal: `supabase functions serve --env-file <arquivo>`. **Atenção:** `db reset` derruba o serve; reinicie-o depois de cada reset.
4. Em outro terminal, pegue `API_URL`, `PUBLISHABLE_KEY` e `SERVICE_ROLE_KEY` de `supabase status -o env` (chaves locais de demonstração) e rode:

```bash
cd web
SUPABASE_URL=<API_URL> SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY> SUPABASE_SERVICE_KEY=<SERVICE_ROLE_KEY> \
PAYMENTS_FUNCTIONS_ENV_FILE=<arquivo> npx vitest run --config vitest.integration.config.ts integration/payments.itest.ts
```

   A fake sobe dentro do processo de teste, e o teste recusa rodar se `SUPABASE_URL` não for local.
5. Demais suítes:
   - `supabase test db` (pgTAP; 08_payments, 09_payments_admin e 10_courtesy_codes cobrem as regras financeiras);
   - `cd web && npx vitest run --config vitest.functions.config.ts` (unit das functions);
   - `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`.
6. Bundle sem segredo: `grep -rE "abc_(dev|prod)_|ABACATEPAY|service_role|PAYMENTS_CRON" web/.next/static` deve voltar vazio.
7. Pare o `functions serve` (Ctrl-C) ao terminar.

Resultado de 22/10/2026 (SHA `1a6c982`) em `docs/supabase/PRODUCT-PRODUCTION-HOMOLOGATION.md`.

## 12. Transição para produção (não executar sem autorização explícita do dono)

Resumo da seção 6 do plano (`docs/superpowers/plans/2026-10-22-memoriesmt-product-production.md`).

1. **Conta AbacatePay de produção.** Exige CNPJ e site no ar com contato, termos, privacidade e CNPJ no rodapé; análise de até 3 dias úteis. Depende de D5.
2. **Credenciais.** Nova chave `abc_prod_` com `TRANSPARENT:CREATE`, `TRANSPARENT:READ` e `REFUND:CREATE`; `ABACATEPAY_ENV=production` e `ABACATEPAY_WEBHOOK_SECRET` novo, pelo passo 5.
3. **Webhook.** Novo **no ambiente de produção**; desativar o de sandbox.
4. **Ambiente.** `admin_set_setting('payments_env','"production"', <motivo>)`; conferir `list_public_plans()` como anônimo.
5. **Fiscal e legal.** NFS-e (D6), cláusula de pagamento e reembolso nos termos (D3) e nova versão em `legal_documents`.
6. **Verificação controlada.** Uma compra real do menor plano, pelo dono, em evento próprio; depois reembolso pelo Master até `estornado`.
