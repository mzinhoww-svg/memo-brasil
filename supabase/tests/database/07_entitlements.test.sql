-- pgTAP · COM-001: planos, direitos por evento, plano efetivo e backfill legado.
-- effective_entitlement() é a fonte única de limites; payments_env() decide quais direitos de ambiente valem.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false,
    'app_metadata', case when p_role is null then '{}'::json else json_build_object('role', p_role) end)::text, true);
  set local role authenticated;
end $$;
create function tests.set_env(p_env text) returns void language sql as $$
  update public.platform_settings set value = to_jsonb(p_env) where key = 'payments_env'
$$;
create function tests.ent(p_event uuid) returns table (plan_code text, max_guests int, max_shots int, source text) language sql as $$
  select * from public.effective_entitlement(p_event)
$$;

-- pessoas: a1 anfitrião · a2 outro anfitrião · c1 master
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000006a1', 'authenticated', 'authenticated', 'host6@test.local', false),
  ('00000000-0000-4000-8000-0000000006a2', 'authenticated', 'authenticated', 'outro6@test.local', false),
  ('00000000-0000-4000-8000-0000000006c1', 'authenticated', 'authenticated', 'master6@test.local', false);
insert into public.profiles (id) values
  ('00000000-0000-4000-8000-0000000006a1'), ('00000000-0000-4000-8000-0000000006a2'), ('00000000-0000-4000-8000-0000000006c1')
  on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000006c1', 'master');

-- eventos: e1 legado 200/36 · e2 legado sem limite · e3 novo (sem direito) · e4 de outro anfitrião
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person) values
  ('00000000-0000-4000-8000-0000000006e1', 'Legado', 'casamento', '00000000-0000-4000-8000-0000000006a1', 'H', 6, 200, 36),
  ('00000000-0000-4000-8000-0000000006e2', 'Legado livre', 'festa', '00000000-0000-4000-8000-0000000006a1', 'H', 6, null, null);
-- o backfill da migration roda de novo aqui: simula "eventos que já existiam quando a migration rodou"
select is(public.entitlements_backfill_legacy(), 2, 'backfill cria um direito legado por evento existente');
select is(public.entitlements_backfill_legacy(), 0, 'backfill é idempotente');
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person) values
  ('00000000-0000-4000-8000-0000000006e3', 'Novo', 'festa', '00000000-0000-4000-8000-0000000006a1', 'H', 6, 10, 10),
  ('00000000-0000-4000-8000-0000000006e4', 'Alheio', 'festa', '00000000-0000-4000-8000-0000000006a2', 'H', 6, 10, 10);

-- ===================================================== seed de planos e configurações
select results_eq(
  $$select code, max_guests, max_shots, price_cents, sandbox_active, production_active from public.plans order by sort$$,
  $$values ('gratis', 10, 10, 0, true, true),
           ('festa', 30, 24, 2900, true, true),
           ('celebracao', 100, 24, 8900, true, true),
           ('casamento', 250, 36, 18900, true, true),
           ('grande', 500, null::int, 34900, true, true)$$,
  'seed_prices: os 5 planos aprovados, ativos nos dois ambientes');
select is((select is_free from public.plans where code = 'gratis'), true, 'gratis é o plano grátis');
select is((select count(*)::int from public.plans where is_free), 1, 'só um plano grátis');
select is((select value from public.platform_settings where key = 'payments_env'), '"desligado"'::jsonb, 'payments_env nasce desligado');
select is((select value from public.platform_settings where key = 'capacity_grace_pct'), '10'::jsonb, 'capacity_grace_pct = 10');
select is((select count(*)::int from public.platform_settings
           where key in ('support_email', 'support_phone', 'company_legal_name', 'company_cnpj') and value = 'null'::jsonb), 4,
          'contatos e dados da empresa nascem null');
select is(public.payments_env(), 'desligado', 'payments_env() = desligado');

-- ===================================================== backfill legado e plano grátis
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e1')$$,
  $$values ('gratis', 200, 36, 'legado')$$, 'legacy_events_keep_limits: legado mantém 200/36');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e2')$$,
  $$values ('gratis', null::int, null::int, 'legado')$$, 'legado com capacity null continua sem limite');
select is((select count(*)::int from public.event_entitlements
           where event_id = '00000000-0000-4000-8000-0000000006e1' and source = 'legado' and env = 'nenhum' and status = 'ativo'), 1,
          'direito legado é nenhum/ativo');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e3')$$,
  $$values ('gratis', 10, 10, 'gratis')$$, 'free_default: evento novo sem direito usa o grátis');
select results_eq($$select * from tests.ent(gen_random_uuid())$$,
  $$values ('gratis', 10, 10, 'gratis')$$, 'evento inexistente também cai no grátis');

-- ===================================================== ambiente de pagamentos
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env) values
  ('00000000-0000-4000-8000-0000000006e3', 'casamento', 250, 36, 'pago', 'sandbox');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e3')$$,
  $$values ('gratis', 10, 10, 'gratis')$$, 'sandbox_ignored_when_off: pago sandbox não vale com pagamentos desligados');
select tests.set_env('sandbox');
select is(public.payments_env(), 'sandbox', 'payments_env() = sandbox');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e3')$$,
  $$values ('casamento', 250, 36, 'pago')$$, 'com payments_env=sandbox o direito sandbox vale');
select tests.set_env('production');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e3')$$,
  $$values ('gratis', 10, 10, 'gratis')$$, 'direito sandbox não vale em produção');
select tests.set_env('qualquer');
select is(public.payments_env(), 'desligado', 'valor desconhecido em payments_env equivale a desligado');

-- cortesia (env nenhum) vale em qualquer ambiente
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, reason) values
  ('00000000-0000-4000-8000-0000000006e4', 'festa', 30, 24, 'cortesia', 'nenhum', 'cortesia de teste');
select tests.set_env('desligado');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e4')$$,
  $$values ('festa', 30, 24, 'cortesia')$$, 'cortesia vale com pagamentos desligados');
select tests.set_env('sandbox');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e4')$$,
  $$values ('festa', 30, 24, 'cortesia')$$, 'cortesia vale em sandbox');
select tests.set_env('production');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e4')$$,
  $$values ('festa', 30, 24, 'cortesia')$$, 'cortesia vale em produção');

-- combinação: maior valor vence, null (sem limite) vence; plano/origem do direito de maior plano
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env) values
  ('00000000-0000-4000-8000-0000000006e1', 'grande', 500, null, 'pago', 'production');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e1')$$,
  $$values ('grande', 500, null::int, 'pago')$$, 'maior capacidade vence e fotos null (sem limite) vence');
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, status) values
  ('00000000-0000-4000-8000-0000000006e4', 'grande', 500, null, 'pago', 'nenhum', 'estornado'),
  ('00000000-0000-4000-8000-0000000006e4', 'grande', 500, null, 'cortesia', 'nenhum', 'revogado');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e4')$$,
  $$values ('festa', 30, 24, 'cortesia')$$, 'direitos estornados/revogados não contam');
select tests.set_env('desligado');

-- ===================================================== RLS e privilégios
select tests.login('00000000-0000-4000-8000-0000000006a2');
select is((select count(*)::int from public.event_entitlements where event_id = '00000000-0000-4000-8000-0000000006e1'), 0,
          'organizador não lê direitos de evento alheio');
select is((select count(*)::int from public.event_entitlements where event_id = '00000000-0000-4000-8000-0000000006e4'), 3,
          'organizador lê os direitos do próprio evento');
select throws_ok($$insert into public.event_entitlements (event_id, plan_code, source, env) values ('00000000-0000-4000-8000-0000000006e4', 'grande', 'cortesia', 'nenhum')$$,
  '42501', null, 'organizador não insere direito');
select throws_ok($$update public.event_entitlements set max_guests = 1000 where event_id = '00000000-0000-4000-8000-0000000006e4'$$,
  '42501', null, 'organizador não altera direito');
select throws_ok($$delete from public.event_entitlements where event_id = '00000000-0000-4000-8000-0000000006e4'$$,
  '42501', null, 'organizador não apaga direito');
select throws_ok($$select count(*) from public.plans$$, '42501', null, 'authenticated não lê plans direto');
select throws_ok($$update public.plans set price_cents = 0$$, '42501', null, 'authenticated não altera plans');
select results_eq($$select * from public.effective_entitlement('00000000-0000-4000-8000-0000000006e4')$$,
  $$values ('festa', 30, 24, 'cortesia')$$, 'authenticated executa effective_entitlement (guards de invocador)');
select is(public.payments_env(), 'desligado', 'authenticated executa payments_env');
select throws_ok($$select public.entitlements_backfill_legacy()$$, '42501', null, 'authenticated não roda o backfill');
reset role;

select tests.login('00000000-0000-4000-8000-0000000006c1', 'master');
select is((select count(*)::int from public.event_entitlements
           where event_id in ('00000000-0000-4000-8000-0000000006e1', '00000000-0000-4000-8000-0000000006e4')), 5,
          'master lê direitos de qualquer evento');
select throws_ok($$insert into public.event_entitlements (event_id, plan_code, source, env) values ('00000000-0000-4000-8000-0000000006e4', 'grande', 'cortesia', 'nenhum')$$,
  '42501', null, 'nem o master insere direto (só por RPC)');
reset role;

set local role anon;
select throws_ok($$select count(*) from public.plans$$, '42501', null, 'anon não lê plans direto');
select throws_ok($$select count(*) from public.event_entitlements$$, '42501', null, 'anon não lê direitos');
select throws_ok($$select * from public.effective_entitlement('00000000-0000-4000-8000-0000000006e1')$$, '42501', null, 'anon não executa effective_entitlement');
select throws_ok($$select public.payments_env()$$, '42501', null, 'anon não executa payments_env');
reset role;

-- integridade
select throws_ok($$insert into public.event_entitlements (event_id, plan_code, source, env) values ('00000000-0000-4000-8000-0000000006e1', 'gratis', 'brinde', 'nenhum')$$,
  '23514', null, 'source fora da lista é recusado');
select throws_ok($$insert into public.event_entitlements (event_id, plan_code, source, env) values ('00000000-0000-4000-8000-0000000006e1', 'inexistente', 'cortesia', 'nenhum')$$,
  '23503', null, 'plan_code precisa existir');
select throws_ok($$insert into public.plans (code, name, price_cents, sort) values ('x', 'X', -1, 9)$$, '23514', null, 'preço negativo é recusado');
delete from public.events where id = '00000000-0000-4000-8000-0000000006e2';
select is((select count(*)::int from public.event_entitlements where event_id = '00000000-0000-4000-8000-0000000006e2'), 0,
          'apagar o evento apaga seus direitos');


-- ===================================================== backfill ignora evento apagado
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, deleted_at) values
  ('00000000-0000-4000-8000-0000000006e5', 'Apagado', 'festa', '00000000-0000-4000-8000-0000000006a1', 'H', 6, 50, 20, now());
select is(public.entitlements_backfill_legacy(), 2, 'backfill pula evento apagado (só e3/e4, vivos e sem legado)');
select is((select count(*)::int from public.event_entitlements where event_id = '00000000-0000-4000-8000-0000000006e5'), 0,
          'evento apagado não recebe direito legado');

-- ===================================================== plano grátis protegido e direito efetivo nunca vazio
select throws_ok($$delete from public.plans where code = 'gratis'$$, 'MM005', 'gratisprotected', 'não apaga o plano grátis');
select throws_ok($$update public.plans set code = 'free' where code = 'gratis'$$, 'MM005', 'gratisprotected', 'não renomeia o plano grátis');
select lives_ok($$update public.plans set name = 'Grátis' where code = 'gratis'$$, 'outros campos do grátis seguem editáveis');
-- sem o grátis (proteção contornada desligando triggers/FKs só nesta transação), a função falha fechada em vez de devolver vazio
set local session_replication_role = replica;
delete from public.plans where code = 'gratis';
set local session_replication_role = origin;
select is((select count(*)::int from public.plans where code = 'gratis'), 0, 'cenário: grátis ausente');
select throws_ok($$select * from public.effective_entitlement(gen_random_uuid())$$, 'MM090', 'entitlementunavailable',
  'sem direito e sem grátis: erro, nunca zero linhas (zero seria lido como sem limite)');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000006e4')$$,
  $$values ('festa', 30, 24, 'cortesia')$$, 'com direito válido continua devolvendo uma linha');

select * from finish();
rollback;
