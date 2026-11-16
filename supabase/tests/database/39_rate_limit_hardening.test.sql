-- pgTAP · endurecimento dos limites (S2 join_event, S3 peek_code, S4 admin_set_plan, S6 descadastro, S7 janela, S8 trilha).
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_aal text default 'aal1', p_master boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', p_aal,
    'app_metadata', case when p_master then json_build_object('role', 'master') else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000039a1', 'authenticated', 'authenticated', 'host39@test.local', false),
  ('00000000-0000-4000-8000-0000000039b1', 'authenticated', 'authenticated', 'g39@test.local', false),
  ('00000000-0000-4000-8000-0000000039c1', 'authenticated', 'authenticated', 'master39@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%39@test.local' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000039c1', 'master');
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person) values
  ('00000000-0000-4000-8000-0000000039e1', 'Evento 39', 'festa', '00000000-0000-4000-8000-0000000039a1', 'Host', 6, 20, 10);

-- ===================================================== S7: janela do limite
select tests.login('00000000-0000-4000-8000-0000000039c1', 'aal2', true);
select lives_ok($$select public.admin_request_reconcile()$$, 'S7: 1ª conciliação passa');
select throws_ok($$select public.admin_request_reconcile()$$, 'MM006', null, 'S7: a 2ª dentro do minuto é limitada');
reset role;
update public.rate_limits set window_start = now() - interval '2 minutes' where key = 'reconcile:00000000-0000-4000-8000-0000000039c1';
select tests.login('00000000-0000-4000-8000-0000000039c1', 'aal2', true);
select lives_ok($$select public.admin_request_reconcile()$$, 'S7: passada a janela a conciliação volta a funcionar');
reset role;
select is((select hits from public.rate_limits where key = 'reconcile:00000000-0000-4000-8000-0000000039c1'), 1, 'S7: a janela reiniciou com 1 chamada');

-- ===================================================== S2: tentativas de código inválido persistem
select tests.login('00000000-0000-4000-8000-0000000039b1');
select is(public.join_event('ZZZZZZZZ', 'Bia')->>'error', 'MM005', 'S2: código desconhecido devolve MM005 (sem raise)');
select lives_ok($$select public.join_event('ZZZZZZZZ', 'Bia') from generate_series(1, 6)$$, 'S2: tentativas 2 a 7 continuam devolvendo erro');
reset role;
select is((select hits from public.rate_limits where key = 'badcode:00000000-0000-4000-8000-0000000039b1'), 7, 'S2: o contador de tentativas persistiu');
select tests.login('00000000-0000-4000-8000-0000000039b1');
select is(public.join_event('ZZZZZZZZ', 'Bia')->>'error', 'MM005', 'S2: 8ª tentativa ainda no limite');
select is(public.join_event('ZZZZZZZZ', 'Bia')->>'error', 'MM006', 'S2: 9ª tentativa: limitado (MM006)');
reset role;

-- ===================================================== S3: peek_code com limite persistente
insert into public.courtesy_codes (code_hash, code_hint, plan_code, max_uses, uses, expires_at, note, created_by) values
  (public.courtesy_code_hash('MMT-AAAA-3939'), 'MMT-AAAA', (select code from public.plans where not is_free and pack_of is null order by price_cents limit 1), 1, 0, now() + interval '3 days', 'presente de teste', gen_random_uuid());
set local role anon;
select is(public.peek_code('MMT-AAAA-3939')->>'status', 'ativo', 'S3: código válido responde antes de qualquer abuso');
select lives_ok($$select public.peek_code('MMT-ZZZZ-' || lpad(g::text, 4, '0')) from generate_series(1, 10) g$$, 'S3: 10 palpites inválidos respondem normalmente');
select is(public.peek_code('MMT-ZZZZ-9999')->>'status', 'muitas_tentativas', 'S3: o 11º palpite é barrado');
select is(public.peek_code('MMT-AAAA-3939')->>'status', 'muitas_tentativas', 'S3: bloqueado, nem o código válido vaza');
reset role;
select ok((select hits from public.rate_limits where key = 'peekbad:anon') >= 10, 'S3: o contador persistiu (não houve raise)');

-- ===================================================== S6: descadastro limitado por token, não global
insert into public.rate_limits (key, hits) values ('optout:11111111-1111-4111-8111-111111111111', 999);
set local role anon;
select throws_ok($$select public.email_opt_out('11111111-1111-4111-8111-111111111111')$$, 'MM006', null, 'S6: token esgotado é limitado');
select lives_ok($$select public.email_opt_out('22222222-2222-4222-8222-222222222222')$$, 'S6: outro token não é afetado');
reset role;

-- ===================================================== S4: preço do catálogo exige aal2
select tests.login('00000000-0000-4000-8000-0000000039c1', 'aal1', true);
select throws_ok($$select public.admin_set_plan('casamento', 19900, true, true, 'motivo longo o bastante')$$, 'MM016', null, 'S4: Master sem segundo fator não muda preço');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039c1', 'aal2', true);
select lives_ok($$select public.admin_set_plan('casamento', 19900, true, true, 'motivo longo o bastante')$$, 'S4: com aal2 muda');
reset role;

-- ===================================================== S8 (revertido por decisão de produto): o organizador continua vendo o acesso do Master ao próprio evento
insert into public.audit_logs (actor_id, actor_role, event_id, action, reason, detail) values
  ('00000000-0000-4000-8000-0000000039c1', 'master', '00000000-0000-4000-8000-0000000039e1', 'event.adjusted', 'segredo da equipe', '{}'),
  (null, null, '00000000-0000-4000-8000-0000000039e1', 'photo.added', null, '{}');
select tests.login('00000000-0000-4000-8000-0000000039a1');
select is((select count(*)::int from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000039e1' and action = 'event.adjusted'), 1, 'S8: o organizador enxerga a ação do Master no próprio evento (transparência)');
select ok((select count(*) from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000039e1' and action = 'photo.added') = 1, 'S8: e o que é do próprio evento');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039c1', 'aal2', true);
select is((select count(*)::int from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000039e1' and action = 'event.adjusted'), 1, 'S8: o Master continua vendo');
reset role;

select * from finish();
rollback;
