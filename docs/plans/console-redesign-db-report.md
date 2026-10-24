# Console redesign: relatório da Tarefa 1 (DB)

Arquivos:
- `supabase/migrations/20261024000100_console_redesign.sql`
- `supabase/rollback/20261024000100_console_redesign.down.sql` (testado: aplicado numa transação no stack local, removeu colunas, funções, triggers e o job; `reveal_due_events()` e `audit_integrity()` = `ok` depois; transação desfeita)
- `supabase/tests/database/12_console.test.sql` (199 asserções)
- `supabase/tests/database/02_v2_studio_admin.test.sql`: só a expectativa da lista de jobs `mm-*` passou de 6 para 7 (entrou `mm-purge-anon-orphans`)

## O que foi implementado
- `events.is_test` e `profiles.is_test` (`boolean not null default false`). Backfill em `console_backfill_test_flags()`, chamada pela migration e idempotente: perfil com e-mail `@memoriesmt.test`; evento com título `like 'TESTE%'` (sensível a maiúsculas, então "Testemunhas" fica de fora), `ilike 'teste homologa%'`, `like 'RT %'`, ou anfitrião com perfil de teste. A marca só é ligada, nunca desligada.
- Trigger `is_test_guard` em events e profiles: cliente (`authenticated`/`anon`) não muda `is_test`. Só o master pela RPC, ou o dono.
- Trigger `audit_logs_fill_actor` (before insert): preenche `actor_role` e `target_type='event'`/`target_id` quando vierem vazios.
- Revelação: `release_reveal(event, at, source)` é a rotina única. `reveal_due_events()` foi reescrita com `create or replace` para chamá-la (mesmo UPDATE, mesma trilha `reveal.released`, mesmo `detail`), e `admin_reveal_now` também chama.
- 11 RPCs, todas `security definer`, `search_path=''`, `revoke ... from public, anon`, `grant ... to authenticated`. Leitura: `is_platform_staff()`. Ações sensíveis: `is_master()`, depois `admin_reason()` (10 a 500 caracteres, MM011), depois `admin_log()`.
- `purge_anon_orphans()` e o job diário `mm-purge-anon-orphans` (`41 4 * * *`), criado com `active=false`. O job é protegido por `to_regclass('cron.job')`.
- Pagamentos, `payments_env` e as funções `payments-*` não foram tocados. Só há leitura de `payment_orders` e `payment_events`, e só para master.

## Desvios do contrato (a UI precisa saber)
1. **Vocabulário de `actor_role`.** O check existente em `audit_logs` só aceita `master|support|auditor|organizador|convidado|operador|sistema`. Então o trigger grava `sistema`, `organizador`, `convidado` e o papel real (`master`, `support` ou `auditor`), e não `system`, `organizer`, `guest` nem `staff`. Ordem de decisão: sem ator (sem `actor_id` e sem `auth.uid()`) vira `sistema`; anfitrião do evento vira `organizador`; papel de plataforma ativo vira o próprio papel; o resto vira `convidado`.
2. **Sem backfill físico da auditoria.** `audit_logs` é imutável: UPDATE é barrado por um trigger ENABLE ALWAYS, e desligar esse trigger é barrado pelo event trigger. Por isso as linhas antigas não são reescritas. `admin_list_audit_v2` e `admin_event_detail` devolvem o papel e o alvo **derivados na leitura** quando a coluna está nula.
3. **Ações sensíveis só para master.** `admin_reveal_now`, `admin_set_test_flag` e `admin_soft_delete_test_events` exigem `is_master()`, porque `admin_log` já exige. support e auditor recebem MM004.
4. **Dado de pagamento só para master**, como em `admin_list_payments`. Para os outros papéis: `kpis.revenueCents = {value:null, previous:null, spark:[]}`, `alerts.paymentDivergences = null`, `admin_event_detail.orders = []` e `admin_search.orders = []`. Na busca, usuário por e-mail também é só para master. Os demais papéis buscam por nome ou id e recebem o e-mail mascarado (`h***@dominio`).
5. **`admin_set_test_flag` com valor `false`** audita como `admin.unset_test_flag`, para o valor não se perder, já que `admin_log` não tem `detail`. Com `true`, audita `admin.set_test_flag`. É um registro por evento alterado.
6. **`admin_list_events_v2`:**
   - `p_status` aceita `ativo|encerrado|excluido|null`. `excluido` lista só os itens com `deleted_at`; os outros valores escondem os excluídos.
   - `p_sort` aceita `createdAt` (padrão), `startAt`, `title`, `hostName`, `participants`, `photos`, `revealAt` e `status`. `p_dir` aceita `asc` ou `desc` (padrão `desc`). Valor fora da lista dá MM005.
   - O item ganhou `createdAt`.
   - `status` vale `excluido` no item apagado.
7. **Chaves extras** (não quebram o contrato):
   - overview: `from`, `to`, `includeTests`, `generatedAt`;
   - listas: `limit`, `offset`;
   - storage: `totalBytes`;
   - health: `cronAvailable`;
   - reveal_now: `eventId`, `revealedAt`;
   - set_test_flag: `{ok, updated}`; soft_delete: `{ok, deleted}`.
8. **`admin_search`:** termo com menos de 2 caracteres devolve as três listas vazias. Evento é encontrado por título, id ou código de compartilhamento, mas o código não é devolvido.

## Formas JSON devolvidas (exemplo real do stack local, abreviado)
```
admin_overview(p_days int=30, p_include_tests bool=false)            -- MM005 se p_days fora de 1..366
{ days, from, to, includeTests, generatedAt,
  kpis: { activeEvents|participants|photos|revenueCents: { value:int|null, previous:int|null, spark:int[p_days] } },
  series: [{ day:"2026-10-23", photos, joins, eventsCreated }]   -- p_days pontos, dia local America/Cuiaba
  funnel: { created, withParticipant, withPhoto, revealed },      -- eventos criados no período
  upcomingReveals: [{ eventId, title, revealAt, isTest }],        -- até 10 não revelados, por revealAt (atrasados primeiro)
  storage: { originals:int, derived:int, orphans:int, bytes:int },
  jobs: [{ name, ok }],                                           -- ok = última corrida não 'failed'
  readiness: { companyCnpj, companyLegalName, supportEmail, supportPhone: bool, paymentsEnv:"desligado|sandbox|production", lastWebhookAt:ts|null },
  alerts: { pendingReveals, overdueReveals, lgpdPending, lgpdOverdue, settingsMissing, paymentDivergences:int|null, failingJobs } }
```
Regras do overview:
- **Período:** começa à meia-noite local de (hoje menos p_days menos 1) e vai até agora. `previous` é o período anterior, de mesmo tamanho.
- **activeEvents:** `value` = ativos agora; `previous` = ativos em agora menos p_days; `spark` = ativos no fim de cada dia.
- **Filtro de testes:** sem `include_tests`, saem os eventos `is_test` e tudo o que pertence a eles (entradas, fotos, receita).
- **failingJobs:** conta só jobs ativos cuja última corrida falhou.
```
admin_list_events_v2(p_limit=25, p_offset=0, p_search, p_status, p_include_tests=false, p_sort, p_dir)
{ total, limit, offset, items: [{ id, title, hostName, hostId, status:"ativo|encerrado|excluido", startAt, createdAt,
  revealState:"desativada|revelada|atrasada|pendente", revealAt, participants, photos, failedUploads, capacity, shotsPerPerson,
  planCode, isTest, deletedAt }] }
```
`hostName` = `coalesce(nullif(host_name,''), profiles.display_name, '')`, sem concatenar. `planCode` vem de `effective_entitlement`.
```
admin_event_detail(p_event uuid)                                    -- MM005 se não existe (apagados também são lidos)
{ event: { id, title, category, hostId, hostName, status, startAt, endAt, createdAt, deletedAt, revealEnabled, revealAt, revealedAt,
           revealState, capacity, shotsPerPerson, isTest, timezone, participants, photos, failedUploads },
  entitlement: { planCode, maxGuests, maxShots, source },
  timeline: [{ at, kind:"created|started|first_join|first_photo|ended|reveal_scheduled|revealed|deleted", label }],
  participants: [{ name, joinedAt, isHost }],                     -- até 200
  orders: [{ id, status, amountCents, createdAt }],               -- só master; até 50
  audit: [{ at, action, actorRole, reason }] }                    -- últimas 50
```
Sem fotos, sem código e sem token.
```
admin_search(p_q text)  -> { events:[{id,title}], users:[{userId,email}], orders:[{id,eventId,status}] }   -- até 5 cada
admin_list_users_v2(p_limit=50, p_offset=0, p_kind 'google|email|anon'|null, p_include_tests=false, p_search)
{ total, limit, offset, summary:{ google, email, anon, orphanAnon },
  items:[{ userId, isAnonymous, provider, email, createdAt, lastSignInAt, platformRole, eventsLinked, isTest, orphanAnon }] }
admin_list_audit_v2(p_limit=50, p_offset=0, p_category 'participante|consentimento|revelacao|admin|pagamento'|null, p_event uuid)
{ total, limit, offset, items:[{ id, at, actorId, actorRole, eventId, action, targetType, targetId, reason, eventTitle, sensitive }] }
admin_storage_breakdown()
{ originals:{n,bytes}, derived:{n,bytes}, orphans:{n,bytes}, branding:{n,bytes}, avgPhotoBytes, totalBytes, growth:[{day,bytes}] }
admin_health_history(p_limit=24)                                    -- 1..100
{ cronAvailable, jobs:[{ name, schedule, active, runs:[{ startedAt, durationMs, status }], consecutiveFailures }] }
admin_reveal_now(p_event, p_reason)            -> { ok:true, eventId, revealedAt }   MM004 · MM011 · MM005 (sem revelação/apagado) · MM008 (já revelado)
admin_set_test_flag(p_events uuid[], p_value, p_reason) -> { ok:true, updated }      MM004 · MM011 · MM005 (lista vazia, >500, id inexistente)
admin_soft_delete_test_events(p_events, p_reason)       -> { ok:true, deleted }      MM004 · MM011 · MM005 (algum evento is_test=false recusa o lote inteiro)
```
Regras das listas e da busca:
- **summary** conta a base inteira (respeitando `p_include_tests`), sem os filtros de tipo e de busca.
- **orphanAnon** = conta anônima sem linha em participants.
- **eventsLinked** = eventos que a pessoa hospeda (não apagados) somados aos em que é participante.
- **Categorias de auditoria** (por prefixo de `action`):
  - participante: `participant.`, `invitation.`
  - consentimento: `consent.`, `account.`
  - revelacao: `reveal.`
  - admin: `admin.`, `platform_role.`, `platform_settings.`, `feature_flags.`, `plan.`, `entitlement.`, `audit.`, `code.`, `system.`, `retention.`, `event.`, `photo.access`
  - pagamento: `payment.`, `apply.`
- **sensitive** é verdadeiro quando há motivo ou quando a ação é administrativa (`admin.`, papel, setting, flag, `plan.updated`, cortesia, reembolso, acesso a foto, `audit.`).
- **Órfão no Storage** = objeto em `event-photos` sem a linha em `photos` correspondente ao original ou ao `.thumb`. `growth` cobre os últimos 30 dias locais.

## Evidência RED/GREEN
- Base antes da mudança: 11 arquivos, 1120 testes, PASS.
- RED: com `12_console.test.sql` escrito e sem migration, o arquivo 12 falhou (`function public.console_backfill_test_flags() does not exist`, nenhuma subtest rodou). Os outros 11 continuaram verdes.
- GREEN: `sb db reset` + `sb test db` deram 12 arquivos, **1319 testes, PASS** (199 no 12_). A única outra mudança foi a expectativa de jobs no 02_, de 6 para 7.

## Pontos em aberto
- **Primeira execução de `purge_anon_orphans()` no projeto hospedado.** Ela faz `delete from auth.users` como dono da função (postgres). Localmente funciona. No hospedado, depende de o `postgres` manter DELETE em `auth.users`; se não tiver, a função falha com erro, sem apagar nada em silêncio. O job nasce inativo: antes de ligar, rodar `select public.purge_anon_orphans()` à mão uma vez. Para ativar: `select cron.alter_job(jobid, active := true) from cron.job where jobname = 'mm-purge-anon-orphans'`.
- **O job usa `cron.alter_job`** (pg_cron 1.5 ou mais novo; o Supabase usa 1.6).
- **Linha `reveal.released` gravada por `admin_reveal_now`:** fica com `actor_id` nulo (igual à da rotina) e `actor_role='master'` (derivado de `auth.uid()`). Quem fez a ação está na linha `admin.reveal_now`.
- **`reveal_due_events()` mudou de corpo** (`create or replace`) para reusar `release_reveal`. O comportamento é o mesmo e a suíte 01 continua verde. A reversão restaura o corpo original.
- **Custo do overview:** `spark` de `activeEvents` faz uma contagem por dia sobre `events`, o que basta para o volume atual. Com p_days=366 e muitos eventos, vale um índice ou uma tabela de agregados.
- **Aplicação no remoto:** é do operador (`supabase db push`). Até lá, a UI deve usar o fallback `rpcOr`.
