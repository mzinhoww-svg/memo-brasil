-- pgTAP · papéis do console (M32): current_platform_role, e-mail mascarado NO SERVIDOR para support e auditor, e o que cada papel pode
-- (ou não) chamar. Espelha a matriz de docs/evidence/revela-fiel/master/DIVERGENCIAS.md e web/src/lib/master/roles.ts.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', p_aal,
    'app_metadata', case when p_role is not null then json_build_object('role', p_role) else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000033a1', 'master33@dominio.test', false),
  ('00000000-0000-4000-8000-0000000033a2', 'support33@dominio.test', false),
  ('00000000-0000-4000-8000-0000000033a3', 'auditor33@dominio.test', false),
  ('00000000-0000-4000-8000-0000000033a4', 'semrole33@dominio.test', false),
  ('00000000-0000-4000-8000-0000000033a5', 'claimsolta33@dominio.test', false),
  ('00000000-0000-4000-8000-0000000033a6', 'linhasolta33@dominio.test', false),
  ('00000000-0000-4000-8000-0000000033b1', 'ana33@dominio.test', false);
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000033a1', 'Master 33'), ('00000000-0000-4000-8000-0000000033a2', 'Support 33'), ('00000000-0000-4000-8000-0000000033a3', 'Auditor 33'),
  ('00000000-0000-4000-8000-0000000033a4', 'Sem papel 33'), ('00000000-0000-4000-8000-0000000033a5', 'Claim solta'), ('00000000-0000-4000-8000-0000000033a6', 'Linha solta'),
  ('00000000-0000-4000-8000-0000000033b1', 'Ana 33') on conflict do nothing;
insert into public.platform_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000033a1', 'master'), ('00000000-0000-4000-8000-0000000033a2', 'support'),
  ('00000000-0000-4000-8000-0000000033a3', 'auditor'), ('00000000-0000-4000-8000-0000000033a6', 'support');
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled) values
  ('00000000-0000-4000-8000-0000000033e1', 'Evento 33', 'casamento', '00000000-0000-4000-8000-0000000033b1', 'Ana 33', 6, 20, 10, true);

-- ===================================================================== current_platform_role
select tests.login('00000000-0000-4000-8000-0000000033a1', 'master');
select is(public.current_platform_role(), 'master', 'master: papel master');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033a2', 'support');
select is(public.current_platform_role(), 'support', 'support: papel support');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033a3', 'auditor');
select is(public.current_platform_role(), 'auditor', 'auditor: papel auditor');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033a4');
select is(public.current_platform_role(), null, 'sem papel: nulo');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033a5', 'support');
select is(public.current_platform_role(), null, 'claim sem linha ativa: nulo');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033a6');
select is(public.current_platform_role(), null, 'linha ativa sem claim: nulo');
reset role;
set local role anon;
select throws_ok($$select public.current_platform_role()$$, '42501', null, 'sem sessão não consulta o papel');
reset role;

-- ===================================================================== e-mail mascarado no servidor
select tests.login('00000000-0000-4000-8000-0000000033a1', 'master');
select ok((select bool_or(i ->> 'email' = 'ana33@dominio.test') from jsonb_array_elements(public.admin_list_organizers(50, 0) -> 'items') i), 'master vê o e-mail completo (organizadores)');
select ok((select bool_or(i ->> 'email' = 'support33@dominio.test') from jsonb_array_elements(public.admin_search_users(50, 0) -> 'items') i), 'master vê o e-mail completo (contas)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033a2', 'support');
select ok((select bool_or(i ->> 'email' = 'a***@dominio.test') from jsonb_array_elements(public.admin_list_organizers(50, 0) -> 'items') i), 'support: organizadores com a***@dominio');
select ok(not exists (select 1 from jsonb_array_elements(public.admin_list_organizers(50, 0) -> 'items') i where i ->> 'email' like '%33@dominio.test' and i ->> 'email' !~ '\*\*\*'), '... nenhum e-mail completo');
select ok((select bool_and(i ->> 'email' ~ '^.\*\*\*@' or i ->> 'email' is null) from jsonb_array_elements(public.admin_search_users(50, 0) -> 'items') i), 'support: contas só mascaradas');
select ok((select bool_and(i ->> 'email' ~ '^.\*\*\*@' or i ->> 'email' is null) from jsonb_array_elements(public.admin_list_users_v2(50, 0) -> 'items') i), 'support: contas v2 só mascaradas');
select is(public.admin_search_users(50, 0, 'support33@dominio') ->> 'total', '0', 'support não busca por e-mail (não reconstrói o endereço por prefixo)');
select ok(not (public.admin_search('ana33@dominio')::text ~ 'ana33@dominio'), 'busca global do support não devolve o e-mail completo');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033a3', 'auditor');
select ok((select bool_and(i ->> 'email' ~ '^.\*\*\*@' or i ->> 'email' is null) from jsonb_array_elements(public.admin_search_users(50, 0) -> 'items') i), 'auditor: contas só mascaradas');
select ok((select bool_and(i ->> 'email' ~ '^.\*\*\*@' or i ->> 'email' is null) from jsonb_array_elements(public.admin_list_organizers(50, 0) -> 'items') i), 'auditor: organizadores só mascarados');
reset role;

-- ===================================================================== o que cada papel chama
-- leitura operacional: master, support e auditor
select tests.login('00000000-0000-4000-8000-0000000033a2', 'support');
select lives_ok($$select public.admin_events_board()$$, 'support lê Eventos');
select lives_ok($$select public.admin_search_participants(25, 0)$$, 'support lê Convidados');
select lives_ok($$select public.admin_search_invites(25, 0)$$, 'support lê Convites');
select lives_ok($$select public.admin_reveals_board()$$, 'support lê Revelações');
select lives_ok($$select public.admin_moderation_queue()$$, 'support lê a fila de Moderação');
select lives_ok($$select public.admin_health()$$, 'support lê Saúde');
select lives_ok($$select public.admin_lgpd_requests()$$, 'support lê LGPD');
-- sem permissão para support
select throws_ok($$select public.admin_list_audit()$$, 'MM004', null, 'support não lê a Auditoria');
select throws_ok($$select public.admin_list_audit_v2()$$, 'MM004', null, 'support não lê a Auditoria (por categoria)');
select throws_ok($$select public.admin_export_csv('eventos')$$, 'MM004', null, 'support não exporta');
select throws_ok($$select public.admin_list_payments()$$, 'MM004', null, 'support não lê Pagamentos');
select throws_ok($$select public.admin_payments_summary()$$, 'MM004', null, 'support não lê o resumo de Pagamentos');
select throws_ok($$select public.admin_list_plans()$$, 'MM004', null, 'support não lê Planos');
select throws_ok($$select public.admin_list_codes()$$, 'MM004', null, 'support não lê Cortesias');
select throws_ok($$select public.admin_print_orders()$$, 'MM004', null, 'support não lê Impressões');
select throws_ok($$select public.admin_reveal_now('00000000-0000-4000-8000-0000000033e1', 'support tentando revelar')$$, 'MM004', null, 'support não revela (admin_reveal_now)');
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000033e1', 'support tentando revelar')$$, 'MM004', null, 'support não revela (reveal_now, não é anfitrião)');
select throws_ok($$select public.admin_set_setting('x.y', '{}', 'support tentando gravar')$$, 'MM004', null, 'support não altera configurações');
select throws_ok($$select public.admin_grant_platform_role('00000000-0000-4000-8000-0000000033a4', 'support', 'support dando papel')$$, 'MM004', null, 'support não concede papel');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000033e1']::uuid[], true, 'support marcando teste')$$, 'MM004', null, 'support não marca evento de teste');
select is((select count(*)::int from public.platform_roles), 0, 'support não lê a tabela de papéis (equipe)');
reset role;

select tests.login('00000000-0000-4000-8000-0000000033a3', 'auditor');
select lives_ok($$select public.admin_list_audit()$$, 'auditor lê a Auditoria');
select lives_ok($$select public.admin_list_audit_v2()$$, 'auditor lê a Auditoria (por categoria)');
select lives_ok($$select public.admin_export_csv('auditoria')$$, 'auditor exporta a Auditoria');
select throws_ok($$select public.admin_export_csv('pagamentos')$$, 'MM004', null, 'auditor não exporta Pagamentos');
select throws_ok($$select public.admin_list_payments()$$, 'MM004', null, 'auditor não lê Pagamentos');
select throws_ok($$select public.admin_print_orders()$$, 'MM004', null, 'auditor não lê Impressões');
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000033e1', 'auditor tentando revelar')$$, 'MM004', null, 'auditor não revela');
select throws_ok($$select public.admin_set_feature_flag('x', true, '{}', 'auditor ligando chave')$$, 'MM004', null, 'auditor não liga chave');
reset role;

-- sem papel (e claim solta / linha solta): nada do console
select tests.login('00000000-0000-4000-8000-0000000033a4');
select throws_ok($$select public.admin_events_board()$$, 'MM004', null, 'sem papel não lê Eventos');
select throws_ok($$select public.admin_list_audit()$$, 'MM004', null, 'sem papel não lê a Auditoria');
select throws_ok($$select public.admin_export_csv('eventos')$$, 'MM004', null, 'sem papel não exporta');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033a5', 'support');
select throws_ok($$select public.admin_events_board()$$, 'MM004', null, 'claim sem linha ativa não lê Eventos');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033a6');
select throws_ok($$select public.admin_events_board()$$, 'MM004', null, 'linha ativa sem claim não lê Eventos');
reset role;

-- master continua podendo tudo isso
select tests.login('00000000-0000-4000-8000-0000000033a1', 'master');
select lives_ok($$select public.admin_list_audit()$$, 'master lê a Auditoria');
select lives_ok($$select public.admin_export_csv('eventos')$$, 'master exporta');
select lives_ok($$select public.admin_list_payments()$$, 'master lê Pagamentos');
select lives_ok($$select public.admin_print_orders()$$, 'master lê Impressões');
reset role;

select * from finish();
rollback;
