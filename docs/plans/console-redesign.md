# Redesign do Console Master — plano de implementação

**Pedido:** prompt do dono (23/10/2026) + referência https://claude.ai/artifact/1W6xDeknx7QsWftUPRjhST. Branch `feat/console-redesign` a partir de `main` (4522a46). Entrega: PR + preview; sem merge nem promoção.

## Restrições globais (valem para toda tarefa)
- Não tocar `payments_env`, segredos, `supabase/functions/payments-*`, checkout, webhook nem os campos que `/master/pagamentos` lê. Pagamentos/Planos/Códigos: só apresentação sobre RPCs existentes.
- Sem hard delete. Testes: `is_test` + filtro desligável; exclusão em lote = soft delete (`deleted_at`) só de eventos `is_test`, com justificativa e auditoria.
- Migrations aditivas, faixa `20261024000100+`, com arquivo de reversão em `supabase/rollback/`. Toda RPC nova: `security definer`, `search_path=''`, checa `is_platform_staff()`/`is_master()`, `revoke ... from public, anon`, grant só a `authenticated`; ação sensível exige `admin_reason` e grava `admin_log`.
- Privacidade: nenhuma foto, token de convite ou e-mail completo para quem não é master.
- **Aplicação no remoto é do operador** (`supabase db push`; o agente não tem permissão: CLI negada pelo classificador e MCP Supabase sem acesso ao projeto). Até lá a UI precisa funcionar com as RPCs antigas: `data.ts` ganha `rpcOr(name, args, fallback)` que, quando a RPC nova não existe (PostgREST `PGRST202` / `42883`), chama a antiga e marca `degraded: true`; a página mostra um aviso discreto "Dados completos após a atualização do banco".
- UI: tokens existentes (`admin.css`, tema escuro quente, Bricolage, lima ✳); cores semânticas ok/warn/crit/info separadas do lima; `tabular-nums`; sem emoji, gradiente ou faixa lateral colorida; até 400 px sem rolagem horizontal da página; foco visível; PT-BR sem travessão.

## Contratos das RPCs novas (migration `20261024000100_console_redesign.sql`)
Todas retornam `jsonb`. `p_include_tests` padrão `false`.
- `admin_overview(p_days int, p_include_tests bool)` → `{ days, kpis: { activeEvents, participants, photos, revenueCents } each {value, previous, spark:int[]}, series:[{day, photos, joins, eventsCreated}], funnel:{created, withParticipant, withPhoto, revealed}, upcomingReveals:[{eventId,title,revealAt,isTest}], storage:{originals, derived, orphans, bytes}, jobs:[{name, ok}], readiness:{companyCnpj, companyLegalName, supportEmail, supportPhone: bool, paymentsEnv: text, lastWebhookAt}, alerts:{pendingReveals, overdueReveals, lgpdPending, lgpdOverdue, settingsMissing, paymentDivergences, failingJobs} }`
- `admin_list_events_v2(p_limit, p_offset, p_search, p_status, p_include_tests, p_sort text, p_dir text)` → `{ total, items:[{id,title,hostName,hostId,status,startAt,revealState,revealAt,participants,photos,failedUploads,capacity,shotsPerPerson,planCode,isTest,deletedAt}] }`; `hostName` = `coalesce(nullif(e.host_name,''), profile display_name)` sem concatenação.
- `admin_event_detail(p_event uuid)` → `{ event, entitlement, timeline:[{at,kind,label}], participants:[{name,joinedAt,isHost}], orders:[{id,status,amountCents,createdAt}], audit:[{at,action,actorRole,reason}] }` (sem fotos).
- `admin_search(p_q text)` → `{ events:[{id,title}], users:[{userId,email(mascarado p/ não master)}], orders:[{id,eventId,status}] }` (máx. 5 de cada).
- `admin_list_users_v2(p_limit,p_offset,p_kind text /*google|email|anon|null*/, p_include_tests, p_search)` → itens de `admin_list_users` + `{eventsLinked, isTest, orphanAnon}` e `summary:{google,email,anon,orphanAnon}`.
- `admin_list_audit_v2(p_limit,p_offset,p_category text /*participante|consentimento|revelacao|admin|pagamento*/, p_event uuid)` → itens de `admin_list_audit` + `{eventId, eventTitle, sensitive}`.
- `admin_storage_breakdown()` → `{ originals:{n,bytes}, derived:{n,bytes}, orphans:{n,bytes}, branding:{n,bytes}, avgPhotoBytes, growth:[{day,bytes}] }` (só leitura; órfão = objeto em `event-photos` sem linha em `photos`).
- `admin_health_history(p_limit int)` → `{ jobs:[{name, schedule, active, runs:[{startedAt,durationMs,status}], consecutiveFailures}] }` (24 últimas).
- `admin_reveal_now(p_event uuid, p_reason text)` → `{ok}`; reusa a mesma rotina de revelação do servidor; audita `admin.reveal_now`.
- `admin_set_test_flag(p_events uuid[], p_value bool, p_reason text)` e `admin_soft_delete_test_events(p_events uuid[], p_reason text)` (recusa evento `is_test=false`).
- Colunas: `events.is_test bool not null default false`, `profiles.is_test bool not null default false`; backfill por título (`TESTE%`, `Teste homologacao%`, `RT %`) e e-mail `@memoriesmt.test`.
- Auditoria: trigger `before insert on audit_logs` preenche `actor_role` (`system` sem `auth.uid()`, `organizer` se for host do evento, `master`/`staff` se papel de plataforma, `guest` caso contrário), `target_type='event'`/`target_id=event_id` quando vazios; backfill dos existentes.
- Rotina `mm-purge-anon-orphans` (diária) criada com `active=false` + função `purge_anon_orphans()` (anônimos sem participação há > 7 dias, audita a contagem).

## Tarefas
1. **DB** — migration + reversão + pgTAP `supabase/tests/database/12_console.test.sql` (contratos acima, privilégios, recusa de anon/authenticated sem papel, backfill, trigger). Stack local isolado (`sb`).
2. **Fundação de UI** — `web/src/app/master/data.ts` (`rpcOr`, `includeTests` por `?testes=1`, período), `web/src/features/master/` puro e testado: `risk.ts` (sinais de risco por evento), `plan.ts` (plano por capacidade/código, "manual (N)"), `cron.ts` (cron legível + próxima execução), `csv.ts`, `format.ts`; componentes `web/src/app/master/kit/`: `Kpi` (sparkline), `BarLineChart`, `Funnel`, `StackBar`, `Meter`, `Pill`, `AlertBar`, `Drawer`, `CsvButton`, `TestToggle`, `PeriodTabs`, `EmptyState`, `SortableTable`.
3. **Shell** — `MasterNav` em 4 grupos com badges; `layout.tsx` com barra de alertas e busca ⌘K (`CommandSearch` client + rota `GET /master/busca` ou server action chamando `admin_search`).
4. **Páginas Operação** — Visão geral, Eventos (drawer, lote), Revelações (revelar agora), Saúde.
5. **Páginas Pessoas** — Usuários, Organizadores, Participantes e convites, LGPD.
6. **Páginas Receita** — Pagamentos, Planos, Códigos (só leitura/apresentação).
7. **Páginas Plataforma** — Analytics, Storage, Auditoria, Configurações (form `admin_set_setting` com justificativa, validação CNPJ/e-mail).
8. **E2E + evidências** — Playwright: login master (mock do gate local quando aplicável), toggle de testes, drawer, filtros de auditoria, CSV; capturas 1280/400 das 15 páginas; preview Vercel; PR.

Testes unitários (TDD) obrigatórios para `risk`, `plan`, `cron`, `csv`, `format` e para o filtro de testes.
