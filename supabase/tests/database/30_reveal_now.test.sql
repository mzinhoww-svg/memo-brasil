-- pgTAP · reveal_now: um caminho só para "Revelar agora" (anfitrião 17c e Master M08). Quem pode, quem não pode, auditoria e e-mail uma vez.
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

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-000000003001', 'authenticated', 'authenticated', 'host30@test.local', false),
  ('00000000-0000-4000-8000-000000003002', 'authenticated', 'authenticated', 'other30@test.local', false),
  ('00000000-0000-4000-8000-000000003003', 'authenticated', 'authenticated', 'guest30@test.local', false),
  ('00000000-0000-4000-8000-000000003004', 'authenticated', 'authenticated', 'master30@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%30@test.local' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-000000003004', 'master');

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_anchor) values
  ('00000000-0000-4000-8000-0000000030e1', 'Reveal 30 a', 'outro', '00000000-0000-4000-8000-000000003001', 'Host 30', 6, 20, 10, true, 'fim'),
  ('00000000-0000-4000-8000-0000000030e2', 'Reveal 30 b', 'outro', '00000000-0000-4000-8000-000000003001', 'Host 30', 6, 20, 10, true, 'fim'),
  ('00000000-0000-4000-8000-0000000030e3', 'Reveal 30 sem revelação', 'outro', '00000000-0000-4000-8000-000000003001', 'Host 30', 6, 20, 10, false, 'fim'),
  ('00000000-0000-4000-8000-0000000030e4', 'Reveal 30 excluido', 'outro', '00000000-0000-4000-8000-000000003001', 'Host 30', 6, 20, 10, true, 'fim');
update public.events set deleted_at = now() where id = '00000000-0000-4000-8000-0000000030e4';
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000030e1', '00000000-0000-4000-8000-000000003003', 'Ana 30'),
  ('00000000-0000-4000-8000-0000000030e2', '00000000-0000-4000-8000-000000003003', 'Ana 30');
insert into public.participant_emails (event_id, user_id, email, consent_at) values
  ('00000000-0000-4000-8000-0000000030e1', '00000000-0000-4000-8000-000000003003', 'ana30@test.local', now()),
  ('00000000-0000-4000-8000-0000000030e2', '00000000-0000-4000-8000-000000003003', 'ana30@test.local', now());

-- recusas
select tests.login('00000000-0000-4000-8000-000000003003');
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000030e1')$$, 'MM004', null, 'convidado não revela');
reset role;
select tests.login('00000000-0000-4000-8000-000000003002');
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000030e1')$$, 'MM004', null, 'outro anfitrião não revela evento alheio');
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000030ff')$$, 'MM004', null, 'evento inexistente não vaza a existência para quem não é do evento');
reset role;
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000030e1')$$, 'MM004', null, 'sem sessão é recusado');
select tests.login('00000000-0000-4000-8000-000000003001');
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000030e3')$$, 'MM005', null, 'sem revelação ligada é recusado');
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000030e4')$$, 'MM005', null, 'evento excluído é recusado');
select is((select count(*)::int from public.events where revealed_at is not null and title like 'Reveal 30%'), 0, 'nada foi revelado até aqui');

-- anfitrião revela (motivo opcional)
select is((public.reveal_now('00000000-0000-4000-8000-0000000030e1') ->> 'ok')::boolean, true, 'anfitrião revela o próprio evento sem motivo');
reset role;
select ok((select revealed_at is not null and reveal_status = 'revelada' from public.events where id = '00000000-0000-4000-8000-0000000030e1'), 'evento ficou revelado');
select is((select count(*)::int from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000030e1' and action = 'reveal.released'), 1, 'reveal.released gravado uma vez (sem ator: efeito do sistema)');
select is((select actor_role from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000030e1' and action = 'reveal.now'), 'organizador', 'auditoria do pedido com ator organizador');
select is((select actor_id from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000030e1' and action = 'reveal.now'), '00000000-0000-4000-8000-000000003001'::uuid, 'ator é o anfitrião');
select is((select count(*)::int from public.reveal_email_queue where event_id = '00000000-0000-4000-8000-0000000030e1'), 1, 'e-mail de quem consentiu enfileirado');

-- já revelado: recusa e nada duplica
select tests.login('00000000-0000-4000-8000-000000003001');
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000030e1')$$, 'MM008', null, 'já revelado é recusado');
reset role;
select tests.login('00000000-0000-4000-8000-000000003004', true);
select throws_ok($$select public.admin_reveal_now('00000000-0000-4000-8000-0000000030e1', 'motivo suficiente aqui')$$, 'MM008', null, 'master também não revela de novo');
reset role;
select is((select count(*)::int from public.reveal_email_queue where event_id = '00000000-0000-4000-8000-0000000030e1'), 1, 'e-mail enfileirado uma vez só');
select is((select count(*)::int from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000030e1' and action in ('reveal.released', 'reveal.now', 'admin.reveal_now')), 2, 'sem auditoria duplicada');

-- master: motivo obrigatório; mesmo caminho
select tests.login('00000000-0000-4000-8000-000000003004', true);
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000030e2')$$, 'MM011', null, 'master sem motivo é recusado');
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000030e2', 'curto')$$, 'MM011', null, 'motivo curto é recusado');
select throws_ok($$select public.reveal_now('00000000-0000-4000-8000-0000000030ff', 'motivo suficiente aqui')$$, 'MM005', null, 'master: evento inexistente é inválido');
select is((public.admin_reveal_now('00000000-0000-4000-8000-0000000030e2', 'Pedido do anfitrião por e-mail') ->> 'ok')::boolean, true, 'admin_reveal_now delega e revela');
reset role;
select is((select actor_role from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000030e2' and action = 'admin.reveal_now'), 'master', 'auditoria do master com ator master');
select is((select reason from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000030e2' and action = 'admin.reveal_now'), 'Pedido do anfitrião por e-mail', 'motivo gravado');
select is((select count(*)::int from public.reveal_email_queue where event_id = '00000000-0000-4000-8000-0000000030e2'), 1, 'e-mail enfileirado pelo caminho do master');
select is((select count(*)::int from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000030e2' and action = 'reveal.now'), 0, 'master não grava a trilha de organizador');

-- admin_reveal_now continua só do master
select tests.login('00000000-0000-4000-8000-000000003001');
select throws_ok($$select public.admin_reveal_now('00000000-0000-4000-8000-0000000030e3', 'motivo suficiente aqui')$$, 'MM004', null, 'anfitrião não usa admin_reveal_now');
reset role;

select * from finish();
rollback;
