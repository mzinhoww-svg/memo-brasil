-- pgTAP · COM-007 (mínimo): Master de pagamentos, cortesia auditada, catálogo de planos, configuração pública e o job
-- de conciliação. RPCs do Master exigem is_master() e motivo de 10 a 500 caracteres.
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
grant usage on schema tests to authenticated, service_role, anon;
grant execute on all functions in schema tests to authenticated, service_role, anon;

-- pessoas: h1 anfitrião · h2 outro · m1 master
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000009a1', 'authenticated', 'authenticated', 'host9@test.local', false),
  ('00000000-0000-4000-8000-0000000009a2', 'authenticated', 'authenticated', 'outro9@test.local', false),
  ('00000000-0000-4000-8000-0000000009c1', 'authenticated', 'authenticated', 'master9@test.local', false);
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000009%' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000009c1', 'master');

-- Estes testes cobrem o Master sobre pedidos HISTÓRICOS da AbacatePay (provider_charge_id): na transação, o padrão do provedor volta a ser
-- 'abacatepay' para os inserts diretos (a migration 20261023000100 muda o padrão para 'mercadopago'; o Master dos pedidos MP está em 11_).
alter table public.payment_orders alter column provider set default 'abacatepay';

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, start_at) values
  ('00000000-0000-4000-8000-0000000009e1', 'Cortesia', 'festa', '00000000-0000-4000-8000-0000000009a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000009e2', 'Pix aberto', 'festa', '00000000-0000-4000-8000-0000000009a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000009e3', 'Cotação', 'festa', '00000000-0000-4000-8000-0000000009a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000009e4', 'Divergências', 'festa', '00000000-0000-4000-8000-0000000009a1', 'H', 6, 10, 10, now());

-- ===================================================== estrutura e privilégios
select has_function('public', 'admin_list_payments', array['text', 'integer'], 'admin_list_payments existe');
select has_function('public', 'admin_payments_summary', array[]::text[], 'admin_payments_summary existe');
select has_function('public', 'admin_payment_divergences', array[]::text[], 'admin_payment_divergences existe');
select has_function('public', 'admin_grant_courtesy', array['uuid', 'text', 'text'], 'admin_grant_courtesy existe');
select has_function('public', 'admin_request_refund', array['uuid', 'text'], 'admin_request_refund existe');
select has_function('public', 'admin_set_plan', array['text', 'integer', 'boolean', 'boolean', 'text'], 'admin_set_plan existe');
select has_function('public', 'admin_list_plans', array[]::text[], 'admin_list_plans existe');
select has_function('public', 'get_public_settings', array[]::text[], 'get_public_settings existe');
select has_function('public', 'list_public_plans', array[]::text[], 'list_public_plans existe');
select ok(has_function_privilege('anon', 'public.get_public_settings()', 'execute'), 'anon executa get_public_settings');
select ok(has_function_privilege('anon', 'public.list_public_plans()', 'execute'), 'anon executa list_public_plans');
select ok(not has_function_privilege('anon', 'public.admin_set_plan(text, int, boolean, boolean, text)', 'execute'), 'anon não executa admin_set_plan');
select ok(not has_function_privilege('anon', 'public.admin_grant_courtesy(uuid, text, text)', 'execute'), 'anon não executa admin_grant_courtesy');
select ok(not has_function_privilege('authenticated', 'public.payments_schedule_reconcile()', 'execute'), 'cliente não agenda o job');
select ok(not has_function_privilege('service_role', 'public.payments_schedule_reconcile()', 'execute'), 'service_role não agenda o job');

-- ===================================================== cortesia
select tests.login('00000000-0000-4000-8000-0000000009a1');
select throws_ok($$select public.admin_grant_courtesy('00000000-0000-4000-8000-0000000009e1', 'casamento', 'motivo longo o bastante')$$,
  'MM004', 'forbidden', 'não-master concede cortesia: MM004');
select throws_ok($$select public.admin_request_refund(gen_random_uuid(), 'motivo longo o bastante')$$, 'MM004', 'forbidden', 'não-master pede reembolso: MM004');
select throws_ok($$select public.admin_set_plan('festa', 3000, true, true, 'motivo longo o bastante')$$, 'MM004', 'forbidden', 'não-master altera plano: MM004');
select throws_ok($$select * from public.admin_list_plans()$$, 'MM004', 'forbidden', 'admin_list_plans só para o Master');
select throws_ok($$select * from public.admin_list_payments()$$, 'MM004', 'forbidden', 'admin_list_payments só para o Master');
select throws_ok($$select * from public.admin_payment_divergences()$$, 'MM004', 'forbidden', 'admin_payment_divergences só para o Master');
select throws_ok($$select public.admin_payments_summary()$$, 'MM004', 'forbidden', 'admin_payments_summary só para o Master');
reset role;

select tests.login('00000000-0000-4000-8000-0000000009c1', 'master');
select throws_ok($$select public.admin_grant_courtesy('00000000-0000-4000-8000-0000000009e1', 'casamento', 'curto')$$,
  'MM011', 'reasonrequired', 'motivo curto: MM011');
select throws_ok(format('select public.admin_grant_courtesy(%L, %L, %L)', '00000000-0000-4000-8000-0000000009e1', 'casamento', repeat('x', 501)),
  'MM011', 'reasonrequired', 'motivo acima de 500: MM011');
select throws_ok($$select public.admin_grant_courtesy('00000000-0000-4000-8000-0000000009e1', 'gratis', 'motivo longo o bastante')$$,
  'MM005', null, 'cortesia do plano grátis: MM005');
select throws_ok($$select public.admin_grant_courtesy('00000000-0000-4000-8000-0000000009e1', 'inexistente', 'motivo longo o bastante')$$,
  'MM005', null, 'cortesia de plano desconhecido: MM005');
select throws_ok($$select public.admin_grant_courtesy(gen_random_uuid(), 'casamento', 'motivo longo o bastante')$$,
  'MM005', null, 'cortesia em evento inexistente: MM005');

select public.admin_grant_courtesy('00000000-0000-4000-8000-0000000009e1', 'casamento', '  Parceria com o cerimonial  ') as ent1 \gset
reset role;
select is((select source || '/' || env || '/' || plan_code || '/' || status from public.event_entitlements where id = :'ent1'::uuid),
  'cortesia/nenhum/casamento/ativo', 'cortesia cria direito cortesia/nenhum ativo');
select is((select max_guests || '/' || max_shots from public.event_entitlements where id = :'ent1'::uuid), '250/36', 'direito com os limites do plano');
select is((select created_by from public.event_entitlements where id = :'ent1'::uuid), '00000000-0000-4000-8000-0000000009c1'::uuid, 'direito registra o Master');
select is((select capacity || '/' || shots_per_person from public.events where id = '00000000-0000-4000-8000-0000000009e1'), '250/36',
  'cortesia sobe os limites do evento');
select is((select plan_code || '/' || source from public.effective_entitlement('00000000-0000-4000-8000-0000000009e1')), 'casamento/cortesia',
  'plano efetivo passa a ser a cortesia (vale com pagamentos desligados)');
select is((select count(*)::int from public.audit_logs where action = 'entitlement.courtesy_granted' and actor_role = 'master'
           and event_id = '00000000-0000-4000-8000-0000000009e1' and actor_id = '00000000-0000-4000-8000-0000000009c1'
           and reason = 'Parceria com o cerimonial' and detail ->> 'entitlementId' = :'ent1' and detail ->> 'plan' = 'casamento'), 1,
  'cortesia auditada com actor_role=master e motivo');

-- ===================================================== catálogo: admin_set_plan
select tests.login('00000000-0000-4000-8000-0000000009c1', 'master');
select throws_ok($$select public.admin_set_plan('casamento', 99, true, true, 'motivo longo o bastante')$$, 'MM005', null, 'plano pago abaixo de R$ 1,00: erro');
select throws_ok($$select public.admin_set_plan('casamento', null, true, true, 'motivo longo o bastante')$$, 'MM005', null, 'preço nulo: erro');
select throws_ok($$select public.admin_set_plan('gratis', 100, true, true, 'motivo longo o bastante')$$, 'MM005', null, 'preço do grátis não muda');
select throws_ok($$select public.admin_set_plan('inexistente', 1000, true, true, 'motivo longo o bastante')$$, 'MM005', null, 'plano desconhecido: erro');
select throws_ok($$select public.admin_set_plan('casamento', 19900, true, true, 'curto')$$, 'MM011', 'reasonrequired', 'set_plan sem motivo: MM011');
reset role;

-- Pix aberto de R$ 189 (pendente) antes da mudança de preço
select tests.set_env('sandbox');
select tests.login('00000000-0000-4000-8000-0000000009a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000009e2', 'casamento', gen_random_uuid()) ->> 'orderId' as o_open \gset
reset role;
set local role service_role;
select public.payments_attach_charge(:'o_open'::uuid, 'pix_char_open9', 'br', 'b64', now() + interval '1 hour', true);
reset role;
select is((select status::text || '/' || amount_cents from public.payment_orders where id = :'o_open'::uuid), 'pendente/18900', 'pedido pendente de R$ 189');

select tests.login('00000000-0000-4000-8000-0000000009c1', 'master');
select lives_ok($$select public.admin_set_plan('casamento', 19900, true, true, 'Ajuste de preço após piloto de novembro')$$, 'Master altera o preço do Casamento');
reset role;
select is((select price_cents from public.plans where code = 'casamento'), 19900, 'preço novo gravado');
select is((select max_guests || '/' || max_shots from public.plans where code = 'casamento'), '250/36', 'limites não mudam');
select is((select count(*)::int from public.audit_logs where action = 'plan.updated' and actor_role = 'master' and target_type = 'plan'
           and target_id = 'casamento' and reason = 'Ajuste de preço após piloto de novembro'
           and (detail -> 'old' ->> 'priceCents')::int = 18900 and (detail -> 'new' ->> 'priceCents')::int = 19900), 1,
  'admin_set_plan audita valor anterior e novo');
select is((select amount_cents from public.payment_orders where id = :'o_open'::uuid), 18900, 'price_change_keeps_open_order: Pix gerado mantém o valor');
select tests.login('00000000-0000-4000-8000-0000000009a1');
select is((public.payments_quote('00000000-0000-4000-8000-0000000009e3', 'casamento') ->> 'amountCents')::int, 19900,
  'payments_quote passa a devolver o preço novo');
reset role;
set local role anon;
select is((select (p ->> 'priceCents')::int from jsonb_array_elements(public.list_public_plans()) p where p ->> 'code' = 'casamento'), 19900,
  'list_public_plans reflete o preço novo imediatamente');
reset role;

-- ativação: desligar Festa nos dois ambientes; admin_list_plans continua mostrando
select tests.login('00000000-0000-4000-8000-0000000009c1', 'master');
select lives_ok($$select public.admin_set_plan('festa', 2900, false, false, 'Festa fora do catálogo por enquanto')$$, 'Master desativa a Festa');
select throws_ok($$select public.admin_set_plan('gratis', 0, false, true, 'motivo longo o bastante')$$, 'MM005', null, 'ativação do grátis não muda');
select is((select count(*)::int from public.admin_list_plans()), 5, 'admin_list_plans devolve todos os planos');
select is((select (p ->> 'sandboxActive')::boolean from public.admin_list_plans() p where p ->> 'code' = 'festa'), false,
  'admin_list_plans devolve plano inativo');
select is((select jsonb_array_length(p -> 'history') from public.admin_list_plans() p where p ->> 'code' = 'casamento'), 1,
  'admin_list_plans traz o histórico do plano');
select is((select p -> 'history' -> 0 ->> 'reason' from public.admin_list_plans() p where p ->> 'code' = 'casamento'),
  'Ajuste de preço após piloto de novembro', 'histórico com o motivo');
select ok((select p ? 'updatedAt' from public.admin_list_plans() p where p ->> 'code' = 'casamento'), 'admin_list_plans traz updatedAt');
reset role;
set local role anon;
select ok(not exists (select 1 from jsonb_array_elements(public.list_public_plans()) p where p ->> 'code' = 'festa'),
  'list_public_plans omite plano inativo no ambiente vigente');
select throws_ok($$select * from public.admin_list_plans()$$, '42501', null, 'anon não lista planos do Master');
reset role;

-- ===================================================== configuração pública
insert into public.platform_settings (key, value) values ('segredo_interno', '"nao-expor"') on conflict (key) do update set value = excluded.value;
update public.platform_settings set value = '"suporte@memoriesmt.test"' where key = 'support_email';
set local role anon;
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_public_settings()) k),
  array['capacity_grace_pct', 'company_cnpj', 'company_legal_name', 'payments_env', 'support_email', 'support_phone'],
  'get_public_settings como anon devolve só as chaves permitidas');
select is(public.get_public_settings() ->> 'support_email', 'suporte@memoriesmt.test', 'support_email exposto');
select is(public.get_public_settings() ->> 'payments_env', 'sandbox', 'payments_env exposto');
select is(jsonb_typeof(public.get_public_settings() -> 'capacity_grace_pct'), 'number', 'capacity_grace_pct é número');
select is((public.get_public_settings() ->> 'capacity_grace_pct')::numeric, 10::numeric, 'capacity_grace_pct = 10');
reset role;

-- produção sem nenhum plano ativo em produção → só o grátis
update public.plans set production_active = false where not is_free;
select tests.set_env('production');
set local role anon;
select is((select array_agg(p ->> 'code') from jsonb_array_elements(public.list_public_plans()) p), array['gratis'],
  'list_public_plans em produção sem plano ativo → só gratis');
reset role;
select tests.set_env('desligado');
set local role anon;
select is((select array_agg(p ->> 'code') from jsonb_array_elements(public.list_public_plans()) p), array['gratis'],
  'list_public_plans com pagamentos desligados → só gratis');
reset role;
select tests.set_env('sandbox');

-- ===================================================== pagamentos e divergências
-- d1 pago sem direito · d2 needs_refund (cancelado) · d3 pendente há 2 h · d4 em disputa · d5 pago de evento purgado (event_id null)
-- d6 pago com direito (não diverge) · d8 pago marcado para reembolso (plano já coberto) · d9 cancelado sem dinheiro recebido
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider_env, provider_charge_id, idempotency_key, created_at, paid_at, needs_refund) values
  ('00000000-0000-4000-8000-0000000009d1', '00000000-0000-4000-8000-0000000009e4', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'pago', 'sandbox', 'pix_char_d1', gen_random_uuid(), now() - interval '3 hours', now(), false),
  ('00000000-0000-4000-8000-0000000009d2', '00000000-0000-4000-8000-0000000009e4', '00000000-0000-4000-8000-0000000009a1', 'grande', 16000, 'cancelado', 'sandbox', 'pix_char_d2', gen_random_uuid(), now() - interval '2 days', null, true),
  ('00000000-0000-4000-8000-0000000009d3', '00000000-0000-4000-8000-0000000009e3', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'pendente', 'sandbox', 'pix_char_d3', gen_random_uuid(), now() - interval '2 hours', null, false),
  ('00000000-0000-4000-8000-0000000009d4', '00000000-0000-4000-8000-0000000009e4', '00000000-0000-4000-8000-0000000009a1', 'celebracao', 8900, 'em_disputa', 'sandbox', 'pix_char_d4', gen_random_uuid(), now() - interval '5 days', now() - interval '5 days', false),
  ('00000000-0000-4000-8000-0000000009d5', null, '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'pago', 'sandbox', 'pix_char_d5', gen_random_uuid(), now() - interval '40 days', now() - interval '40 days', false),
  ('00000000-0000-4000-8000-0000000009d6', '00000000-0000-4000-8000-0000000009e1', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'pago', 'sandbox', 'pix_char_d6', gen_random_uuid(), now() - interval '1 day', now() - interval '1 day', false),
  ('00000000-0000-4000-8000-0000000009d7', '00000000-0000-4000-8000-0000000009e1', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'estornado', 'sandbox', 'pix_char_d7', gen_random_uuid(), now() - interval '1 day', now() - interval '1 day', false),
  ('00000000-0000-4000-8000-0000000009d8', '00000000-0000-4000-8000-0000000009e1', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'pago', 'sandbox', 'pix_char_d8', gen_random_uuid(), now() - interval '30 minutes', now(), true),
  ('00000000-0000-4000-8000-0000000009d9', '00000000-0000-4000-8000-0000000009e4', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'cancelado', 'sandbox', 'pix_char_d9', gen_random_uuid(), now() - interval '1 day', null, false);
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, order_id, env)
  values ('00000000-0000-4000-8000-0000000009e1', 'festa', 30, 24, 'pago', '00000000-0000-4000-8000-0000000009d6', 'sandbox'),
         ('00000000-0000-4000-8000-0000000009e4', 'celebracao', 100, 24, 'pago', '00000000-0000-4000-8000-0000000009d7', 'sandbox');
-- d7 foi estornado, mas o direito ficou ativo (direito pago sem pedido pago)
insert into public.payment_events (event_type, order_id, outcome, detail) values
  ('apply.webhook', '00000000-0000-4000-8000-0000000009d2', 'pago_ignorado_reembolsar', '{"from":"cancelado","to":"pago"}'),
  ('apply.reconcile', '00000000-0000-4000-8000-0000000009d1', 'divergencia_valor', '{"from":"pago","to":"pago"}'),
  ('apply.reconcile', '00000000-0000-4000-8000-0000000009d1', 'divergencia_valor', '{"from":"pago","to":"pago"}'),
  ('apply.webhook', '00000000-0000-4000-8000-0000000009d3', 'divergencia_ambiente', '{"from":"pendente","to":"pago"}'),
  ('apply.webhook', '00000000-0000-4000-8000-0000000009d3', 'transicao_ignorada', '{"from":"pendente","to":"criado"}'),
  ('apply.webhook', '00000000-0000-4000-8000-0000000009d6', 'upgrade_base_estornado', '{"baseOrderId":"x"}'),
  ('apply.webhook', '00000000-0000-4000-8000-0000000009d6', 'transicao_ignorada', '{"from":"criado","to":"pago"}');

select tests.login('00000000-0000-4000-8000-0000000009c1', 'master');
create temp table div as select d from public.admin_payment_divergences() d;
select ok(exists (select 1 from div where d ->> 'kind' = 'needs_refund' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d2'),
  'admin_payment_divergences lista o pedido com needs_refund');
select ok(exists (select 1 from div where d ->> 'kind' = 'pago_sem_direito' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d1'),
  'divergência: pago sem direito');
select ok(exists (select 1 from div where d ->> 'kind' = 'direito_sem_pedido_pago' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d7'),
  'divergência: direito pago sem pedido pago');
select ok(exists (select 1 from div where d ->> 'kind' = 'pendente_1h' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d3'),
  'divergência: pendente com mais de 1 h');
select ok(exists (select 1 from div where d ->> 'kind' = 'em_disputa' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d4'),
  'divergência: em disputa');
select ok(not exists (select 1 from div where d ->> 'kind' = 'pago_sem_direito' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d5'),
  'pago de evento purgado não é "pago sem direito" (o direito saiu com o evento)');
select ok(not exists (select 1 from div where d ->> 'kind' = 'pago_sem_direito' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d8'),
  'pago já marcado para reembolso não aparece de novo como "pago sem direito"');
select ok(exists (select 1 from div where d ->> 'kind' = 'needs_refund' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d8'),
  'pago marcado para reembolso aparece como needs_refund');
select ok((select bool_and(not (d ->> 'refundInProgress')::boolean) from div), 'sem reembolso solicitado: nenhuma divergência em andamento');
select ok(exists (select 1 from div where d ->> 'kind' = 'pago_ignorado_reembolsar' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d2'),
  'divergência: pago ignorado a reembolsar');
select is((select (d ->> 'occurrences')::int from div where d ->> 'kind' = 'divergencia_valor' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d1'), 2,
  'divergência de valor agrupada por pedido');
select ok(exists (select 1 from div where d ->> 'kind' = 'divergencia_ambiente' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d3'),
  'divergência: ambiente divergente');
select ok(exists (select 1 from div where d ->> 'kind' = 'upgrade_base_estornado' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d6'),
  'divergência: base do upgrade estornada');
select ok(exists (select 1 from div where d ->> 'kind' = 'transicao_ignorada' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d6'),
  'divergência: transição ignorada para pago');
select ok(not exists (select 1 from div where d ->> 'kind' = 'transicao_ignorada' and d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d3'),
  'transição ignorada que não ia para pago não é divergência');
select ok(not exists (select 1 from div where d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d6' and d ->> 'kind' in ('pago_sem_direito', 'direito_sem_pedido_pago')),
  'pago com direito não diverge');
select ok((select bool_and(d ? 'eventTitle' and d ? 'refundInProgress' and d ? 'planCode' and d ? 'amountCents' and d ? 'status' and d ? 'detectedAt') from div),
  'divergência traz evento, plano, valor, status e data');

-- lista e totais
select is((select count(*)::int from public.admin_list_payments()), 10, 'admin_list_payments lista todos os pedidos');
select ok(exists (select 1 from public.admin_list_payments() p where p ->> 'orderId' = '00000000-0000-4000-8000-0000000009d5' and p -> 'eventId' = 'null'::jsonb),
  'pedido de evento purgado continua em admin_list_payments');
select is((select count(*)::int from public.admin_list_payments('pago')), 4, 'admin_list_payments filtra por status');
select is((select count(*)::int from public.admin_list_payments(null, 2)), 2, 'admin_list_payments respeita o limite');
select throws_ok($$select * from public.admin_list_payments('nao_existe')$$, 'MM005', null, 'status desconhecido: MM005');
select is((select p ->> 'eventTitle' from public.admin_list_payments() p where p ->> 'orderId' = '00000000-0000-4000-8000-0000000009d1'), 'Divergências',
  'pedido traz o título do evento');
select ok((select (p ->> 'needsRefund')::boolean from public.admin_list_payments() p where p ->> 'orderId' = '00000000-0000-4000-8000-0000000009d2'),
  'pedido traz needs_refund');
select ok((select p ? 'providerChargeId' and p ? 'provider' and p ? 'createdAt' and p ? 'planName' from public.admin_list_payments() p limit 1),
  'pedido traz cobrança, provedor, data e nome do plano');
select is(public.admin_payments_summary() ->> 'env', 'sandbox', 'resumo traz o ambiente vigente');
select is((public.admin_payments_summary() -> 'byStatus' -> 'pago' ->> 'count')::int, 4, 'resumo conta pagos');
select is((public.admin_payments_summary() -> 'paid30d' ->> 'count')::int, 3, 'pagos nos últimos 30 dias');
select is((public.admin_payments_summary() -> 'paid30d' ->> 'amountCents')::int, 8700, 'valor pago nos últimos 30 dias');
select is((public.admin_payments_summary() ->> 'pendingOver1h')::int, 1, 'pendentes há mais de 1 h');
select is((public.admin_payments_summary() ->> 'divergences')::int, (select count(*)::int from div), 'resumo conta as divergências');

-- ===================================================== reembolso
select throws_ok($$select public.admin_request_refund('00000000-0000-4000-8000-0000000009d3', 'motivo longo o bastante')$$,
  'MM005', null, 'reembolso de pedido pendente: MM005');
select throws_ok($$select public.admin_request_refund('00000000-0000-4000-8000-0000000009d7', 'motivo longo o bastante')$$,
  'MM005', null, 'reembolso de pedido já estornado: MM005');
select throws_ok($$select public.admin_request_refund('00000000-0000-4000-8000-0000000009d1', 'curto')$$, 'MM011', 'reasonrequired', 'reembolso sem motivo: MM011');
select throws_ok($$select public.admin_request_refund(gen_random_uuid(), 'motivo longo o bastante')$$, 'MM005', null, 'pedido inexistente: MM005');
select lives_ok($$select public.admin_request_refund('00000000-0000-4000-8000-0000000009d1', 'Pagamento em duplicidade no evento')$$, 'reembolso solicitado');
select throws_ok($$select public.admin_request_refund('00000000-0000-4000-8000-0000000009d1', 'Pagamento em duplicidade no evento')$$,
  'MM005', null, 'segunda solicitação com reembolso pendente: MM005 (sem reembolso duplo)');
select throws_ok($$select public.admin_request_refund('00000000-0000-4000-8000-0000000009d4', 'Contestação aceita pelo suporte')$$,
  'MM005', null, 'pedido em disputa não aceita reembolso (o provedor recusa): MM005');
select ok((select (p ->> 'refundRequestedAt') is not null from public.admin_list_payments() p where p ->> 'orderId' = '00000000-0000-4000-8000-0000000009d1'),
  'lista mostra reembolso solicitado');
-- Ruling 16: Pix recebido em pedido cancelado (needs_refund) é reembolsável; cancelado sem dinheiro recebido não
select throws_ok($$select public.admin_request_refund('00000000-0000-4000-8000-0000000009d9', 'motivo longo o bastante')$$,
  'MM005', null, 'cancelado sem needs_refund não aceita reembolso: MM005');
select lives_ok($$select public.admin_request_refund('00000000-0000-4000-8000-0000000009d2', 'Pix pago depois do cancelamento')$$,
  'cancelado com needs_refund aceita reembolso');
select throws_ok($$select public.admin_request_refund('00000000-0000-4000-8000-0000000009d2', 'Pix pago depois do cancelamento')$$,
  'MM005', null, 'cancelado com reembolso já solicitado: MM005');
select ok((select bool_and((d ->> 'refundInProgress')::boolean) from public.admin_payment_divergences() d
           where d ->> 'orderId' in ('00000000-0000-4000-8000-0000000009d1', '00000000-0000-4000-8000-0000000009d2')),
  'divergências de pedido com reembolso solicitado ficam "em andamento"');
select is((public.admin_payments_summary() ->> 'divergences')::int,
  (select count(*)::int from public.admin_payment_divergences() d where not (d ->> 'refundInProgress')::boolean),
  'reembolso em andamento sai da contagem "precisa de ação"');
select ok((public.admin_payments_summary() ->> 'divergences')::int < (select count(*)::int from public.admin_payment_divergences()),
  'a contagem de ação é menor que o total de divergências');
reset role;
select is((select refund_reason || '/' || status::text from public.payment_orders where id = '00000000-0000-4000-8000-0000000009d1'),
  'Pagamento em duplicidade no evento/pago', 'reembolso grava motivo e não muda o status');
select is((select count(*)::int from public.audit_logs where action = 'payment.refund_requested' and actor_role = 'master'
           and target_id = '00000000-0000-4000-8000-0000000009d1' and reason = 'Pagamento em duplicidade no evento'), 1, 'reembolso auditado');

-- estorno do pedido cancelado (needs_refund): cancelado → estornado aplicado e needs_refund limpo
set local role service_role;
select is((public.payments_apply_status('00000000-0000-4000-8000-0000000009d2', 'pix_char_d2', 'estornado', 16000, true, 'webhook') ->> 'applied')::boolean, true,
  'cancelado → estornado com needs_refund é aplicado');
select is((public.payments_apply_status('00000000-0000-4000-8000-0000000009d9', 'pix_char_d9', 'estornado', 2900, true, 'webhook') ->> 'applied')::boolean, false,
  'cancelado → estornado sem needs_refund é ignorado');
reset role;
select is((select status::text || '/' || needs_refund from public.payment_orders where id = '00000000-0000-4000-8000-0000000009d2'), 'estornado/false',
  'pedido cancelado estornado: status estornado e needs_refund limpo');
select is((select status::text from public.payment_orders where id = '00000000-0000-4000-8000-0000000009d9'), 'cancelado', 'cancelado sem dinheiro continua cancelado');
select is((select outcome from public.payment_events where order_id = '00000000-0000-4000-8000-0000000009d9' order by id desc limit 1), 'transicao_ignorada',
  'transição sem needs_refund registrada como ignorada');
select tests.login('00000000-0000-4000-8000-0000000009c1', 'master');
select ok(not exists (select 1 from public.admin_payment_divergences() d where d ->> 'orderId' = '00000000-0000-4000-8000-0000000009d2' and d ->> 'kind' = 'needs_refund'),
  'needs_refund some das divergências depois do estorno');
reset role;

-- ===================================================== fix 2: sem auditoria repetida; disputa não é "reembolso em andamento"
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider_env, provider_charge_id, idempotency_key, created_at, paid_at, needs_refund, refund_requested_at) values
  ('00000000-0000-4000-8000-000000009d10', '00000000-0000-4000-8000-0000000009e4', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'cancelado', 'sandbox', 'pix_char_d10', gen_random_uuid(), now() - interval '1 day', null, false, null),
  ('00000000-0000-4000-8000-000000009d11', '00000000-0000-4000-8000-0000000009e4', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'em_disputa', 'sandbox', 'pix_char_d11', gen_random_uuid(), now() - interval '1 day', now() - interval '1 day', false, now());
set local role service_role;
select is((public.payments_apply_status('00000000-0000-4000-8000-000000009d10', 'pix_char_d10', 'pago', 2900, true, 'webhook') ->> 'applied')::boolean, false,
  'PAID em pedido cancelado: não aplicado');
select public.payments_apply_status('00000000-0000-4000-8000-000000009d10', 'pix_char_d10', 'pago', 2900, true, 'reconcile');
select public.payments_apply_status('00000000-0000-4000-8000-000000009d10', 'pix_char_d10', 'pago', 2900, true, 'reconcile');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'payment.pago_ignorado_reembolsar' and detail ->> 'orderId' = '00000000-0000-4000-8000-000000009d10'), 1,
  'PAID repetido em cancelado com needs_refund não grava nova auditoria');
select is((select array_agg(outcome order by id) from public.payment_events where order_id = '00000000-0000-4000-8000-000000009d10'),
  array['pago_ignorado_reembolsar'], 'PAID repetido: duplicado não regrava evento (PAY-004)');
select is((select needs_refund from public.payment_orders where id = '00000000-0000-4000-8000-000000009d10'), true, 'needs_refund continua marcado');
select tests.login('00000000-0000-4000-8000-0000000009c1', 'master');
select is((select (d ->> 'refundInProgress')::boolean from public.admin_payment_divergences() d
           where d ->> 'orderId' = '00000000-0000-4000-8000-000000009d11' and d ->> 'kind' = 'em_disputa'), false,
  'pedido com reembolso solicitado que entrou em disputa não fica "em andamento"');
select is((public.admin_payments_summary() ->> 'divergences')::int,
  (select count(*)::int from public.admin_payment_divergences() d where not (d ->> 'refundInProgress')::boolean),
  'disputa conta em "precisa de ação"');
select ok((select (p ->> 'refundRequestedAt') is not null and p ->> 'status' = 'em_disputa' from public.admin_list_payments() p
           where p ->> 'orderId' = '00000000-0000-4000-8000-000000009d11'), 'lista mostra a disputa com o reembolso solicitado');
reset role;

-- ===================================================== dinheiro divergente sempre reembolsável
-- d12: PAID com valor divergente; d13: PAID de outra cobrança; d14: divergência sem PAID (não marca reembolso)
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider_env, provider_charge_id, idempotency_key, created_at) values
  ('00000000-0000-4000-8000-000000009d12', '00000000-0000-4000-8000-0000000009e4', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'pendente', 'sandbox', 'pix_char_d12', gen_random_uuid(), now() - interval '50 days'),
  ('00000000-0000-4000-8000-000000009d13', '00000000-0000-4000-8000-0000000009e4', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'expirado', 'sandbox', 'pix_char_d13', gen_random_uuid(), now() - interval '50 days'),
  ('00000000-0000-4000-8000-000000009d14', '00000000-0000-4000-8000-0000000009e4', '00000000-0000-4000-8000-0000000009a1', 'festa', 2900, 'expirado', 'sandbox', 'pix_char_d14', gen_random_uuid(), now() - interval '50 days');
set local role service_role;
select public.payments_apply_status('00000000-0000-4000-8000-000000009d12', 'pix_char_d12', 'pago', 2800, true, 'webhook');
select public.payments_apply_status('00000000-0000-4000-8000-000000009d13', 'pix_char_outra', 'pago', 2900, true, 'webhook');
reset role;
-- eventos de divergência antigos (> 30 dias): continuam visíveis enquanto o pedido precisa de reembolso
update public.payment_events set received_at = now() - interval '40 days'
 where order_id in ('00000000-0000-4000-8000-000000009d12', '00000000-0000-4000-8000-000000009d13');
insert into public.payment_events (event_type, order_id, outcome, detail, received_at) values
  ('apply.reconcile', '00000000-0000-4000-8000-000000009d14', 'divergencia_valor', '{"from":"expirado","to":"pago"}', now() - interval '40 days');
select is((select string_agg(status::text || '/' || needs_refund, ',' order by id) from public.payment_orders
           where id in ('00000000-0000-4000-8000-000000009d12', '00000000-0000-4000-8000-000000009d13', '00000000-0000-4000-8000-000000009d14')),
  'pendente/true,expirado/true,expirado/false', 'PAID divergente marca needs_refund e mantém o status');
select tests.login('00000000-0000-4000-8000-0000000009c1', 'master');
select ok(exists (select 1 from public.admin_payment_divergences() d where d ->> 'orderId' = '00000000-0000-4000-8000-000000009d12' and d ->> 'kind' = 'divergencia_valor'),
  'divergência de valor com PAID e needs_refund não expira em 30 dias');
select ok(exists (select 1 from public.admin_payment_divergences() d where d ->> 'orderId' = '00000000-0000-4000-8000-000000009d13' and d ->> 'kind' = 'divergencia_cobranca'),
  'divergência de cobrança com PAID e needs_refund não expira em 30 dias');
select ok(not exists (select 1 from public.admin_payment_divergences() d where d ->> 'orderId' = '00000000-0000-4000-8000-000000009d14'),
  'divergência antiga sem needs_refund expira em 30 dias');
select throws_ok($$select public.admin_request_refund('00000000-0000-4000-8000-000000009d14', 'motivo longo o bastante')$$,
  'MM005', null, 'expirado sem needs_refund não aceita reembolso: MM005');
select lives_ok($$select public.admin_request_refund('00000000-0000-4000-8000-000000009d12', 'Pix pago com valor divergente')$$,
  'pendente com needs_refund (PAID divergente) aceita reembolso');
select lives_ok($$select public.admin_request_refund('00000000-0000-4000-8000-000000009d13', 'Pix pago em outra cobrança')$$,
  'expirado com needs_refund aceita reembolso');
select ok((select bool_and((d ->> 'refundInProgress')::boolean) from public.admin_payment_divergences() d
           where d ->> 'orderId' in ('00000000-0000-4000-8000-000000009d12', '00000000-0000-4000-8000-000000009d13')),
  'reembolso de pedido divergente fica "em andamento"');
reset role;
set local role service_role;
select is((public.payments_apply_status('00000000-0000-4000-8000-000000009d12', 'pix_char_d12', 'estornado', 2800, true, 'webhook') ->> 'applied')::boolean, true,
  'estorno do PAID divergente fecha o pedido');
reset role;
select tests.login('00000000-0000-4000-8000-0000000009c1', 'master');
select ok(not exists (select 1 from public.admin_payment_divergences() d where d ->> 'orderId' = '00000000-0000-4000-8000-000000009d12'),
  'depois do estorno a divergência antiga volta a expirar');
reset role;

-- ===================================================== job de conciliação
select ok(not exists (select 1 from cron.job where jobname = 'mm-payments-reconcile'), 'sem segredo no Vault: job não existe');
select is(public.payments_schedule_reconcile(), false, 'sem segredo: não agenda');
select vault.create_secret('token-de-teste-com-mais-de-vinte-caracteres', 'mm_payments_cron_token');
select is(public.payments_schedule_reconcile(), false, 'só o token, sem a URL no Vault: não agenda (nunca cai na URL de produção)');
select ok(not exists (select 1 from cron.job where jobname = 'mm-payments-reconcile'), 'sem URL: job não existe');
select vault.create_secret('http://127.0.0.1:54321/functions/v1/payments-reconcile', 'mm_payments_reconcile_url');
select is(public.payments_schedule_reconcile(), true, 'com token e URL: agenda');
select is((select schedule from cron.job where jobname = 'mm-payments-reconcile'), '*/5 * * * *', 'job a cada 5 minutos');
select ok((select command like '%net.http_post%' and command like '%mm_payments_cron_token%' and command like '%mm_payments_reconcile_url%' and command not like '%token-de-teste%'
           and command not like '%supabase.co%' and command not like '%127.0.0.1%'
           from cron.job where jobname = 'mm-payments-reconcile'), 'job lê o token do Vault em tempo de execução');
select is(public.payments_schedule_reconcile(), true, 'reagendar é idempotente');
select is((select count(*)::int from cron.job where jobname = 'mm-payments-reconcile'), 1, 'um único job');

select * from finish();
rollback;
