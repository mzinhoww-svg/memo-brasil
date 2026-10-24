-- pgTAP · Redesign do console master (migration 20261024000100_console_redesign).
-- Contratos das RPCs novas (chaves do JSON), filtro de testes (is_test), backfill por título/e-mail, hostName sem
-- duplicação, trigger de auditoria (actor_role/target), privilégios (anon e authenticated sem papel recusados),
-- exclusão em lote só de eventos de teste e só por soft delete, revelar agora com justificativa, job de órfãos inativo.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false,
    'app_metadata', case when p_role is null then '{}'::json else json_build_object('role', p_role) end)::text, true);
  set local role authenticated;
end $$;
-- só as claims (sem trocar de papel): simula auth.uid() num INSERT direto feito pelo dono
create function tests.claims(p_user uuid, p_role text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated',
    'app_metadata', case when p_role is null then '{}'::json else json_build_object('role', p_role) end)::text end, true);
end $$;
create function tests.has_keys(j jsonb, k text[]) returns boolean language sql as $$ select coalesce(j ?& k, false) $$;
create function tests.ids(j jsonb) returns text[] language sql as $$
  select coalesce(array_agg(x ->> 'id'), '{}') from jsonb_array_elements(coalesce(j, '[]')) x
$$;
grant usage on schema tests to authenticated, service_role, anon;
grant execute on all functions in schema tests to authenticated, service_role, anon;

-- pessoas: m1 master · s1 support · h1 anfitrião · h2 anfitrião de teste (@memoriesmt.test) · g1 convidado
--          d1 anônimo órfão antigo · d2 anônimo órfão recente · d3 anônimo antigo com participação
insert into auth.users (id, aud, role, email, is_anonymous, raw_user_meta_data, raw_app_meta_data, created_at) values
  ('00000000-0000-4000-8000-0000000012c1', 'authenticated', 'authenticated', 'master12@test.local', false, '{"full_name":"Mestre"}', '{"provider":"email"}', now()),
  ('00000000-0000-4000-8000-0000000012c2', 'authenticated', 'authenticated', 'suporte12@test.local', false, '{"full_name":"Suporte"}', '{"provider":"email"}', now()),
  ('00000000-0000-4000-8000-0000000012a1', 'authenticated', 'authenticated', 'host12@test.local', false, '{"full_name":"Ana Host"}', '{"provider":"google"}', now()),
  ('00000000-0000-4000-8000-0000000012a2', 'authenticated', 'authenticated', 'qa12@memoriesmt.test', false, '{"full_name":"QA"}', '{"provider":"email"}', now()),
  ('00000000-0000-4000-8000-0000000012b1', 'authenticated', 'authenticated', 'convidado12@test.local', false, '{"full_name":"Gil"}', '{"provider":"email"}', now() - interval '30 days'),
  ('00000000-0000-4000-8000-0000000012d1', 'authenticated', 'authenticated', null, true, '{}', '{}', now() - interval '10 days'),
  ('00000000-0000-4000-8000-0000000012d2', 'authenticated', 'authenticated', null, true, '{}', '{}', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000012d3', 'authenticated', 'authenticated', null, true, '{}', '{}', now() - interval '10 days');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000012%' on conflict do nothing;
insert into public.platform_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000012c1', 'master'),
  ('00000000-0000-4000-8000-0000000012c2', 'support');

insert into public.events (id, title, category, host_id, host_name, duration_hours, start_at) values
  ('00000000-0000-4000-8000-0000000012e1', 'Casamento Ana12', 'casamento', '00000000-0000-4000-8000-0000000012a1', '', 6, now()),
  ('00000000-0000-4000-8000-0000000012e2', 'TESTE carga 12', 'outro', '00000000-0000-4000-8000-0000000012a1', 'Ana', 6, now()),
  ('00000000-0000-4000-8000-0000000012e3', 'Teste homologação Pix 12', 'outro', '00000000-0000-4000-8000-0000000012a1', 'Ana', 6, now()),
  ('00000000-0000-4000-8000-0000000012e4', 'RT 042 regressão 12', 'outro', '00000000-0000-4000-8000-0000000012a1', 'Ana', 6, now()),
  ('00000000-0000-4000-8000-0000000012e5', 'Testemunhas 12', 'outro', '00000000-0000-4000-8000-0000000012a1', 'Ana', 6, now()),
  ('00000000-0000-4000-8000-0000000012e6', 'Festa QA 12', 'outro', '00000000-0000-4000-8000-0000000012a2', '', 6, now());
-- e7: revelação em data futura (para revelar agora) · e8: revelação vencida (rotina do servidor)
insert into public.events (id, title, category, host_id, host_name, duration_hours, start_at, reveal_enabled, reveal_anchor, reveal_at) values
  ('00000000-0000-4000-8000-0000000012e7', 'Revelar agora 12', 'outro', '00000000-0000-4000-8000-0000000012a1', 'Ana', 6, now(), true, 'data', now() + interval '2 days'),
  ('00000000-0000-4000-8000-0000000012e8', 'Revelação vencida 12', 'outro', '00000000-0000-4000-8000-0000000012a1', 'Ana', 6, now() - interval '1 day', true, 'data', now() - interval '1 hour');

insert into public.participants (event_id, user_id, name, joined_at) values
  ('00000000-0000-4000-8000-0000000012e1', '00000000-0000-4000-8000-0000000012a1', 'Ana', now()),
  ('00000000-0000-4000-8000-0000000012e1', '00000000-0000-4000-8000-0000000012b1', 'Gil', now()),
  ('00000000-0000-4000-8000-0000000012e1', '00000000-0000-4000-8000-0000000012d3', 'Anônimo', now()),
  ('00000000-0000-4000-8000-0000000012e2', '00000000-0000-4000-8000-0000000012b1', 'Gil', now());

-- foto pronta em e1 com original e miniatura no Storage, mais um objeto órfão
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status, bytes) values
  ('00000000-0000-4000-8000-0000000012f1', '00000000-0000-4000-8000-0000000012e1', '00000000-0000-4000-8000-0000000012b1', 'Gil',
   '00000000-0000-4000-8000-0000000012e1/00000000-0000-4000-8000-0000000012f1', 'pronta', 1000);
insert into storage.objects (bucket_id, name, metadata) values
  ('event-photos', '00000000-0000-4000-8000-0000000012e1/00000000-0000-4000-8000-0000000012f1', '{"size": 1000}'),
  ('event-photos', '00000000-0000-4000-8000-0000000012e1/00000000-0000-4000-8000-0000000012f1.thumb', '{"size": 100}'),
  ('event-photos', '00000000-0000-4000-8000-0000000012e1/00000000-0000-4000-8000-0000000012f9', '{"size": 7}');

-- backfill reaplicado sobre os dados desta transação (a migration já rodou antes deles)
select ok(public.console_backfill_test_flags() >= 0, 'backfill de is_test roda');

-- ===================================================== estrutura
select has_column('public', 'events', 'is_test', 'events.is_test existe');
select col_not_null('public', 'events', 'is_test', 'events.is_test not null');
select col_default_is('public', 'events', 'is_test', 'false', 'events.is_test padrão false');
select has_column('public', 'profiles', 'is_test', 'profiles.is_test existe');
select col_not_null('public', 'profiles', 'is_test', 'profiles.is_test not null');
select col_default_is('public', 'profiles', 'is_test', 'false', 'profiles.is_test padrão false');

select has_function('public', 'admin_overview', array['integer', 'boolean'], 'admin_overview existe');
select has_function('public', 'admin_list_events_v2', array['integer', 'integer', 'text', 'text', 'boolean', 'text', 'text'], 'admin_list_events_v2 existe');
select has_function('public', 'admin_event_detail', array['uuid'], 'admin_event_detail existe');
select has_function('public', 'admin_search', array['text'], 'admin_search existe');
select has_function('public', 'admin_list_users_v2', array['integer', 'integer', 'text', 'boolean', 'text'], 'admin_list_users_v2 existe');
select has_function('public', 'admin_list_audit_v2', array['integer', 'integer', 'text', 'uuid'], 'admin_list_audit_v2 existe');
select has_function('public', 'admin_storage_breakdown', array[]::text[], 'admin_storage_breakdown existe');
select has_function('public', 'admin_health_history', array['integer'], 'admin_health_history existe');
select has_function('public', 'admin_reveal_now', array['uuid', 'text'], 'admin_reveal_now existe');
select has_function('public', 'admin_set_test_flag', array['uuid[]', 'boolean', 'text'], 'admin_set_test_flag existe');
select has_function('public', 'admin_soft_delete_test_events', array['uuid[]', 'text'], 'admin_soft_delete_test_events existe');
select has_function('public', 'purge_anon_orphans', array['integer'], 'purge_anon_orphans existe');

-- todas: security definer + search_path vazio
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and p.proconfig @> array['search_path=""']
             and p.proname in ('admin_overview', 'admin_list_events_v2', 'admin_event_detail', 'admin_search', 'admin_list_users_v2',
                               'admin_list_audit_v2', 'admin_storage_breakdown', 'admin_health_history', 'admin_reveal_now',
                               'admin_set_test_flag', 'admin_soft_delete_test_events', 'purge_anon_orphans')), 12,
  'as 12 funções novas são security definer com search_path vazio');

-- ===================================================== privilégios de execução
select ok(not has_function_privilege('anon', 'public.admin_overview(int, boolean)', 'execute'), 'anon não executa admin_overview');
select ok(not has_function_privilege('anon', 'public.admin_list_events_v2(int, int, text, text, boolean, text, text)', 'execute'), 'anon não executa admin_list_events_v2');
select ok(not has_function_privilege('anon', 'public.admin_event_detail(uuid)', 'execute'), 'anon não executa admin_event_detail');
select ok(not has_function_privilege('anon', 'public.admin_search(text)', 'execute'), 'anon não executa admin_search');
select ok(not has_function_privilege('anon', 'public.admin_list_users_v2(int, int, text, boolean, text)', 'execute'), 'anon não executa admin_list_users_v2');
select ok(not has_function_privilege('anon', 'public.admin_list_audit_v2(int, int, text, uuid)', 'execute'), 'anon não executa admin_list_audit_v2');
select ok(not has_function_privilege('anon', 'public.admin_storage_breakdown()', 'execute'), 'anon não executa admin_storage_breakdown');
select ok(not has_function_privilege('anon', 'public.admin_health_history(int)', 'execute'), 'anon não executa admin_health_history');
select ok(not has_function_privilege('anon', 'public.admin_reveal_now(uuid, text)', 'execute'), 'anon não executa admin_reveal_now');
select ok(not has_function_privilege('anon', 'public.admin_set_test_flag(uuid[], boolean, text)', 'execute'), 'anon não executa admin_set_test_flag');
select ok(not has_function_privilege('anon', 'public.admin_soft_delete_test_events(uuid[], text)', 'execute'), 'anon não executa admin_soft_delete_test_events');
select ok(has_function_privilege('authenticated', 'public.admin_overview(int, boolean)', 'execute'), 'authenticated executa admin_overview (papel checado dentro)');
select ok(has_function_privilege('authenticated', 'public.admin_soft_delete_test_events(uuid[], text)', 'execute'), 'authenticated executa admin_soft_delete_test_events (papel checado dentro)');
select ok(not has_function_privilege('authenticated', 'public.purge_anon_orphans(int)', 'execute'), 'cliente não executa purge_anon_orphans');
select ok(not has_function_privilege('anon', 'public.purge_anon_orphans(int)', 'execute'), 'anon não executa purge_anon_orphans');

set local role anon;
select throws_ok($$select public.admin_overview(30, false)$$, '42501', null, 'anon chamando admin_overview: permissão negada');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000012e2'::uuid], 'motivo longo o bastante')$$,
  '42501', null, 'anon chamando admin_soft_delete_test_events: permissão negada');
reset role;

-- authenticated sem papel de plataforma: MM004 em todas
select tests.login('00000000-0000-4000-8000-0000000012a1');
select throws_ok($$select public.admin_overview(30, false)$$, 'MM004', 'forbidden', 'sem papel: admin_overview MM004');
select throws_ok($$select public.admin_list_events_v2(25, 0, null, null, false, null, null)$$, 'MM004', 'forbidden', 'sem papel: admin_list_events_v2 MM004');
select throws_ok($$select public.admin_event_detail('00000000-0000-4000-8000-0000000012e1')$$, 'MM004', 'forbidden', 'sem papel: admin_event_detail MM004');
select throws_ok($$select public.admin_search('Ana')$$, 'MM004', 'forbidden', 'sem papel: admin_search MM004');
select throws_ok($$select public.admin_list_users_v2(25, 0, null, false, null)$$, 'MM004', 'forbidden', 'sem papel: admin_list_users_v2 MM004');
select throws_ok($$select public.admin_list_audit_v2(25, 0, null, null)$$, 'MM004', 'forbidden', 'sem papel: admin_list_audit_v2 MM004');
select throws_ok($$select public.admin_storage_breakdown()$$, 'MM004', 'forbidden', 'sem papel: admin_storage_breakdown MM004');
select throws_ok($$select public.admin_health_history(24)$$, 'MM004', 'forbidden', 'sem papel: admin_health_history MM004');
select throws_ok($$select public.admin_reveal_now('00000000-0000-4000-8000-0000000012e7', 'motivo longo o bastante')$$, 'MM004', 'forbidden', 'sem papel: admin_reveal_now MM004');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000012e1'::uuid], true, 'motivo longo o bastante')$$, 'MM004', 'forbidden', 'sem papel: admin_set_test_flag MM004');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000012e2'::uuid], 'motivo longo o bastante')$$, 'MM004', 'forbidden', 'sem papel: admin_soft_delete_test_events MM004');
-- claim de papel sem linha ativa em platform_roles continua sem acesso
reset role;
select tests.login('00000000-0000-4000-8000-0000000012a1', 'master');
select throws_ok($$select public.admin_overview(30, false)$$, 'MM004', 'forbidden', 'claim master sem linha ativa: MM004');
reset role;

-- support (staff, não master): lê; ações sensíveis são só do master
select tests.login('00000000-0000-4000-8000-0000000012c2', 'support');
select lives_ok($$select public.admin_overview(30, false)$$, 'support lê admin_overview');
select lives_ok($$select public.admin_list_events_v2(25, 0, null, null, false, null, null)$$, 'support lê admin_list_events_v2');
select throws_ok($$select public.admin_reveal_now('00000000-0000-4000-8000-0000000012e7', 'motivo longo o bastante')$$, 'MM004', 'forbidden', 'support: admin_reveal_now MM004');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000012e1'::uuid], true, 'motivo longo o bastante')$$, 'MM004', 'forbidden', 'support: admin_set_test_flag MM004');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000012e2'::uuid], 'motivo longo o bastante')$$, 'MM004', 'forbidden', 'support: admin_soft_delete_test_events MM004');
select is(public.admin_search('host12') -> 'users' -> 0 ->> 'email', null, 'support não busca usuário por e-mail');
select is((select x ->> 'email' from jsonb_array_elements(public.admin_list_users_v2(200, 0, null, true, null) -> 'items') x
           where x ->> 'userId' = '00000000-0000-4000-8000-0000000012a1'), 'h***@test.local', 'support vê e-mail mascarado');
select is(jsonb_array_length(public.admin_event_detail('00000000-0000-4000-8000-0000000012e1') -> 'orders'), 0, 'support não vê pedidos no detalhe');
reset role;

-- ===================================================== backfill de is_test
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012e1'), false, 'título comum não é teste');
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012e2'), true, 'TESTE% vira teste');
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012e3'), true, 'Teste homologação% vira teste');
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012e4'), true, 'RT % vira teste');
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012e5'), false, 'Testemunhas não é teste (TESTE é maiúsculo)');
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012e6'), true, 'evento de anfitrião @memoriesmt.test vira teste');
select is((select is_test from public.profiles where id = '00000000-0000-4000-8000-0000000012a2'), true, 'perfil @memoriesmt.test vira teste');
select is((select is_test from public.profiles where id = '00000000-0000-4000-8000-0000000012a1'), false, 'perfil comum não é teste');

-- cliente não muda is_test (nem no próprio evento)
select tests.login('00000000-0000-4000-8000-0000000012a1');
update public.events set is_test = true where id = '00000000-0000-4000-8000-0000000012e1';
reset role;
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012e1'), false, 'anfitrião não marca o próprio evento como teste');

-- evento novo com título de teste já nasce is_test (mesma regra do backfill); título comum não, mesmo pedindo
select tests.login('00000000-0000-4000-8000-0000000012a1');
insert into public.events (id, title, category, host_id, duration_hours, is_test) values
  ('00000000-0000-4000-8000-0000000012f1', 'TESTE – excluir 12', 'outro', '00000000-0000-4000-8000-0000000012a1', 6, false),
  ('00000000-0000-4000-8000-0000000012f2', 'Festa real 12', 'outro', '00000000-0000-4000-8000-0000000012a1', 6, true);
reset role;
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012f1'), true, 'evento novo TESTE% criado pelo cliente nasce teste');
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012f2'), false, 'evento novo comum criado pelo cliente não nasce teste');
insert into public.events (id, title, category, host_id, duration_hours) values
  ('00000000-0000-4000-8000-0000000012f3', 'RT 12 rotina', 'outro', '00000000-0000-4000-8000-0000000012a1', 6);
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012f3'), true, 'evento novo RT % inserido pelo servidor nasce teste');
update public.events set title = 'TESTE renomeado 12' where id = '00000000-0000-4000-8000-0000000012f2';
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012f2'), false, 'renomear para TESTE não marca (só na criação)');
delete from public.events where id in ('00000000-0000-4000-8000-0000000012f1', '00000000-0000-4000-8000-0000000012f2', '00000000-0000-4000-8000-0000000012f3');

-- ===================================================== trigger de auditoria
select tests.claims(null);
insert into public.audit_logs (event_id, action) values ('00000000-0000-4000-8000-0000000012e1', 'test12.system');
select is((select actor_role || '/' || target_type || '/' || target_id from public.audit_logs where action = 'test12.system'),
  'sistema/event/00000000-0000-4000-8000-0000000012e1', 'sem auth.uid(): sistema, alvo = evento');
select tests.claims('00000000-0000-4000-8000-0000000012b1');
insert into public.audit_logs (actor_id, event_id, action) values ('00000000-0000-4000-8000-0000000012b1', '00000000-0000-4000-8000-0000000012e1', 'test12.guest');
select is((select actor_role from public.audit_logs where action = 'test12.guest'), 'convidado', 'convidado: actor_role convidado');
select tests.claims('00000000-0000-4000-8000-0000000012a1');
insert into public.audit_logs (actor_id, event_id, action) values ('00000000-0000-4000-8000-0000000012a1', '00000000-0000-4000-8000-0000000012e1', 'test12.host');
select is((select actor_role from public.audit_logs where action = 'test12.host'), 'organizador', 'anfitrião: actor_role organizador');
select tests.claims('00000000-0000-4000-8000-0000000012c1', 'master');
insert into public.audit_logs (actor_id, event_id, action) values ('00000000-0000-4000-8000-0000000012c1', '00000000-0000-4000-8000-0000000012e1', 'test12.master');
select is((select actor_role from public.audit_logs where action = 'test12.master'), 'master', 'master: actor_role master');
insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id)
values ('00000000-0000-4000-8000-0000000012c1', 'operador', '00000000-0000-4000-8000-0000000012e1', 'test12.explicit', 'plan', 'festa');
select is((select actor_role || '/' || target_type || '/' || target_id from public.audit_logs where action = 'test12.explicit'),
  'operador/plan/festa', 'valores explícitos são preservados');
-- M2: sem actor_id é sistema mesmo dentro de uma requisição de usuário (auth.uid() do master não vira o ator)
insert into public.audit_logs (event_id, action) values ('00000000-0000-4000-8000-0000000012e1', 'test12.noactor_in_request');
select is((select actor_role from public.audit_logs where action = 'test12.noactor_in_request'), 'sistema',
  'sem actor_id numa requisição do master: sistema');
select tests.claims(null);
insert into public.audit_logs (action) values ('test12.noevent');
select is((select coalesce(target_type, '-') from public.audit_logs where action = 'test12.noevent'), '-', 'sem evento: alvo continua vazio');

-- linhas antigas (sem actor_role) recebem o papel derivado na leitura: a trilha é imutável, sem UPDATE
alter table public.audit_logs disable trigger audit_logs_fill_actor;
insert into public.audit_logs (actor_id, event_id, action) values ('00000000-0000-4000-8000-0000000012a1', '00000000-0000-4000-8000-0000000012e1', 'participant.legacy12');
insert into public.audit_logs (actor_id, event_id, action) values (null, '00000000-0000-4000-8000-0000000012e1', 'reveal.legacy12');
alter table public.audit_logs enable trigger audit_logs_fill_actor;
select is((select actor_role from public.audit_logs where action = 'participant.legacy12'), null, 'linha antiga fica como está (imutável)');

-- ===================================================== contratos (master)
select tests.login('00000000-0000-4000-8000-0000000012c1', 'master');

select public.admin_overview(30, false) as ov \gset
select ok(tests.has_keys(:'ov'::jsonb, array['days', 'kpis', 'series', 'funnel', 'upcomingReveals', 'storage', 'jobs', 'readiness', 'alerts']), 'overview: chaves de topo');
select is((:'ov'::jsonb ->> 'days')::int, 30, 'overview: days');
select ok(tests.has_keys(:'ov'::jsonb -> 'kpis', array['activeEvents', 'participants', 'photos', 'revenueCents']), 'overview: kpis');
select ok(tests.has_keys(:'ov'::jsonb -> 'kpis' -> 'activeEvents', array['value', 'previous', 'spark'])
      and tests.has_keys(:'ov'::jsonb -> 'kpis' -> 'participants', array['value', 'previous', 'spark'])
      and tests.has_keys(:'ov'::jsonb -> 'kpis' -> 'photos', array['value', 'previous', 'spark'])
      and tests.has_keys(:'ov'::jsonb -> 'kpis' -> 'revenueCents', array['value', 'previous', 'spark']), 'overview: cada kpi tem value/previous/spark');
select is(jsonb_array_length(:'ov'::jsonb -> 'kpis' -> 'participants' -> 'spark'), 30, 'overview: spark com um ponto por dia');
select is(jsonb_typeof(:'ov'::jsonb -> 'kpis' -> 'photos' -> 'spark' -> 0), 'number', 'overview: spark de inteiros');
select is(jsonb_array_length(:'ov'::jsonb -> 'series'), 30, 'overview: series com um dia por ponto');
select ok(tests.has_keys(:'ov'::jsonb -> 'series' -> 0, array['day', 'photos', 'joins', 'eventsCreated']), 'overview: chaves de series');
select ok(tests.has_keys(:'ov'::jsonb -> 'funnel', array['created', 'withParticipant', 'withPhoto', 'revealed']), 'overview: funnel');
select ok(tests.has_keys(:'ov'::jsonb -> 'upcomingReveals' -> 0, array['eventId', 'title', 'revealAt', 'isTest']), 'overview: upcomingReveals');
select ok(tests.has_keys(:'ov'::jsonb -> 'storage', array['originals', 'derived', 'orphans', 'bytes']), 'overview: storage');
select is(jsonb_typeof(:'ov'::jsonb -> 'jobs'), 'array', 'overview: jobs é lista');
select ok(jsonb_array_length(:'ov'::jsonb -> 'jobs') = 0 or tests.has_keys(:'ov'::jsonb -> 'jobs' -> 0, array['name', 'ok']), 'overview: jobs {name, ok}');
select ok(tests.has_keys(:'ov'::jsonb -> 'readiness', array['companyCnpj', 'companyLegalName', 'supportEmail', 'supportPhone', 'paymentsEnv', 'lastWebhookAt']), 'overview: readiness');
select is(jsonb_typeof(:'ov'::jsonb -> 'readiness' -> 'supportEmail'), 'boolean', 'overview: readiness de contato é booleano');
select is(:'ov'::jsonb -> 'readiness' ->> 'paymentsEnv', 'desligado', 'overview: paymentsEnv é texto');
select ok(tests.has_keys(:'ov'::jsonb -> 'alerts', array['pendingReveals', 'overdueReveals', 'lgpdPending', 'lgpdOverdue', 'settingsMissing',
  'paymentDivergences', 'failingJobs']), 'overview: alerts');
select is((:'ov'::jsonb -> 'alerts' ->> 'settingsMissing')::int, 4, 'overview: quatro configurações faltando');
select ok((:'ov'::jsonb -> 'alerts' ->> 'overdueReveals')::int >= 1, 'overview: revelação vencida conta como atrasada');
select throws_ok($$select public.admin_overview(0, false)$$, 'MM005', null, 'overview: dias inválidos MM005');

-- filtro de testes no overview: o convidado entrou num evento de teste (e2) e num real (e1)
select is(((public.admin_overview(30, true) -> 'kpis' -> 'participants' ->> 'value')::int
         - (public.admin_overview(30, false) -> 'kpis' -> 'participants' ->> 'value')::int), 1,
  'overview: entrada em evento de teste só conta com include_tests');
select ok('00000000-0000-4000-8000-0000000012e7' = any (select x ->> 'eventId' from jsonb_array_elements(public.admin_overview(30, false) -> 'upcomingReveals') x),
  'overview: revelação futura aparece em upcomingReveals');

-- lista de eventos v2
select public.admin_list_events_v2(100, 0, '12', null, false, null, null) as lv \gset
select ok(tests.has_keys(:'lv'::jsonb, array['total', 'items']), 'events_v2: total e items');
select ok(tests.has_keys(:'lv'::jsonb -> 'items' -> 0, array['id', 'title', 'hostName', 'hostId', 'status', 'startAt', 'revealState', 'revealAt',
  'participants', 'photos', 'failedUploads', 'capacity', 'shotsPerPerson', 'planCode', 'isTest', 'deletedAt']), 'events_v2: chaves do item');
select ok(not ('00000000-0000-4000-8000-0000000012e2' = any (tests.ids(:'lv'::jsonb -> 'items'))), 'events_v2: sem testes por padrão');
select ok('00000000-0000-4000-8000-0000000012e1' = any (tests.ids(:'lv'::jsonb -> 'items')), 'events_v2: evento real listado');
select ok('00000000-0000-4000-8000-0000000012e5' = any (tests.ids(:'lv'::jsonb -> 'items')), 'events_v2: Testemunhas listado');
select is((:'lv'::jsonb ->> 'total')::int, 4, 'events_v2: total sem testes (e1, e5, e7, e8)');
select ok('00000000-0000-4000-8000-0000000012e2' = any (tests.ids(public.admin_list_events_v2(100, 0, '12', null, true, null, null) -> 'items')),
  'events_v2: include_tests traz os de teste');
select is((public.admin_list_events_v2(100, 0, '12', null, true, null, null) ->> 'total')::int, 8, 'events_v2: total com testes');
select is((select x ->> 'hostName' from jsonb_array_elements(:'lv'::jsonb -> 'items') x where x ->> 'id' = '00000000-0000-4000-8000-0000000012e1'),
  'Ana Host', 'hostName: host_name vazio cai no nome do perfil');
select is((select x ->> 'hostName' from jsonb_array_elements(public.admin_list_events_v2(100, 0, '12', null, true, null, null) -> 'items') x
           where x ->> 'id' = '00000000-0000-4000-8000-0000000012e2'), 'Ana', 'hostName: host_name preenchido, sem concatenar o perfil');
select is((select x ->> 'planCode' from jsonb_array_elements(:'lv'::jsonb -> 'items') x where x ->> 'id' = '00000000-0000-4000-8000-0000000012e1'),
  'gratis', 'events_v2: planCode do direito efetivo');
select is((select (x ->> 'participants')::int from jsonb_array_elements(:'lv'::jsonb -> 'items') x where x ->> 'id' = '00000000-0000-4000-8000-0000000012e1'),
  3, 'events_v2: participantes contados');
select is(public.admin_list_events_v2(100, 0, '12', null, false, 'title', 'asc') -> 'items' -> 0 ->> 'title', 'Casamento Ana12', 'events_v2: ordena por título asc');
select is(public.admin_list_events_v2(100, 0, '12', null, false, 'title', 'desc') -> 'items' -> 0 ->> 'title', 'Testemunhas 12', 'events_v2: ordena por título desc');
select is(public.admin_list_events_v2(100, 0, '12', null, false, 'participants', 'desc') -> 'items' -> 0 ->> 'id', '00000000-0000-4000-8000-0000000012e1',
  'events_v2: ordena por participantes');
select throws_ok($$select public.admin_list_events_v2(25, 0, null, null, false, 'drop table', 'asc')$$, 'MM005', null, 'events_v2: ordenação fora da lista MM005');
select throws_ok($$select public.admin_list_events_v2(25, 0, null, null, false, 'title', 'sideways')$$, 'MM005', null, 'events_v2: direção inválida MM005');
select throws_ok($$select public.admin_list_events_v2(25, 0, null, 'qualquer', false, null, null)$$, 'MM005', null, 'events_v2: status inválido MM005');

-- detalhe do evento
select public.admin_event_detail('00000000-0000-4000-8000-0000000012e1') as ed \gset
select ok(tests.has_keys(:'ed'::jsonb, array['event', 'entitlement', 'timeline', 'participants', 'orders', 'audit']), 'detail: chaves de topo');
select ok(not (:'ed'::jsonb ? 'photos') and not (:'ed'::jsonb -> 'event' ? 'code'), 'detail: sem fotos e sem código do evento');
select ok(tests.has_keys(:'ed'::jsonb -> 'timeline' -> 0, array['at', 'kind', 'label']), 'detail: timeline {at, kind, label}');
select ok(tests.has_keys(:'ed'::jsonb -> 'participants' -> 0, array['name', 'joinedAt', 'isHost']), 'detail: participants {name, joinedAt, isHost}');
select is(jsonb_array_length(:'ed'::jsonb -> 'participants'), 3, 'detail: três participantes');
select ok(tests.has_keys(:'ed'::jsonb -> 'audit' -> 0, array['at', 'action', 'actorRole', 'reason']), 'detail: audit {at, action, actorRole, reason}');
select is(:'ed'::jsonb -> 'entitlement' ->> 'planCode', 'gratis', 'detail: entitlement com planCode');
select throws_ok($$select public.admin_event_detail(gen_random_uuid())$$, 'MM005', null, 'detail: evento inexistente MM005');

-- busca
select public.admin_search('Ana12') as se \gset
select ok(tests.has_keys(:'se'::jsonb, array['events', 'users', 'orders']), 'search: events, users, orders');
select ok('00000000-0000-4000-8000-0000000012e1' = any (tests.ids(:'se'::jsonb -> 'events')), 'search: acha o evento pelo título');
select ok(tests.has_keys(:'se'::jsonb -> 'events' -> 0, array['id', 'title']), 'search: evento {id, title}');
select is(public.admin_search('host12') -> 'users' -> 0 ->> 'email', 'host12@test.local', 'search: master vê e-mail completo');
select ok(tests.has_keys(public.admin_search('host12') -> 'users' -> 0, array['userId', 'email']), 'search: usuário {userId, email}');
select ok(jsonb_array_length(public.admin_search('12') -> 'events') <= 5, 'search: no máximo 5 eventos');
select is(public.admin_search('a'), '{"events": [], "users": [], "orders": []}'::jsonb, 'search: termo curto devolve listas vazias');

-- usuários v2
select public.admin_list_users_v2(200, 0, null, false, null) as uv \gset
select ok(tests.has_keys(:'uv'::jsonb, array['total', 'items', 'summary']), 'users_v2: total, items, summary');
select ok(tests.has_keys(:'uv'::jsonb -> 'summary', array['google', 'email', 'anon', 'orphanAnon']), 'users_v2: summary');
select ok(tests.has_keys(:'uv'::jsonb -> 'items' -> 0, array['userId', 'isAnonymous', 'provider', 'email', 'createdAt', 'lastSignInAt', 'platformRole',
  'eventsLinked', 'isTest', 'orphanAnon']), 'users_v2: chaves de admin_list_users mais as novas');
select ok(not ('00000000-0000-4000-8000-0000000012a2' = any (select x ->> 'userId' from jsonb_array_elements(:'uv'::jsonb -> 'items') x)),
  'users_v2: usuário de teste fora por padrão');
select ok('00000000-0000-4000-8000-0000000012a2' = any (select x ->> 'userId' from jsonb_array_elements(public.admin_list_users_v2(200, 0, null, true, null) -> 'items') x),
  'users_v2: include_tests traz usuário de teste');
select is((select (x ->> 'orphanAnon')::boolean from jsonb_array_elements(:'uv'::jsonb -> 'items') x where x ->> 'userId' = '00000000-0000-4000-8000-0000000012d1'),
  true, 'users_v2: anônimo sem participação é órfão');
select is((select (x ->> 'orphanAnon')::boolean from jsonb_array_elements(:'uv'::jsonb -> 'items') x where x ->> 'userId' = '00000000-0000-4000-8000-0000000012d3'),
  false, 'users_v2: anônimo com participação não é órfão');
select is((select (x ->> 'eventsLinked')::int from jsonb_array_elements(:'uv'::jsonb -> 'items') x where x ->> 'userId' = '00000000-0000-4000-8000-0000000012a1'),
  7, 'users_v2: eventsLinked do anfitrião (hospeda 7 eventos)');
select ok((select bool_and((x ->> 'isAnonymous')::boolean) from jsonb_array_elements(public.admin_list_users_v2(200, 0, 'anon', false, null) -> 'items') x),
  'users_v2: filtro anon só traz anônimos');
select ok((select bool_and(x ->> 'provider' = 'google') from jsonb_array_elements(public.admin_list_users_v2(200, 0, 'google', false, null) -> 'items') x),
  'users_v2: filtro google');
select is((public.admin_list_users_v2(200, 0, null, false, 'host12') ->> 'total')::int, 1, 'users_v2: busca por e-mail (master)');
select throws_ok($$select public.admin_list_users_v2(25, 0, 'facebook', false, null)$$, 'MM005', null, 'users_v2: tipo inválido MM005');

-- auditoria v2
select public.admin_list_audit_v2(200, 0, null, '00000000-0000-4000-8000-0000000012e1') as av \gset
select ok(tests.has_keys(:'av'::jsonb, array['total', 'items']), 'audit_v2: total e items');
select ok(tests.has_keys(:'av'::jsonb -> 'items' -> 0, array['id', 'at', 'actorId', 'actorRole', 'eventId', 'action', 'targetType', 'targetId', 'reason',
  'eventTitle', 'sensitive']), 'audit_v2: chaves de admin_list_audit mais as novas');
select ok((select bool_and(x ->> 'eventId' = '00000000-0000-4000-8000-0000000012e1') from jsonb_array_elements(:'av'::jsonb -> 'items') x), 'audit_v2: filtro por evento');
select is((select x ->> 'eventTitle' from jsonb_array_elements(:'av'::jsonb -> 'items') x limit 1), 'Casamento Ana12', 'audit_v2: eventTitle');
select is((select x ->> 'actorRole' from jsonb_array_elements(:'av'::jsonb -> 'items') x where x ->> 'action' = 'participant.legacy12'), 'organizador',
  'audit_v2: linha antiga sem actor_role recebe o papel derivado (organizador)');
select is((select x ->> 'actorRole' from jsonb_array_elements(:'av'::jsonb -> 'items') x where x ->> 'action' = 'reveal.legacy12'), 'sistema',
  'audit_v2: linha antiga sem ator recebe sistema');
select is((select x ->> 'targetType' from jsonb_array_elements(:'av'::jsonb -> 'items') x where x ->> 'action' = 'reveal.legacy12'), 'event',
  'audit_v2: linha antiga sem alvo recebe o evento');
select ok((select bool_and(x ->> 'action' like 'participant.%') from jsonb_array_elements(public.admin_list_audit_v2(200, 0, 'participante', null) -> 'items') x),
  'audit_v2: categoria participante');
select ok((select bool_and(x ->> 'action' like 'reveal.%') from jsonb_array_elements(public.admin_list_audit_v2(200, 0, 'revelacao', null) -> 'items') x),
  'audit_v2: categoria revelacao');
select throws_ok($$select public.admin_list_audit_v2(25, 0, 'outra', null)$$, 'MM005', null, 'audit_v2: categoria inválida MM005');

-- storage
select public.admin_storage_breakdown() as sb \gset
select ok(tests.has_keys(:'sb'::jsonb, array['originals', 'derived', 'orphans', 'branding', 'avgPhotoBytes', 'growth']), 'storage: chaves de topo');
select ok(tests.has_keys(:'sb'::jsonb -> 'originals', array['n', 'bytes']) and tests.has_keys(:'sb'::jsonb -> 'orphans', array['n', 'bytes']), 'storage: {n, bytes}');
select ok((:'sb'::jsonb -> 'originals' ->> 'n')::int >= 1 and (:'sb'::jsonb -> 'derived' ->> 'n')::int >= 1, 'storage: original e miniatura contados');
select ok((:'sb'::jsonb -> 'orphans' ->> 'n')::int >= 1, 'storage: objeto sem linha em photos é órfão');
select ok(jsonb_array_length(:'sb'::jsonb -> 'growth') = 0 or tests.has_keys(:'sb'::jsonb -> 'growth' -> 0, array['day', 'bytes']), 'storage: growth {day, bytes}');

-- saúde: histórico (com corridas simuladas do mm-reveal-due)
reset role;
-- corridas reais do job (o pg_cron roda mm-reveal-due a cada minuto no stack local) seriam mais novas que as simuladas
delete from cron.job_run_details where jobid in (select jobid from cron.job where jobname = 'mm-reveal-due');
insert into cron.job_run_details (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time)
select j.jobid, 990000 + g, 1, 'postgres', 'postgres', 'x', case when g <= 2 then 'failed' else 'succeeded' end, 'm',
       now() - (g || ' minutes')::interval, now() - (g || ' minutes')::interval + interval '1 second'
from cron.job j, generate_series(1, 3) g where j.jobname = 'mm-reveal-due';
select tests.login('00000000-0000-4000-8000-0000000012c1', 'master');
select public.admin_health_history(24) as hh \gset
select ok(tests.has_keys(:'hh'::jsonb, array['jobs']), 'health: jobs');
select ok(tests.has_keys((select x from jsonb_array_elements(:'hh'::jsonb -> 'jobs') x where x ->> 'name' = 'mm-reveal-due'),
  array['name', 'schedule', 'active', 'runs', 'consecutiveFailures']), 'health: chaves do job');
select is((select (x ->> 'consecutiveFailures')::int from jsonb_array_elements(:'hh'::jsonb -> 'jobs') x where x ->> 'name' = 'mm-reveal-due'), 2,
  'health: falhas consecutivas mais recentes');
select ok(tests.has_keys((select x -> 'runs' -> 0 from jsonb_array_elements(:'hh'::jsonb -> 'jobs') x where x ->> 'name' = 'mm-reveal-due'),
  array['startedAt', 'durationMs', 'status']), 'health: corrida {startedAt, durationMs, status}');
select is((select (x ->> 'active')::boolean from jsonb_array_elements(:'hh'::jsonb -> 'jobs') x where x ->> 'name' = 'mm-purge-anon-orphans'), false,
  'health: mm-purge-anon-orphans aparece inativo');
select ok((public.admin_overview(30, false) -> 'alerts' ->> 'failingJobs')::int >= 1, 'overview: job com falha na última corrida vira alerta');

-- ===================================================== revelar agora
select throws_ok($$select public.admin_reveal_now('00000000-0000-4000-8000-0000000012e7', null)$$, 'MM011', 'reasonrequired', 'revelar agora sem motivo: MM011');
select throws_ok($$select public.admin_reveal_now('00000000-0000-4000-8000-0000000012e7', 'curto')$$, 'MM011', 'reasonrequired', 'revelar agora com motivo curto: MM011');
reset role;
select is((select revealed_at from public.events where id = '00000000-0000-4000-8000-0000000012e7'), null, 'sem motivo: nada revelado');
select tests.login('00000000-0000-4000-8000-0000000012c1', 'master');
select is(public.admin_reveal_now('00000000-0000-4000-8000-0000000012e7', 'Anfitriã pediu por telefone') ->> 'ok', 'true', 'revelar agora: {ok: true}');
select throws_ok($$select public.admin_reveal_now('00000000-0000-4000-8000-0000000012e7', 'Anfitriã pediu por telefone')$$, 'MM008', null, 'revelar de novo: MM008');
select throws_ok($$select public.admin_reveal_now('00000000-0000-4000-8000-0000000012e1', 'Anfitriã pediu por telefone')$$, 'MM005', null, 'evento sem revelação: MM005');
reset role;
select ok((select revealed_at is not null and reveal_status = 'revelada' from public.events where id = '00000000-0000-4000-8000-0000000012e7'), 'evento revelado');
select is((select count(*)::int from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000012e7' and action = 'reveal.released'), 1,
  'mesma trilha da rotina do servidor (reveal.released)');
select is((select count(*)::int from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000012e7' and action = 'admin.reveal_now'
           and actor_id = '00000000-0000-4000-8000-0000000012c1' and actor_role = 'master' and reason = 'Anfitriã pediu por telefone'), 1,
  'admin.reveal_now auditado com motivo');
select is((select actor_role from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000012e7' and action = 'reveal.released'
           and actor_id is null), 'sistema', 'reveal.released gravado por admin_reveal_now (sem ator): sistema, não master');
select ok(public.is_revealed('00000000-0000-4000-8000-0000000012e7'), 'is_revealed passa a valer');
-- a rotina agendada continua funcionando (agora pela mesma função); no cron não há JWT
select tests.claims(null);
select ok(public.reveal_due_events() >= 1, 'reveal_due_events libera a vencida');
select is((select revealed_at = reveal_at from public.events where id = '00000000-0000-4000-8000-0000000012e8'), true, 'vencida revelada no horário marcado');
select is((select count(*)::int from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000012e8' and action = 'reveal.released'
           and actor_id is null and actor_role = 'sistema' and detail ? 'ran_at'), 1, 'rotina audita como sistema');

-- ===================================================== marcar como teste
select tests.login('00000000-0000-4000-8000-0000000012c1', 'master');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000012e5'::uuid], true, 'curto')$$, 'MM011', 'reasonrequired', 'set_test_flag sem motivo: MM011');
select throws_ok($$select public.admin_set_test_flag(array[]::uuid[], true, 'motivo longo o bastante')$$, 'MM005', null, 'set_test_flag sem eventos: MM005');
select is((public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000012e5'::uuid], true, 'Evento criado em demonstração') ->> 'updated')::int, 1,
  'set_test_flag marca um evento');
reset role;
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000012e5'), true, 'e5 agora é teste');
select is((select count(*)::int from public.audit_logs where target_id = '00000000-0000-4000-8000-0000000012e5' and action = 'admin.set_test_flag'
           and reason = 'Evento criado em demonstração' and actor_role = 'master'), 1, 'set_test_flag auditado por evento');

-- ===================================================== exclusão em lote (soft delete, só testes)
select tests.login('00000000-0000-4000-8000-0000000012c1', 'master');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000012e1'::uuid], 'Limpeza de homologação')$$,
  'MM005', null, 'soft delete recusa evento real');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000012e2'::uuid, '00000000-0000-4000-8000-0000000012e1'::uuid], 'Limpeza de homologação')$$,
  'MM005', null, 'lote misto é recusado inteiro');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000012e2'::uuid], 'curto')$$,
  'MM011', 'reasonrequired', 'soft delete sem motivo: MM011');
select throws_ok($$select public.admin_soft_delete_test_events(array[gen_random_uuid()], 'Limpeza de homologação')$$,
  'MM005', null, 'soft delete de evento inexistente: MM005');
reset role;
select is((select count(*)::int from public.events where id in ('00000000-0000-4000-8000-0000000012e1', '00000000-0000-4000-8000-0000000012e2') and deleted_at is not null), 0,
  'recusas não apagam nada');
select tests.login('00000000-0000-4000-8000-0000000012c1', 'master');
select is((public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000012e2'::uuid, '00000000-0000-4000-8000-0000000012e3'::uuid], 'Limpeza de homologação') ->> 'deleted')::int,
  2, 'soft delete de dois eventos de teste');
reset role;
select is((select count(*)::int from public.events where id in ('00000000-0000-4000-8000-0000000012e2', '00000000-0000-4000-8000-0000000012e3')), 2,
  'linhas continuam existindo (sem DELETE)');
select is((select count(*)::int from public.events where id in ('00000000-0000-4000-8000-0000000012e2', '00000000-0000-4000-8000-0000000012e3') and deleted_at is not null), 2,
  'deleted_at gravado');
select is((select count(*)::int from public.audit_logs where action = 'admin.soft_delete_test_events' and reason = 'Limpeza de homologação'
           and target_id in ('00000000-0000-4000-8000-0000000012e2', '00000000-0000-4000-8000-0000000012e3')), 2, 'soft delete auditado por evento');
select ok((select prosrc !~* 'delete\s+from' from pg_proc where proname = 'admin_soft_delete_test_events'), 'a função não contém DELETE');
select tests.login('00000000-0000-4000-8000-0000000012c1', 'master');
select ok((select x ->> 'deletedAt' is not null from jsonb_array_elements(public.admin_list_events_v2(100, 0, '12', 'excluido', true, null, null) -> 'items') x
           where x ->> 'id' = '00000000-0000-4000-8000-0000000012e2'), 'events_v2: status excluido lista os apagados');
select ok(not ('00000000-0000-4000-8000-0000000012e2' = any (tests.ids(public.admin_list_events_v2(100, 0, '12', null, true, null, null) -> 'items'))),
  'events_v2: apagado sai da lista padrão');
reset role;

-- ===================================================== órfãos anônimos
select ok(not exists (select 1 from pg_extension where extname = 'pg_cron')
          or exists (select 1 from cron.job where jobname = 'mm-purge-anon-orphans' and not active and schedule ~ '^\S+ \S+ \* \* \*$'),
  'mm-purge-anon-orphans diário e inativo');
-- M3: anônimos antigos sem participação atual, mas com rastro (consentimento, ex-participação auditada, reação) ficam;
-- d7 é outro órfão puro (para o limite por execução)
insert into auth.users (id, aud, role, email, is_anonymous, raw_user_meta_data, raw_app_meta_data, created_at) values
  ('00000000-0000-4000-8000-0000000012d4', 'authenticated', 'authenticated', null, true, '{}', '{}', now() - interval '10 days'),
  ('00000000-0000-4000-8000-0000000012d5', 'authenticated', 'authenticated', null, true, '{}', '{}', now() - interval '10 days'),
  ('00000000-0000-4000-8000-0000000012d6', 'authenticated', 'authenticated', null, true, '{}', '{}', now() - interval '10 days'),
  ('00000000-0000-4000-8000-0000000012d7', 'authenticated', 'authenticated', null, true, '{}', '{}', now() - interval '10 days');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000012d%' on conflict do nothing;
insert into public.user_consents (user_id, role, event_id, terms_version, privacy_version)
values ('00000000-0000-4000-8000-0000000012d4', 'convidado', '00000000-0000-4000-8000-0000000012e1', 'v1', 'v1');
insert into public.audit_logs (actor_id, event_id, action) values ('00000000-0000-4000-8000-0000000012d5', '00000000-0000-4000-8000-0000000012e1', 'participant.joined');
insert into public.reactions (photo_id, author_id, event_id, kind)
values ('00000000-0000-4000-8000-0000000012f1', '00000000-0000-4000-8000-0000000012d6', '00000000-0000-4000-8000-0000000012e1', 'amei');

select tests.claims(null);
select is(public.purge_anon_orphans(1), 1, 'purge_anon_orphans respeita o limite por execução');
select is((select (detail ->> 'limit')::int from public.audit_logs where action = 'system.anon_orphans_purged' order by id desc limit 1), 1,
  'limite auditado');
select public.purge_anon_orphans() as purged \gset
select ok(:purged >= 1, 'purge_anon_orphans remove ao menos um');
select ok(not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000012d1'), 'anônimo órfão antigo removido');
select ok(not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000012d7'), 'segundo órfão removido na execução seguinte');
select ok(exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000012d2'), 'anônimo recente fica');
select ok(exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000012d3'), 'anônimo com participação fica');
select ok(exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000012d4'), 'anônimo com consentimento registrado fica (prova de aceite)');
select ok(exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000012d5'), 'anônimo que já participou (saiu ou foi removido) fica');
select ok(exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000012d6'), 'anônimo com reação fica');
select ok(exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000012b1'), 'usuário não anônimo antigo fica');
select is((select (detail ->> 'count')::int from public.audit_logs where action = 'system.anon_orphans_purged' order by id desc limit 1), :purged,
  'contagem auditada');
select is((select actor_role from public.audit_logs where action = 'system.anon_orphans_purged' order by id desc limit 1), 'sistema', 'auditada como sistema');

select * from finish();
rollback;
