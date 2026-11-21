-- pgTAP · atribuição: origem do primeiro toque gravada no evento (só o anfitrião, só uma vez, saneada), copiada para o pedido,
-- e o relatório "Conversão por origem" do Master (sem equipe, sem teste, sem as contas do dono listadas).
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
  ('00000000-0000-4000-8000-0000000049a1', 'authenticated', 'authenticated', 'host49@test.local', false),
  ('00000000-0000-4000-8000-0000000049a2', 'authenticated', 'authenticated', 'outro49@test.local', false),
  ('00000000-0000-4000-8000-0000000049a3', 'authenticated', 'authenticated', 'dono49@test.local', false),
  ('00000000-0000-4000-8000-0000000049f1', 'authenticated', 'authenticated', 'staff49@test.local', false),
  ('00000000-0000-4000-8000-0000000049c1', 'authenticated', 'authenticated', 'conv49@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%49@test.local' on conflict do nothing;
select set_config('mm.audit_reason', 'teste 49', true);
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000049f1', 'master');
update public.platform_settings set value = '["00000000-0000-4000-8000-0000000049a3"]'::jsonb where key = 'metrics_excluded_hosts';

insert into public.events (id, title, category, host_id, host_name, duration_hours, start_at) values
  ('00000000-0000-4000-8000-0000000049e1', 'Do Instagram', 'festa', '00000000-0000-4000-8000-0000000049a1', 'H', 6, now() + interval '5 days'),
  ('00000000-0000-4000-8000-0000000049e2', 'Sem origem', 'festa', '00000000-0000-4000-8000-0000000049a1', 'H', 6, now() + interval '5 days'),
  ('00000000-0000-4000-8000-0000000049e3', 'Do dono', 'festa', '00000000-0000-4000-8000-0000000049a3', 'H', 6, now() + interval '5 days'),
  ('00000000-0000-4000-8000-0000000049e4', 'Da equipe', 'festa', '00000000-0000-4000-8000-0000000049f1', 'H', 6, now() + interval '5 days');

-- ===================================================== gravação pelo anfitrião
select ok(not has_function_privilege('anon', 'public.set_event_origin(uuid, text, text, text, text, text, text)', 'execute'), 'anon não grava origem');
select tests.login('00000000-0000-4000-8000-0000000049a2');
select throws_ok($$select public.set_event_origin('00000000-0000-4000-8000-0000000049e1', 'X', 'social', null)$$, 'MM004', null, 'outra pessoa não grava');
reset role;
select tests.login('00000000-0000-4000-8000-0000000049a1');
select public.set_event_origin('00000000-0000-4000-8000-0000000049e1', ' Instagram<script> ', 'social', 'lancamento', 'YouTube', 'video', 'canal');
select public.set_event_origin('00000000-0000-4000-8000-0000000049e1', 'Google', 'orgânico', null); -- segunda vez: ignorada
select public.set_event_origin('00000000-0000-4000-8000-0000000049e2', null, null, null);
reset role;
select is((select origin_source || '|' || origin_medium || '|' || origin_campaign from public.events where id = '00000000-0000-4000-8000-0000000049e1'),
          'Instagramscript|social|lancamento', 'gravada saneada, só a primeira vez');
select is((select last_source || '|' || last_medium || '|' || last_campaign from public.events where id = '00000000-0000-4000-8000-0000000049e1'),
          'YouTube|video|canal', 'último toque gravado junto');
select is((select coalesce(origin_source, '-') || '|' || origin_medium || '|' || last_medium from public.events where id = '00000000-0000-4000-8000-0000000049e2'),
          '-|direto|direto', 'sem origem: direto (primeiro e último)');

-- ===================================================== pedido herda a origem do evento
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, idempotency_key)
values ('00000000-0000-4000-8000-0000000049d1', '00000000-0000-4000-8000-0000000049e1', '00000000-0000-4000-8000-0000000049a1', 'ate150', 14700, 'pendente', 'validapay', 'production', gen_random_uuid());
update public.payment_orders set status = 'pago', paid_at = now() where id = '00000000-0000-4000-8000-0000000049d1';
select is((select origin_source || '|' || origin_campaign from public.payment_orders where id = '00000000-0000-4000-8000-0000000049d1'),
          'Instagramscript|lancamento', 'pedido com a origem do evento');
select is((select last_source from public.payment_orders where id = '00000000-0000-4000-8000-0000000049d1'), 'YouTube', 'pedido com o último toque');

-- convidado no evento do Instagram (ativação)
insert into public.participants (event_id, user_id, name) values ('00000000-0000-4000-8000-0000000049e1', '00000000-0000-4000-8000-0000000049c1', 'Conv');

-- ===================================================== relatório do Master
select tests.login('00000000-0000-4000-8000-0000000049a1');
select throws_ok($$select public.admin_conversion_by_origin(30)$$, 'MM004', null, 'anfitrião não lê o relatório');
reset role;
select tests.login('00000000-0000-4000-8000-0000000049f1', true);
select is((select r from jsonb_array_elements(public.admin_conversion_by_origin(30) -> 'rows') r where r ->> 'source' = 'Instagramscript'),
          '{"source":"Instagramscript","medium":"social","campaign":"lancamento","events":1,"activated":1,"paid":1,"revenueCents":14700}'::jsonb,
          'linha da origem: 1 evento, com convidado, pago, R$ 147');
select is((select (r ->> 'events')::int from jsonb_array_elements(public.admin_conversion_by_origin(30) -> 'rows') r where r ->> 'source' = 'Direto'), 1, 'direto conta');
select is((select (r ->> 'paid')::int from jsonb_array_elements(public.admin_conversion_by_origin(30) -> 'rowsLast') r where r ->> 'source' = 'YouTube'), 1, 'visão pelo último toque');
reset role;
select ok(not exists (select 1 from public.events e where e.id in ('00000000-0000-4000-8000-0000000049e3', '00000000-0000-4000-8000-0000000049e4')
            and public.metrics_counts_host(e.host_id)), 'conta do dono e equipe ficam fora das métricas');

select * from finish();
rollback;
