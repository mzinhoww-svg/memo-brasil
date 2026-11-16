-- pgTAP · Master: Pessoas (M15 a M19). Permissão por papel em cada função e ação, e-mail mascarado NO SERVIDOR, convites sem token,
-- último master não revogável, motivo de 10 a 500 caracteres recusado no servidor, filtros e contagens, exportação das abas.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1',
    'app_metadata', case when p_role is not null then json_build_object('role', p_role) else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;
create function tests.ex(p_kind text, p_filters jsonb default '{}') returns jsonb language plpgsql security definer as $$
begin
  delete from public.rate_limits where key like 'export:%'; -- o teste chama a RPC dezenas de vezes
  return public.admin_export_csv(p_kind, p_filters);
end $$;
grant execute on function tests.ex(text, jsonb) to authenticated;
create function tests.users_count() returns text language sql security definer as $$ select count(*)::text from auth.users $$;
grant execute on function tests.users_count() to authenticated;

insert into auth.users (id, email, is_anonymous, raw_app_meta_data, last_sign_in_at) values
  ('00000000-0000-4000-8000-0000000034a1', 'master34@dominio.test', false, '{"provider":"google"}', now()),
  ('00000000-0000-4000-8000-0000000034a2', 'master34b@dominio.test', false, '{"provider":"google"}', now()),
  ('00000000-0000-4000-8000-0000000034a3', 'support34@dominio.test', false, '{"provider":"email"}', now()),
  ('00000000-0000-4000-8000-0000000034a4', 'auditor34@dominio.test', false, '{"provider":"email"}', now()),
  ('00000000-0000-4000-8000-0000000034a5', 'semrole34@dominio.test', false, '{"provider":"email"}', now()),
  ('00000000-0000-4000-8000-0000000034b1', 'ana34@dominio.test', false, '{"provider":"google"}', now()),
  ('00000000-0000-4000-8000-0000000034d1', 'novo34@dominio.test', false, '{"provider":"email"}', now());
insert into auth.users (id, email, is_anonymous, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000034c1', null, true, '{"provider":"anonymous"}'),
  ('00000000-0000-4000-8000-0000000034c2', null, true, '{"provider":"anonymous"}'),
  ('00000000-0000-4000-8000-0000000034c3', null, true, '{"provider":"anonymous"}');
insert into public.profiles (id, display_name)
  select id, 'Perfil ' || right(id::text, 4) from auth.users where id::text like '00000000-0000-4000-8000-0000000034%'
  on conflict do nothing;
update public.profiles set display_name = 'Ana 34' where id = '00000000-0000-4000-8000-0000000034b1';
insert into public.platform_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000034a1', 'master'), ('00000000-0000-4000-8000-0000000034a3', 'support'), ('00000000-0000-4000-8000-0000000034a4', 'auditor');

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled) values
  ('00000000-0000-4000-8000-0000000034e1', 'Evento 34', 'casamento', '00000000-0000-4000-8000-0000000034b1', 'Ana 34', 6, 20, 10, false);
insert into public.participants (event_id, user_id, name, blocked_at) values
  ('00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034b1', 'Ana 34', null),
  ('00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034c1', 'Bia 34', null),
  ('00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034c2', 'Jorge 34', now());
insert into public.photos (id, event_id, author_id, author_name, upload_status, storage_path)
  select ('00000000-0000-4000-8000-00000000341' || n)::uuid, '00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034c1', 'Bia 34', 'pronta',
         '00000000-0000-4000-8000-0000000034e1/' || ('00000000-0000-4000-8000-00000000341' || n)
    from generate_series(1, 3) n;
insert into public.invitations (id, event_id, label, token_hash, expires_at, max_uses, uses, revoked_at) values
  ('00000000-0000-4000-8000-0000000034f1', '00000000-0000-4000-8000-0000000034e1', 'Geral 34', 'hash-secreto-ativo', now() + interval '2 days', null, 4, null),
  ('00000000-0000-4000-8000-0000000034f2', '00000000-0000-4000-8000-0000000034e1', 'Expirado 34', 'hash-secreto-expirado', now() - interval '1 day', 10, 1, null),
  ('00000000-0000-4000-8000-0000000034f3', '00000000-0000-4000-8000-0000000034e1', 'Esgotado 34', 'hash-secreto-esgotado', now() + interval '2 days', 2, 2, null),
  ('00000000-0000-4000-8000-0000000034f4', '00000000-0000-4000-8000-0000000034e1', 'Revogado 34', 'hash-secreto-revogado', now() + interval '2 days', null, 0, now());
insert into public.account_deletion_requests (user_id) values ('00000000-0000-4000-8000-0000000034b1');
-- 505 pedidos pagos de R$ 1,00 (passa do limite de 500 da soma antiga) e um pendente que não entra no gasto
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, payment_method, idempotency_key)
  select gen_random_uuid(), '00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034b1', p.code, 100, 'pago', 'validapay', 'sandbox', 'pix', gen_random_uuid()
    from public.plans p, generate_series(1, 505) where not p.is_free and p.pack_of is null and p.sort = (select min(sort) from public.plans where not is_free);
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, payment_method, idempotency_key)
  select gen_random_uuid(), '00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034b1', code, 7000, 'pendente', 'validapay', 'sandbox', 'pix', gen_random_uuid()
    from public.plans where not is_free and pack_of is null order by sort limit 1;

-- ===================================================================== permissão: leitura (master, support e auditor leem; sem papel não)
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select lives_ok($$select public.admin_people_counts()$$, 'master: contagem das abas');
select lives_ok($$select public.admin_list_users_v2(25, 0)$$, 'master: contas');
select lives_ok($$select public.admin_list_organizers(25, 0)$$, 'master: organizadores');
select lives_ok($$select public.admin_search_participants_v2(25, 0)$$, 'master: convidados');
select lives_ok($$select public.admin_search_invites_v2(25, 0)$$, 'master: convites');
select lives_ok($$select public.admin_list_team()$$, 'master: equipe');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a3', 'support');
select lives_ok($$select public.admin_people_counts()$$, 'support: contagem das abas');
select lives_ok($$select public.admin_list_users_v2(25, 0)$$, 'support: contas');
select lives_ok($$select public.admin_list_organizers(25, 0)$$, 'support: organizadores');
select lives_ok($$select public.admin_search_participants_v2(25, 0)$$, 'support: convidados');
select lives_ok($$select public.admin_search_invites_v2(25, 0)$$, 'support: convites');
select throws_ok($$select public.admin_list_team()$$, 'MM004', null, 'support: equipe é só do master');
select throws_ok($$select public.admin_export_csv('pessoas', '{"aba":"contas"}')$$, 'MM004', null, 'support: não exporta');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a4', 'auditor');
select lives_ok($$select public.admin_people_counts()$$, 'auditor: contagem das abas');
select lives_ok($$select public.admin_list_users_v2(25, 0)$$, 'auditor: contas');
select lives_ok($$select public.admin_list_organizers(25, 0)$$, 'auditor: organizadores');
select lives_ok($$select public.admin_search_participants_v2(25, 0)$$, 'auditor: convidados');
select lives_ok($$select public.admin_search_invites_v2(25, 0)$$, 'auditor: convites');
select throws_ok($$select public.admin_list_team()$$, 'MM004', null, 'auditor: equipe é só do master');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a5');
select throws_ok($$select public.admin_people_counts()$$, 'MM004', null, 'sem papel: contagem negada');
select throws_ok($$select public.admin_list_users_v2(25, 0)$$, 'MM004', null, 'sem papel: contas negadas');
select throws_ok($$select public.admin_list_organizers(25, 0)$$, 'MM004', null, 'sem papel: organizadores negados');
select throws_ok($$select public.admin_search_participants_v2(25, 0)$$, 'MM004', null, 'sem papel: convidados negados');
select throws_ok($$select public.admin_search_invites_v2(25, 0)$$, 'MM004', null, 'sem papel: convites negados');
select throws_ok($$select public.admin_list_team()$$, 'MM004', null, 'sem papel: equipe negada');
select throws_ok($$select public.admin_export_csv('pessoas', '{"aba":"contas"}')$$, 'MM004', null, 'sem papel: não exporta');
select throws_ok($$select public.admin_grant_platform_role_by_email('novo34@dominio.test', 'support', 'sem papel tentando conceder')$$, 'MM004', null, 'sem papel: não concede');
reset role;
set local role anon;
select throws_ok($$select public.admin_people_counts()$$, '42501', null, 'sem sessão: sem acesso à contagem');
select throws_ok($$select public.admin_list_team()$$, '42501', null, 'sem sessão: sem acesso à equipe');
reset role;

-- ===================================================================== permissão: ações da equipe só do master
select tests.login('00000000-0000-4000-8000-0000000034a3', 'support');
select throws_ok($$select public.admin_grant_platform_role_by_email('novo34@dominio.test', 'support', 'support tentando conceder')$$, 'MM004', null, 'support não concede (por e-mail)');
select throws_ok($$select public.admin_grant_platform_role('00000000-0000-4000-8000-0000000034d1', 'support', 'support tentando conceder')$$, 'MM004', null, 'support não concede (por id)');
select throws_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000034a4', 'auditor', 'support tentando revogar')$$, 'MM004', null, 'support não revoga');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a4', 'auditor');
select throws_ok($$select public.admin_grant_platform_role_by_email('novo34@dominio.test', 'support', 'auditor tentando conceder')$$, 'MM004', null, 'auditor não concede');
select throws_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000034a3', 'support', 'auditor tentando revogar')$$, 'MM004', null, 'auditor não revoga');
reset role;
select is((select count(*)::int from public.platform_roles where revoked_at is null), 3, 'nada mudou na equipe depois das tentativas negadas');

-- ===================================================================== e-mail mascarado NO SERVIDOR
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select ok((select bool_or(i ->> 'email' = 'ana34@dominio.test') from jsonb_array_elements(public.admin_list_users_v2(100, 0) -> 'items') i), 'master vê o e-mail completo (contas)');
select ok((select bool_or(i ->> 'email' = 'ana34@dominio.test') from jsonb_array_elements(public.admin_list_organizers(25, 0) -> 'items') i), 'master vê o e-mail completo (organizadores)');
select ok((select bool_or(i ->> 'email' = 'support34@dominio.test') from jsonb_array_elements(public.admin_list_team() -> 'items') i), 'master vê o e-mail completo (equipe)');
select is(public.admin_list_users_v2(25, 0, null, false, 'ana34@dominio') ->> 'total', '1', 'master busca conta por e-mail');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a3', 'support');
select ok((select bool_and(i ->> 'email' ~ '^.\*\*\*@' or i ->> 'email' is null) from jsonb_array_elements(public.admin_list_users_v2(100, 0) -> 'items') i), 'support: contas só mascaradas');
select ok((select bool_and(i ->> 'email' ~ '^.\*\*\*@') from jsonb_array_elements(public.admin_list_organizers(25, 0) -> 'items') i), 'support: organizadores só mascarados');
select is(public.admin_list_users_v2(25, 0, null, false, 'ana34@dominio') ->> 'total', '0', 'support não busca conta por e-mail');
select is(public.admin_list_organizers(25, 0, 'ana34@dominio') ->> 'total', '0', 'support não busca organizador por e-mail');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a4', 'auditor');
select ok((select bool_and(i ->> 'email' ~ '^.\*\*\*@' or i ->> 'email' is null) from jsonb_array_elements(public.admin_list_users_v2(100, 0) -> 'items') i), 'auditor: contas só mascaradas');
select ok((select bool_and(i ->> 'email' ~ '^.\*\*\*@') from jsonb_array_elements(public.admin_list_organizers(25, 0) -> 'items') i), 'auditor: organizadores só mascarados');
select is(tests.ex('pessoas', '{"aba":"contas"}') ->> 'csv' ~ 'master34@dominio', false, 'auditor: CSV de contas sem e-mail completo');
select ok(tests.ex('pessoas', '{"aba":"contas"}') ->> 'csv' ~ 'm\*\*\*@dominio.test', 'auditor: CSV de contas com a***@dominio');
select is(tests.ex('pessoas', '{"aba":"organizadores"}') ->> 'csv' ~ 'ana34@dominio', false, 'auditor: CSV de organizadores sem e-mail completo');
reset role;

-- ===================================================================== organizadores: ativos, fotos, último evento, LGPD, entrou com, gasto total
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select is((select i ->> 'provider' from jsonb_array_elements(public.admin_list_organizers(25, 0) -> 'items') i where i ->> 'userId' = '00000000-0000-4000-8000-0000000034b1'), 'google', 'organizador: entrou com google');
select is((select (i ->> 'spendCents')::int from jsonb_array_elements(public.admin_list_organizers(25, 0) -> 'items') i where i ->> 'userId' = '00000000-0000-4000-8000-0000000034b1'), 50500,
          'gasto total somado no servidor: 505 pedidos pagos (acima do limite antigo de 500), sem o pendente');
select is((select (i ->> 'deletionRequested')::boolean from jsonb_array_elements(public.admin_list_organizers(25, 0) -> 'items') i where i ->> 'userId' = '00000000-0000-4000-8000-0000000034b1'), true, 'selo LGPD: pedido de exclusão aberto');
select is(public.admin_list_organizers(25, 0) -> 'summary' ->> 'deletionPending', '1', 'resumo: 1 com exclusão pedida');
select ok((select (i ->> 'photos')::int = 3 and (i ->> 'activeEvents')::int >= 0 and i ->> 'lastEventAt' is not null from jsonb_array_elements(public.admin_list_organizers(25, 0) -> 'items') i
            where i ->> 'userId' = '00000000-0000-4000-8000-0000000034b1'), 'organizador: fotos prontas, ativos e último evento');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a3', 'support');
select ok((select bool_and(i -> 'spendCents' = 'null'::jsonb) from jsonb_array_elements(public.admin_list_organizers(25, 0) -> 'items') i), 'support: gasto total não é devolvido (Pagamentos é do master)');
reset role;

-- ===================================================================== contas: filtro por tipo, contagens, busca por id
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select is(public.admin_list_users_v2(25, 0, 'team') ->> 'total', '3', 'contas: filtro Equipe');
select is(public.admin_list_users_v2(25, 0, 'anon') ->> 'total', '3', 'contas: filtro Convidados');
select is(public.admin_list_users_v2(25, 0, 'google') ->> 'total', '3', 'contas: filtro Google (master, master b e a anfitriã)');
select is(public.admin_list_users_v2(25, 0) -> 'summary' ->> 'team', '3', 'contas: resumo da equipe');
select is(public.admin_list_users_v2(25, 0) -> 'summary' ->> 'orphanAnon', '1', 'contas: 1 convidado órfão (sem participação)');
select is(public.admin_list_users_v2(25, 0, null, false, '00000000-0000-4000-8000-0000000034b1') ->> 'total', '1', 'contas: busca pelo id inteiro');
select is(public.admin_list_users_v2(25, 0, null, false, '00000000') ->> 'total', tests.users_count(), 'contas: busca pelo início do id');
select throws_ok($$select public.admin_list_users_v2(25, 0, 'xyz')$$, 'MM005', null, 'contas: tipo inválido');
select is((public.admin_people_counts() ->> 'accounts')::int, (public.admin_list_users_v2(1, 0) ->> 'total')::int, 'aba Contas = total da lista');
select is((public.admin_people_counts() ->> 'team')::int, 3, 'aba Equipe = papéis ativos');
select is((public.admin_people_counts() ->> 'guests')::int, 3, 'aba Convidados = participações');
select is((public.admin_people_counts() ->> 'invites')::int, 4, 'aba Convites = convites');
select is((public.admin_people_counts() ->> 'organizers')::int, 1, 'aba Organizadores = quem tem evento');
reset role;

-- ===================================================================== convidados: situação
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select is(public.admin_search_participants_v2(25, 0) -> 'summary' ->> 'total', '3', 'convidados: resumo total');
select is(public.admin_search_participants_v2(25, 0) -> 'summary' ->> 'ativos', '1', 'convidados: 1 ativo');
select is(public.admin_search_participants_v2(25, 0) -> 'summary' ->> 'bloqueados', '1', 'convidados: 1 bloqueado');
select is(public.admin_search_participants_v2(25, 0) -> 'summary' ->> 'organizadores', '1', 'convidados: 1 organizador');
select is(public.admin_search_participants_v2(25, 0, null, 'bloqueados') #>> '{items,0,name}', 'Jorge 34', 'convidados: filtro Bloqueados');
select is(public.admin_search_participants_v2(25, 0, null, 'organizadores') #>> '{items,0,name}', 'Ana 34', 'convidados: filtro Organizadores');
select is(public.admin_search_participants_v2(25, 0, null, 'ativos') #>> '{items,0,situation}', 'ativo', 'convidados: filtro Ativos');
select is((select (i ->> 'photos')::int from jsonb_array_elements(public.admin_search_participants_v2(25, 0, 'Bia') -> 'items') i), 3, 'convidados: fotos do participante');
select is(public.admin_search_participants_v2(25, 0, 'Evento 34') ->> 'total', '3', 'convidados: busca pelo evento');
select throws_ok($$select public.admin_search_participants_v2(25, 0, null, 'x')$$, 'MM005', null, 'convidados: situação inválida');
select ok(not (public.admin_search_participants_v2(100, 0)::text ~ 'segredo|@'), 'convidados: sem e-mail algum na resposta');
reset role;

-- ===================================================================== convites: estados, SEM token nem hash
select tests.login('00000000-0000-4000-8000-0000000034a3', 'support');
select is(public.admin_search_invites_v2(25, 0) -> 'summary' ->> 'ativos', '1', 'convites: 1 ativo');
select is(public.admin_search_invites_v2(25, 0) -> 'summary' ->> 'expirados', '1', 'convites: 1 expirado');
select is(public.admin_search_invites_v2(25, 0) -> 'summary' ->> 'esgotados', '1', 'convites: 1 esgotado');
select is(public.admin_search_invites_v2(25, 0) -> 'summary' ->> 'revogados', '1', 'convites: 1 revogado');
select is(public.admin_search_invites_v2(25, 0, null, 'revogados') #>> '{items,0,label}', 'Revogado 34', 'convites: filtro Revogados');
select is(public.admin_search_invites_v2(25, 0, null, 'esgotados') #>> '{items,0,state}', 'esgotado', 'convites: filtro Esgotados');
select is(public.admin_search_invites_v2(25, 0, 'Geral') ->> 'total', '1', 'convites: busca pelo rótulo');
select throws_ok($$select public.admin_search_invites_v2(25, 0, null, 'x')$$, 'MM005', null, 'convites: estado inválido');
select ok(not (public.admin_search_invites_v2(100, 0)::text ~* 'hash-secreto|token'), 'convites: a resposta não tem token nem hash');
select is((select count(*)::int from jsonb_object_keys(public.admin_search_invites_v2(100, 0) #> '{items,0}') k where k ~* 'token|hash'), 0, 'convites: nenhum campo de token ou hash');
reset role;

-- ===================================================================== equipe (só master): quem concedeu, quando, último master
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select is(jsonb_array_length(public.admin_list_team() -> 'items'), 3, 'equipe: 3 papéis ativos');
select is((select (i ->> 'installation')::boolean from jsonb_array_elements(public.admin_list_team() -> 'items') i where i ->> 'role' = 'master'), true, 'equipe: papel do provisionamento = "instalação" (sem quem concedeu)');
select is((select (i ->> 'lastMaster')::boolean from jsonb_array_elements(public.admin_list_team() -> 'items') i where i ->> 'role' = 'master'), true, 'equipe: com um master só, ele é o último master');
select is((select (i ->> 'lastMaster')::boolean from jsonb_array_elements(public.admin_list_team() -> 'items') i where i ->> 'role' = 'support'), false, 'equipe: support nunca é "último master"');
reset role;

-- ===================================================================== conceder: motivo de 10 a 500 NO SERVIDOR
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select throws_ok($$select public.admin_grant_platform_role_by_email('novo34@dominio.test', 'support', 'curto')$$, 'MM011', 'reasonrequired', 'conceder: motivo com menos de 10 recusado');
select throws_ok($$select public.admin_grant_platform_role_by_email('novo34@dominio.test', 'support', '         ')$$, 'MM011', 'reasonrequired', 'conceder: motivo só com espaços recusado');
select throws_ok($$select public.admin_grant_platform_role_by_email('novo34@dominio.test', 'support', '   curto   ')$$, 'MM011', 'reasonrequired', 'conceder: espaços não contam para os 10');
select throws_ok($$select public.admin_grant_platform_role_by_email('novo34@dominio.test', 'support', repeat('a', 501))$$, 'MM011', 'reasonrequired', 'conceder: motivo com mais de 500 recusado');
select throws_ok($$select public.admin_grant_platform_role('00000000-0000-4000-8000-0000000034d1', 'support', repeat('a', 501))$$, 'MM011', 'reasonrequired', 'conceder por id: mais de 500 recusado');
select throws_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000034a4', 'auditor', repeat('a', 501))$$, 'MM011', 'reasonrequired', 'revogar: mais de 500 recusado');
select throws_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000034a4', 'auditor', 'curto')$$, 'MM011', 'reasonrequired', 'revogar: menos de 10 recusado');
select is((select count(*)::int from public.platform_roles where revoked_at is null), 3, 'motivos inválidos não mudaram a equipe');
select throws_ok($$select public.admin_grant_platform_role_by_email('naoexiste34@dominio.test', 'support', 'conta que não existe no Revela')$$, 'MM005', 'notfound', 'conceder: e-mail sem conta');
select throws_ok($$select public.admin_grant_platform_role_by_email('', 'support', 'e-mail vazio para conceder')$$, 'MM005', 'invalid', 'conceder: e-mail vazio');
select throws_ok($$select public.admin_grant_platform_role_by_email('novo34@dominio.test', 'root', 'papel que não existe na lista')$$, 'MM005', 'invalid', 'conceder: papel inexistente');
select throws_ok($$select public.admin_grant_platform_role_by_email('support34@dominio.test', 'support', 'já tem esse papel ativo')$$, 'MM005', 'duplicate', 'conceder: papel já ativo');
select lives_ok($$select public.admin_grant_platform_role_by_email('  NOVO34@dominio.test ', 'support', 'exatamente dez')$$, 'conceder: e-mail sem diferenciar maiúsculas, motivo de 14 caracteres');
select lives_ok($$select public.admin_grant_platform_role_by_email('master34b@dominio.test', 'auditor', repeat('b', 500))$$, 'conceder: motivo com exatamente 500 aceito');
reset role;
select is((select count(*)::int from public.platform_roles where revoked_at is null), 5, 'duas concessões feitas');
select is((select granted_by from public.platform_roles where user_id = '00000000-0000-4000-8000-0000000034d1' and revoked_at is null), '00000000-0000-4000-8000-0000000034a1'::uuid, 'quem concedeu fica registrado');
select ok(exists (select 1 from public.audit_logs where action = 'platform_role.granted' and target_id = '00000000-0000-4000-8000-0000000034d1' and reason = 'exatamente dez'), 'concessão na auditoria com o motivo');
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select is((select i ->> 'grantedByEmail' from jsonb_array_elements(public.admin_list_team() -> 'items') i where i ->> 'email' = 'novo34@dominio.test'), 'master34@dominio.test', 'equipe: "concedido por" mostra a conta de quem concedeu');
reset role;

-- ===================================================================== último master não revogável (no servidor)
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select throws_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000034a1', 'master', 'tentando ficar sem nenhum master')$$, 'MM009', null, 'último master não é revogado');
select is((select count(*)::int from public.platform_roles where role = 'master' and revoked_at is null), 1, 'continua 1 master');
select lives_ok($$select public.admin_grant_platform_role_by_email('master34b@dominio.test', 'master', 'segundo master para o teste')$$, 'concede master a outra conta');
select is((select (i ->> 'lastMaster')::boolean from jsonb_array_elements(public.admin_list_team() -> 'items') i where i ->> 'role' = 'master' limit 1), false, 'com dois masters nenhum é o último');
select lives_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000034a2', 'master', 'segundo master desligado')$$, 'revoga um dos dois masters');
select throws_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000034a1', 'master', 'agora ele é o último master')$$, 'MM009', null, 'o que sobrou é o último e não sai');
select is((select (i ->> 'lastMaster')::boolean from jsonb_array_elements(public.admin_list_team() -> 'items') i where i ->> 'role' = 'master'), true, 'a equipe volta a marcar "último master"');
select lives_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000034d1', 'support', 'saiu da equipe de atendimento')$$, 'revoga um support');
reset role;
select ok(exists (select 1 from public.audit_logs where action = 'platform_role.revoked' and target_id = '00000000-0000-4000-8000-0000000034d1' and reason = 'saiu da equipe de atendimento'), 'revogação na auditoria com o motivo');
select ok((select revoked_at is not null from public.platform_roles where user_id = '00000000-0000-4000-8000-0000000034d1' and role = 'support'), 'o histórico fica (revogado, não apagado)');

-- ===================================================================== exportar as abas
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select ok(tests.ex('pessoas', '{"aba":"contas"}') ->> 'csv' like '"conta_id","tipo","email","criado_em","ultimo_acesso_em","papel"%', 'contas: cabeçalho = colunas da tela');
select ok(tests.ex('pessoas', '{"aba":"contas"}') ->> 'csv' ~ 'ana34@dominio.test', 'contas: master exporta o e-mail completo');
select is((tests.ex('pessoas', '{"aba":"contas","f":"equipe"}') ->> 'rows')::int, 4, 'contas: filtro Equipe (4 contas com papel ativo)');
select is((tests.ex('pessoas', '{"aba":"contas","f":"convidados"}') ->> 'rows')::int, 3, 'contas: filtro Convidados');
select is((tests.ex('pessoas', '{"aba":"contas","q":"ana34@dominio"}') ->> 'rows')::int, 1, 'contas: busca da tela');
select ok(tests.ex('pessoas', '{"aba":"organizadores"}') ->> 'csv' ~ '50500', 'organizadores: gasto total somado no servidor');
select ok(tests.ex('pessoas', '{"aba":"organizadores"}') ->> 'csv' like '"nome","email","entrou_com","eventos","ativos","fotos","ultimo_evento_em","gasto_total_centavos","exclusao_pedida"%', 'organizadores: cabeçalho');
select is((tests.ex('pessoas', '{"aba":"convidados","f":"bloqueados"}') ->> 'rows')::int, 1, 'convidados: filtro Bloqueados');
select ok(tests.ex('pessoas', '{"aba":"convidados"}') ->> 'csv' like '"nome","evento","entrou_em","fotos","situacao"%', 'convidados: cabeçalho');
select is((tests.ex('pessoas', '{"aba":"convites","f":"ativos"}') ->> 'rows')::int, 1, 'convites: filtro Ativos');
select is((tests.ex('pessoas', '{"aba":"convites"}') ->> 'rows')::int, 4, 'convites: todos');
select ok(tests.ex('pessoas', '{"aba":"convites"}') ->> 'csv' !~* 'hash-secreto|token', 'convites: o CSV não tem token nem hash');
select throws_ok($$select tests.ex('pessoas', '{"aba":"contas","f":"x"}')$$, 'MM005', null, 'contas: filtro inválido');
select throws_ok($$select tests.ex('pessoas', '{"aba":"convites","f":"x"}')$$, 'MM005', null, 'convites: filtro inválido');
select throws_ok($$select tests.ex('pessoas', '{"aba":"convidados","f":"x"}')$$, 'MM005', null, 'convidados: filtro inválido');
select throws_ok($$select tests.ex('pessoas', '{"aba":"x"}')$$, 'MM005', null, 'aba inválida');
select ok(exists (select 1 from public.audit_logs where action = 'export.csv' and target_id = 'pessoas' and detail -> 'filters' ->> 'aba' = 'convites' and detail -> 'filters' ->> 'f' = 'ativos'), 'a exportação entra na auditoria com a aba e o filtro');
reset role;

select * from finish();
rollback;
