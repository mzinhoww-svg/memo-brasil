-- pgTAP · consulta semanal (Master e bot): contagens por semana de criação do evento, só equipe, sem contas excluídas; o bot lê
-- conversao_semanal e conversao_origem pelo MCP (somente leitura).
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_master boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal2',
    'app_metadata', case when p_master then json_build_object('role', 'master') else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000050a1', 'authenticated', 'authenticated', 'host50@test.local', false),
  ('00000000-0000-4000-8000-0000000050a2', 'authenticated', 'authenticated', 'dono50@test.local', false),
  ('00000000-0000-4000-8000-0000000050c1', 'authenticated', 'authenticated', 'conv50@test.local', false),
  ('00000000-0000-4000-8000-0000000050f1', 'authenticated', 'authenticated', 'staff50@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%50@test.local' on conflict do nothing;
select set_config('mm.audit_reason', 'teste 50', true);
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000050f1', 'master');
update public.platform_settings set value = '["00000000-0000-4000-8000-0000000050a2"]'::jsonb where key = 'metrics_excluded_hosts';
select public.host_whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000050a1', '5565900001111', now());

insert into public.events (id, title, category, host_id, host_name, duration_hours, start_at) values
  ('00000000-0000-4000-8000-0000000050e1', 'Com convidado', 'festa', '00000000-0000-4000-8000-0000000050a1', 'H', 6, now() + interval '3 days'),
  ('00000000-0000-4000-8000-0000000050e2', 'Vazio', 'festa', '00000000-0000-4000-8000-0000000050a1', 'H', 6, now() + interval '3 days'),
  ('00000000-0000-4000-8000-0000000050e3', 'Do dono', 'festa', '00000000-0000-4000-8000-0000000050a2', 'H', 6, now() + interval '3 days');
insert into public.participants (event_id, user_id, name) values ('00000000-0000-4000-8000-0000000050e1', '00000000-0000-4000-8000-0000000050c1', 'Conv');
insert into public.payment_orders (event_id, host_id, plan_code, amount_cents, status, provider, provider_env, idempotency_key) values
  ('00000000-0000-4000-8000-0000000050e2', '00000000-0000-4000-8000-0000000050a1', 'ate150', 14700, 'expirado', 'validapay', 'production', gen_random_uuid());

select tests.login('00000000-0000-4000-8000-0000000050a1');
select throws_ok($$select public.admin_conversion_weekly(4)$$, 'MM004', null, 'anfitrião não lê a consulta semanal');
reset role;

select tests.login('00000000-0000-4000-8000-0000000050f1', true);
select is(jsonb_array_length(public.admin_conversion_weekly(4) -> 'rows') between 4 and 5, true, '4 semanas (a corrente incluída)');
select is((public.admin_conversion_weekly(4) -> 'rows' -> 0) - 'week',
          '{"events":2,"activated":1,"hosts":1,"hostsWhatsapp":1,"atLimit":0,"offersCreated":0,"offersOpened":0,"offersPaid":0,"paid":0,"orders":1,"ordersExpired":1}'::jsonb,
          'semana corrente: 2 eventos (conta do dono fora), 1 com convidado, anfitrião com avisos, 1 pedido expirado');
reset role;

-- bot: as duas ferramentas novas estão na lista fechada e respondem
select ok('conversao_semanal' = any (public.mcp_tools()) and 'conversao_origem' = any (public.mcp_tools()), 'ferramentas novas no catálogo do bot');
select public.mcp_issue_token('teste50') as tok \gset
set local role anon;
select ok(public.mcp_read(:'tok', 'conversao_semanal', '{"semanas": 2}') ? 'rows', 'bot lê conversao_semanal');
select ok(public.mcp_read(:'tok', 'conversao_origem', '{"dias": 7}') ? 'rowsLast', 'bot lê conversao_origem');
reset role;

select * from finish();
rollback;
