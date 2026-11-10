-- pgTAP · Master M05 "Conciliar agora": só Master com aal2, uma por minuto, auditada.
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
  ('00000000-0000-4000-8000-0000000033c1', 'master33@test.local', false),
  ('00000000-0000-4000-8000-0000000033c2', 'support33@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%33@test.local' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000033c1', 'master'), ('00000000-0000-4000-8000-0000000033c2', 'support');

select tests.login('00000000-0000-4000-8000-0000000033c2', 'support', 'aal2');
select throws_ok($$select public.admin_request_reconcile()$$, 'MM004', null, 'suporte não pede conciliação');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033c1', 'master', 'aal1');
select throws_ok($$select public.admin_request_reconcile()$$, 'MM016', null, 'Master sem segundo fator é recusado');
reset role;
select tests.login('00000000-0000-4000-8000-0000000033c1', 'master', 'aal2');
select ok(public.admin_request_reconcile() ? 'requestedAt', 'Master com aal2 pede a conciliação');
select throws_ok($$select public.admin_request_reconcile()$$, 'MM006', null, 'duas no mesmo minuto: limitado');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'payments.reconcile_requested' and actor_id = '00000000-0000-4000-8000-0000000033c1'), 1, 'o pedido ficou na auditoria');

select * from finish();
rollback;
