-- pgTAP · COM-002 (RV-M-09): pedidos Pix, eventos do provedor, idempotência e máquina de estados.
-- Organizador: payments_quote / payments_open_order / payments_order_status (authenticated, só o anfitrião).
-- Serviço: payments_attach_charge / payments_apply_status / payments_record_event (só service_role).
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
grant usage on schema tests to authenticated, service_role;
grant execute on all functions in schema tests to authenticated, service_role;

-- pessoas: h1 anfitrião · h2 outro anfitrião · m1 master · 15 convidados
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000008a1', 'authenticated', 'authenticated', 'host8@test.local', false),
  ('00000000-0000-4000-8000-0000000008a2', 'authenticated', 'authenticated', 'outro8@test.local', false),
  ('00000000-0000-4000-8000-0000000008c1', 'authenticated', 'authenticated', 'master8@test.local', false);
insert into auth.users (id, aud, role, is_anonymous)
  select ('00000000-0000-4000-8000-0000000081' || lpad(g::text, 2, '0'))::uuid, 'authenticated', 'authenticated', true
  from generate_series(1, 15) g;
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000008%' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000008c1', 'master');

-- eventos (inseridos pelo dono: limites explícitos do grátis). e5 já terminou.
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, start_at) values
  ('00000000-0000-4000-8000-0000000008e1', 'Pago', 'festa', '00000000-0000-4000-8000-0000000008a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000008e2', 'Tardio', 'festa', '00000000-0000-4000-8000-0000000008a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000008e3', 'Reembolso', 'festa', '00000000-0000-4000-8000-0000000008a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000008e4', 'Vencido', 'festa', '00000000-0000-4000-8000-0000000008a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000008e5', 'Encerrado', 'festa', '00000000-0000-4000-8000-0000000008a1', 'H', 6, 10, 10, now() - interval '3 days'),
  ('00000000-0000-4000-8000-0000000008e6', 'Upgrade', 'festa', '00000000-0000-4000-8000-0000000008a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000008e7', 'Excluído', 'festa', '00000000-0000-4000-8000-0000000008a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000008e8', 'Termina', 'festa', '00000000-0000-4000-8000-0000000008a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000008e9', 'Purgado', 'festa', '00000000-0000-4000-8000-0000000008a1', 'H', 6, 10, 10, now());

-- ===================================================== estrutura
select has_table('public', 'payment_orders', 'payment_orders existe');
select has_table('public', 'payment_events', 'payment_events existe');
select enum_has_labels('public', 'payment_status',
  array['criado', 'pendente', 'pago', 'expirado', 'cancelado', 'falhou', 'estornado', 'em_disputa', 'perdido'], 'enum payment_status');
select fk_ok('public', 'event_entitlements', 'order_id', 'public', 'payment_orders', 'id', 'event_entitlements.order_id → payment_orders');
select has_index('public', 'event_entitlements', 'event_entitlements_order_idx', 'índice em event_entitlements.order_id');
select throws_ok($$insert into public.payment_orders (event_id, host_id, plan_code, amount_cents, provider_env, idempotency_key)
  values ('00000000-0000-4000-8000-0000000008e1', '00000000-0000-4000-8000-0000000008a1', 'festa', 99, 'sandbox', gen_random_uuid())$$,
  '23514', null, 'amount_cents >= 100');

-- ===================================================== pagamentos desligados
select tests.login('00000000-0000-4000-8000-0000000008a1');
select throws_ok($$select public.payments_quote('00000000-0000-4000-8000-0000000008e1', 'celebracao')$$,
  'MM014', 'pagamentoindisponivel', 'quote com pagamentos desligados: MM014');
select throws_ok($$select public.payments_open_order('00000000-0000-4000-8000-0000000008e1', 'celebracao', gen_random_uuid())$$,
  'MM014', 'pagamentoindisponivel', 'open_order com pagamentos desligados: MM014');
reset role;
select tests.set_env('sandbox');

-- ===================================================== cotação e abertura de pedido
select tests.login('00000000-0000-4000-8000-0000000008a1');
select is(public.payments_quote('00000000-0000-4000-8000-0000000008e1', 'celebracao'),
  '{"planCode":"celebracao","fromPlanCode":"gratis","amountCents":8900,"payable":true,"reason":"ok"}'::jsonb,
  'quote do grátis para celebracao = preço cheio');
select is(public.payments_quote('00000000-0000-4000-8000-0000000008e1', 'gratis') ->> 'reason', 'ja_incluido', 'grátis já incluído');
select is((public.payments_quote('00000000-0000-4000-8000-0000000008e1', 'gratis') ->> 'payable')::boolean, false, 'grátis não é pagável');
select throws_ok($$select public.payments_quote('00000000-0000-4000-8000-0000000008e1', 'inexistente')$$, 'MM005', null, 'plano desconhecido: MM005');
select is(public.payments_quote('00000000-0000-4000-8000-0000000008e5', 'festa') ->> 'reason', 'evento_encerrado', 'evento encerrado não cota');
select throws_ok($$select public.payments_open_order('00000000-0000-4000-8000-0000000008e5', 'festa', gen_random_uuid())$$,
  'MM002', null, 'evento encerrado não abre pedido');

select public.payments_open_order('00000000-0000-4000-8000-0000000008e1', 'celebracao', '11111111-1111-4111-8111-111111111111') as r1 \gset
select (:'r1'::jsonb) ->> 'orderId' as o1 \gset
select is((:'r1'::jsonb) - 'orderId', '{"status":"criado","amountCents":8900,"brCode":null,"brCodeBase64":null,"expiresAt":null,"reused":false}'::jsonb,
  'open_order cria pedido criado com o valor da cotação');
select is(public.payments_open_order('00000000-0000-4000-8000-0000000008e1', 'celebracao', '11111111-1111-4111-8111-111111111111') ->> 'orderId', :'o1',
  'open_order_reuses: mesma chave → mesmo pedido');
select is((public.payments_open_order('00000000-0000-4000-8000-0000000008e1', 'celebracao', '11111111-1111-4111-8111-111111111111') ->> 'reused')::boolean, true,
  'mesma chave → reused=true');
select is(public.payments_open_order('00000000-0000-4000-8000-0000000008e1', 'celebracao', '22222222-2222-4222-8222-222222222222') ->> 'orderId', :'o1',
  'chave diferente e pedido aberto do mesmo plano → reusa');
select throws_ok($$select public.payments_open_order('00000000-0000-4000-8000-0000000008e1', 'festa', '33333333-3333-4333-8333-333333333333')$$,
  'MM013', 'pedidoaberto', 'outro plano com Pix aberto → MM013');
select throws_ok($$select public.payments_open_order('00000000-0000-4000-8000-0000000008e2', 'festa', '11111111-1111-4111-8111-111111111111')$$,
  'MM005', null, 'mesma chave para outro evento/plano é recusada');
select is((select count(*)::int from public.payment_orders where event_id = '00000000-0000-4000-8000-0000000008e1'), 1, 'um único pedido no evento');
select is(public.payments_order_status(:'o1'::uuid) ->> 'status', 'criado', 'order_status do anfitrião');
select is((select count(*)::int from public.payment_orders), 1, 'anfitrião lê o próprio pedido');
select throws_ok($$insert into public.payment_orders (event_id, host_id, plan_code, amount_cents, provider_env, idempotency_key)
  values ('00000000-0000-4000-8000-0000000008e1', '00000000-0000-4000-8000-0000000008a1', 'festa', 100, 'sandbox', gen_random_uuid())$$,
  '42501', null, 'cliente não insere pedido');
select throws_ok($$update public.payment_orders set status = 'pago'$$, '42501', null, 'cliente não altera pedido');
select throws_ok($$select count(*) from public.payment_events$$, '42501', null, 'cliente não lê payment_events');
select throws_ok(format('select public.payments_apply_status(%L, %L, %L, %s, %L, %L)', :'o1', 'ch1', 'pago', 8900, true, 'webhook'),
  '42501', null, 'client_cannot_call_service_rpcs: apply_status');
select throws_ok(format('select public.payments_attach_charge(%L, %L, %L, %L, now(), true)', :'o1', 'ch1', 'x', 'y'),
  '42501', null, 'client_cannot_call_service_rpcs: attach_charge');
select throws_ok($$select public.payments_record_event('evt', 'x', null, 'x', '{}')$$, '42501', null, 'client_cannot_call_service_rpcs: record_event');
reset role;

select tests.login('00000000-0000-4000-8000-0000000008a2');
select throws_ok($$select public.payments_open_order('00000000-0000-4000-8000-0000000008e1', 'festa', gen_random_uuid())$$,
  'MM004', 'forbidden', 'open_order_forbidden_other_host: MM004');
select throws_ok($$select public.payments_quote('00000000-0000-4000-8000-0000000008e1', 'festa')$$, 'MM004', 'forbidden', 'quote de evento alheio: MM004');
select throws_ok(format('select public.payments_order_status(%L)', :'o1'), 'MM004', 'forbidden', 'status de pedido alheio: MM004');
select is((select count(*)::int from public.payment_orders), 0, 'organizador não lê pedido alheio (RLS)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000008c1', 'master');
select is((select count(*)::int from public.payment_orders), 1, 'master lê pedidos');
reset role;
set local role anon;
select throws_ok($$select public.payments_quote('00000000-0000-4000-8000-0000000008e1', 'festa')$$, '42501', null, 'anon não cota');
reset role;

-- ===================================================== serviço: cobrança e aplicação de status
set local role service_role;
select lives_ok(format('select public.payments_attach_charge(%L, %L, %L, %L, now() + interval ''1 hour'', true)', :'o1', 'ch1', 'BRCODE1', 'B64'),
  'attach_charge grava a cobrança');
select throws_ok(format('select public.payments_attach_charge(%L, %L, %L, %L, now() + interval ''1 hour'', true)', :'o1', 'chOutra', 'B', 'B'),
  'MM005', null, 'attach_charge não troca a cobrança de um pedido');
select is(public.payments_apply_status(:'o1'::uuid, 'ch1', 'pago', 100, true, 'webhook') ->> 'applied', 'false', 'rejects_amount_mismatch: applied=false');
select is(public.payments_apply_status(:'o1'::uuid, 'ch1', 'pago', 8900, false, 'webhook') ->> 'applied', 'false', 'rejects_devmode_mismatch: applied=false');
select is(public.payments_apply_status(:'o1'::uuid, 'chX', 'pago', 8900, true, 'webhook') ->> 'applied', 'false', 'cobrança divergente: applied=false');
select throws_ok(format('select public.payments_apply_status(%L, %L, %L, %s, %L, %L)', :'o1', 'ch1', 'pago', 8900, true, 'manual'),
  'MM005', null, 'source fora de webhook|status|reconcile');
reset role;
select is((select count(*)::int from public.event_entitlements where order_id = :'o1'::uuid), 0, 'sem direito após divergências');
select is((select array_agg(outcome order by id) from public.payment_events where order_id = :'o1'::uuid),
  array['divergencia_valor', 'divergencia_ambiente', 'divergencia_cobranca'], 'outcome das divergências registrado');
select is((select status::text from public.payment_orders where id = :'o1'::uuid), 'pendente', 'attach_charge deixa o pedido pendente');

set local role service_role;
select public.payments_apply_status(:'o1'::uuid, 'ch1', 'pago', 8900, true, 'webhook') as a1 \gset
select is((:'a1'::jsonb) - 'entitlementId', '{"applied":true,"from":"pendente","to":"pago"}'::jsonb, 'apply_paid_grants: applied=true');
select is((public.payments_apply_status(:'o1'::uuid, 'ch1', 'pago', 8900, true, 'status') ->> 'applied'), 'false', 'repetir pago: no-op');
select is((public.payments_apply_status(:'o1'::uuid, 'ch1', 'expirado', 8900, true, 'reconcile') ->> 'applied'), 'false', 'pago → expirado: ignorada');
select is(public.payments_record_event('evt_1', 'transparent.completed', :'o1'::uuid, 'aplicado', '{"amount":8900}'), true, 'record_event grava');
select is(public.payments_record_event('evt_1', 'transparent.completed', :'o1'::uuid, 'aplicado', '{"amount":8900}'), false, 'record_event_dedup: duplicado → false');
select is(public.payments_record_event('evt_2', 'transparent.completed', null, 'sem_pedido',
  '{"amount":1,"payerName":"Fulano","customer":{"email":"a@b.c","taxId":"123"},"data":{"name":"Fulano","cpf":"1","status":"PAID"}}'), true, 'record_event sem pedido');
reset role;
select is((select detail from public.payment_events where provider_event_id = 'evt_2'), '{"amount":1,"data":{"status":"PAID"}}'::jsonb,
  'detail só com chaves permitidas (payerName, customer, email, taxId, name, cpf removidos)');
select is((select count(*)::int from public.event_entitlements where order_id = :'o1'::uuid), 1, 'um único direito por pedido');
select is((select (:'a1'::jsonb) ->> 'entitlementId'), (select id::text from public.event_entitlements where order_id = :'o1'::uuid), 'entitlementId devolvido');
select results_eq($$select source, status, env, plan_code from public.event_entitlements where order_id = '$$ || :'o1' || $$'$$,
  $$values ('pago', 'ativo', 'sandbox', 'celebracao')$$, 'direito pago ativo no ambiente do pedido');
select results_eq($$select capacity, shots_per_person from public.events where id = '00000000-0000-4000-8000-0000000008e1'$$,
  $$values (100, 24)$$, 'events.capacity = 100 e fotos = 24 após o pagamento');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000008e1')$$, $$values ('celebracao', 100, 24, 'pago')$$, 'plano efetivo = celebracao');
select ok(exists (select 1 from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000008e1' and action = 'payment.pago'
  and detail ->> 'orderId' = :'o1' and detail ->> 'plan' = 'celebracao' and (detail ->> 'amountCents')::int = 8900 and detail ->> 'env' = 'sandbox'),
  'auditoria payment.pago com orderId, plan, amountCents, env');
select ok(exists (select 1 from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000008e1' and action = 'payment.criado'), 'auditoria payment.criado');
select ok((select paid_at is not null from public.payment_orders where id = :'o1'::uuid), 'paid_at gravado');
select is((select array_agg(outcome order by id) from public.payment_events where order_id = :'o1'::uuid and provider_event_id is null),
  array['divergencia_valor', 'divergencia_ambiente', 'divergencia_cobranca', 'aplicado', 'duplicado', 'transicao_ignorada'],
  'cada aplicação registra o resultado; pago → expirado vira transicao_ignorada');
select throws_ok(format('insert into public.event_entitlements (event_id, plan_code, source, env, order_id) values (%L, %L, %L, %L, %L)',
  '00000000-0000-4000-8000-0000000008e1', 'festa', 'pago', 'sandbox', :'o1'), '23505', null, 'no máximo um direito por pedido');

-- upgrade: paga só a diferença; valor do pedido fica fixo na criação
select tests.login('00000000-0000-4000-8000-0000000008a1');
select is(public.payments_quote('00000000-0000-4000-8000-0000000008e1', 'casamento'),
  '{"planCode":"casamento","fromPlanCode":"celebracao","amountCents":10000,"payable":true,"reason":"ok"}'::jsonb,
  'quote_difference: celebracao pago → casamento = 10000');
select is(public.payments_quote('00000000-0000-4000-8000-0000000008e1', 'festa') ->> 'reason', 'ja_incluido', 'plano menor já incluído');
reset role;
update public.plans set price_cents = 8950 where code = 'casamento';
select tests.login('00000000-0000-4000-8000-0000000008a1');
select is(public.payments_quote('00000000-0000-4000-8000-0000000008e1', 'casamento') - 'fromPlanCode',
  '{"planCode":"casamento","amountCents":50,"payable":false,"reason":"valor_minimo"}'::jsonb,
  'diferença abaixo de 100 centavos: valor_minimo (não é ja_incluido)');
reset role;
update public.plans set price_cents = 18900 where code = 'casamento';
select tests.login('00000000-0000-4000-8000-0000000008a1');
select is(public.payments_order_status(:'o1'::uuid) ->> 'status', 'pago', 'order_status pago');
select ok(public.payments_order_status(:'o1'::uuid) ->> 'paidAt' is not null, 'order_status traz paidAt');
select is((select array_agg(k order by k) from jsonb_object_keys(public.payments_order_status(:'o1'::uuid)) k),
  array['amountCents', 'brCode', 'brCodeBase64', 'expiresAt', 'orderId', 'paidAt', 'planCode', 'status'], 'chaves de order_status');
select public.payments_open_order('00000000-0000-4000-8000-0000000008e1', 'casamento', '44444444-4444-4444-8444-444444444444') ->> 'orderId' as o1b \gset
reset role;
update public.plans set price_cents = 20000 where code = 'casamento';
select is((select amount_cents from public.payment_orders where id = :'o1b'::uuid), 10000, 'valor do pedido gravado na criação');
select is((select from_plan_code from public.payment_orders where id = :'o1b'::uuid), 'celebracao', 'from_plan_code gravado');
select tests.login('00000000-0000-4000-8000-0000000008a1');
select is((public.payments_order_status(:'o1b'::uuid) ->> 'amountCents')::int, 10000, 'mudança de preço não altera pedido existente');
reset role;
update public.plans set price_cents = 18900 where code = 'casamento';

-- ===================================================== pagamento tardio
select tests.login('00000000-0000-4000-8000-0000000008a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000008e2', 'festa', '55555555-5555-4555-8555-555555555555') ->> 'orderId' as o2 \gset
reset role;
set local role service_role;
select public.payments_attach_charge(:'o2'::uuid, 'ch2', 'B', 'B', now() + interval '1 hour', true);
select is(public.payments_apply_status(:'o2'::uuid, 'ch2', 'expirado', null, true, 'status') ->> 'to', 'expirado', 'pendente → expirado');
select is(public.payments_apply_status(:'o2'::uuid, 'ch2', 'pago', 2900, true, 'webhook') ->> 'applied', 'true', 'late_paid_after_expired: aplica');
reset role;
select results_eq($$select capacity, shots_per_person from public.events where id = '00000000-0000-4000-8000-0000000008e2'$$,
  $$values (30, 24)$$, 'pagamento tardio libera o plano');

-- pago tardio sobre evento que já tem plano igual ou maior → needs_refund, nenhum direito novo
select tests.login('00000000-0000-4000-8000-0000000008a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000008e3', 'festa', '66666666-6666-4666-8666-666666666666') ->> 'orderId' as o3 \gset
reset role;
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, reason)
  values ('00000000-0000-4000-8000-0000000008e3', 'casamento', 250, 36, 'cortesia', 'nenhum', 'cortesia de teste');
set local role service_role;
select public.payments_attach_charge(:'o3'::uuid, 'ch3', 'B', 'B', now() + interval '1 hour', true);
select public.payments_apply_status(:'o3'::uuid, 'ch3', 'expirado', null, true, 'status');
select public.payments_apply_status(:'o3'::uuid, 'ch3', 'pago', 2900, true, 'webhook') as a3 \gset
reset role;
select is((:'a3'::jsonb) ->> 'entitlementId', null, 'nenhum direito novo');
select results_eq(format('select status::text, needs_refund from public.payment_orders where id = %L', :'o3'),
  $$values ('pago', true)$$, 'pedido pago com needs_refund=true');
select is((select count(*)::int from public.event_entitlements where order_id = :'o3'::uuid), 0, 'sem direito para o pedido tardio');
select ok(exists (select 1 from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000008e3' and action = 'payment.pago'
  and (detail ->> 'needsRefund')::boolean), 'pagamento que precisa de reembolso auditado');

-- ===================================================== estorno
insert into public.participants (event_id, user_id, name)
  select '00000000-0000-4000-8000-0000000008e1', ('00000000-0000-4000-8000-0000000081' || lpad(g::text, 2, '0'))::uuid, 'Convidado ' || g
  from generate_series(1, 15) g;
set local role service_role;
select is(public.payments_apply_status(:'o1'::uuid, 'ch1', 'estornado', 8900, true, 'webhook') ->> 'applied', 'true', 'refund_reverts: pago → estornado aplica');
reset role;
select is((select status from public.event_entitlements where order_id = :'o1'::uuid), 'estornado', 'direito estornado');
select results_eq($$select * from tests.ent('00000000-0000-4000-8000-0000000008e1')$$, $$values ('gratis', 10, 10, 'gratis')$$,
  'effective_entitlement volta ao anterior');
select results_eq($$select capacity, shots_per_person from public.events where id = '00000000-0000-4000-8000-0000000008e1'$$,
  $$values (15, 10)$$, 'capacity nunca abaixo dos 15 participantes; fotos voltam ao plano');
select ok(exists (select 1 from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000008e1' and action = 'payment.estornado'),
  'auditoria payment.estornado');

-- disputa perdida também reverte
set local role service_role;
select is(public.payments_apply_status(:'o2'::uuid, 'ch2', 'em_disputa', 2900, true, 'webhook') ->> 'applied', 'true', 'pago → em_disputa');
reset role;
select results_eq($$select capacity from public.events where id = '00000000-0000-4000-8000-0000000008e2'$$, $$values (30)$$, 'disputa não tira o plano');
set local role service_role;
select is(public.payments_apply_status(:'o2'::uuid, 'ch2', 'perdido', 2900, true, 'webhook') ->> 'applied', 'true', 'em_disputa → perdido');
reset role;
select results_eq($$select capacity, shots_per_person from public.events where id = '00000000-0000-4000-8000-0000000008e2'$$,
  $$values (10, 10)$$, 'disputa perdida volta ao grátis');

-- ===================================================== pago em evento excluído (soft delete) ou encerrado
select tests.login('00000000-0000-4000-8000-0000000008a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000008e7', 'festa', 'a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7') ->> 'orderId' as o7 \gset
select public.payments_open_order('00000000-0000-4000-8000-0000000008e8', 'festa', 'a8a8a8a8-a8a8-4a8a-8a8a-a8a8a8a8a8a8') ->> 'orderId' as o8 \gset
reset role;
update public.events set deleted_at = now() where id = '00000000-0000-4000-8000-0000000008e7';
update public.events set start_at = now() - interval '10 hours' where id = '00000000-0000-4000-8000-0000000008e8';
set local role service_role;
select public.payments_attach_charge(:'o7'::uuid, 'ch7', 'B', 'B', now() + interval '1 hour', true);
select public.payments_attach_charge(:'o8'::uuid, 'ch8', 'B', 'B', now() + interval '1 hour', true);
select is(public.payments_apply_status(:'o7'::uuid, 'ch7', 'pago', 2900, true, 'webhook') - 'from', '{"applied":true,"to":"pago","entitlementId":null}'::jsonb,
  'pago em evento excluído: aplica sem direito');
select is(public.payments_apply_status(:'o8'::uuid, 'ch8', 'pago', 2900, true, 'webhook') - 'from', '{"applied":true,"to":"pago","entitlementId":null}'::jsonb,
  'pago em evento encerrado: aplica sem direito');
reset role;
select results_eq(format('select status::text, needs_refund from public.payment_orders where id in (%L, %L)', :'o7', :'o8'),
  $$values ('pago', true), ('pago', true)$$, 'excluído/encerrado: needs_refund=true');
select is((select count(*)::int from public.event_entitlements where order_id in (:'o7'::uuid, :'o8'::uuid)), 0, 'nenhum direito em evento excluído/encerrado');

-- ===================================================== estorno da base de um upgrade não é silencioso
select tests.login('00000000-0000-4000-8000-0000000008a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000008e6', 'celebracao', 'a6a6a6a6-a6a6-4a6a-8a6a-a6a6a6a6a6a6') ->> 'orderId' as o6 \gset
reset role;
set local role service_role;
select public.payments_attach_charge(:'o6'::uuid, 'ch6', 'B', 'B', now() + interval '1 hour', true);
select public.payments_apply_status(:'o6'::uuid, 'ch6', 'pago', 8900, true, 'webhook');
reset role;
select tests.login('00000000-0000-4000-8000-0000000008a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000008e6', 'casamento', 'b6b6b6b6-b6b6-4b6b-8b6b-b6b6b6b6b6b6') ->> 'orderId' as o6u \gset
reset role;
set local role service_role;
select public.payments_attach_charge(:'o6u'::uuid, 'ch6u', 'B', 'B', now() + interval '1 hour', true);
select is(public.payments_apply_status(:'o6u'::uuid, 'ch6u', 'pago', 10000, true, 'webhook') ->> 'applied', 'true', 'upgrade pago');
select is(public.payments_apply_status(:'o6'::uuid, 'ch6', 'estornado', 8900, true, 'webhook') ->> 'applied', 'true', 'base do upgrade estornada');
reset role;
select is((select count(*)::int from public.payment_events where order_id = :'o6u'::uuid and outcome = 'upgrade_base_estornado'), 1,
  'upgrade_base_estornado registrado no pedido de upgrade');
select ok(exists (select 1 from public.audit_logs where event_id = '00000000-0000-4000-8000-0000000008e6' and action = 'payment.upgrade_base_estornado'
  and detail ->> 'orderId' = :'o6u' and detail ->> 'baseOrderId' = :'o6'), 'auditoria do upgrade com base estornada');
select is((select status from public.event_entitlements where order_id = :'o6u'::uuid), 'ativo', 'direito do upgrade não é revogado aqui (Task 7)');

-- ===================================================== pedido vencido por tempo não está aberto
select tests.login('00000000-0000-4000-8000-0000000008a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000008e4', 'festa', '77777777-7777-4777-8777-777777777777') ->> 'orderId' as o4 \gset
reset role;
set local role service_role;
select public.payments_attach_charge(:'o4'::uuid, 'ch4', 'B', 'B', now() - interval '1 minute', true);
reset role;
select tests.login('00000000-0000-4000-8000-0000000008a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000008e4', 'celebracao', '88888888-8888-4888-8888-888888888888') ->> 'orderId' as o4n \gset
select isnt(:'o4n'::text, :'o4'::text, 'Pix vencido não bloqueia outro plano: novo pedido');
reset role;
select is((select status::text from public.payment_orders where id = :'o4'::uuid), 'expirado', 'pedido vencido marcado expirado');

-- PAID reconsultado em pedido cancelado: transição ignorada, mas dinheiro recebido vira needs_refund
set local role service_role;
select public.payments_attach_charge(:'o4n'::uuid, 'ch4n', 'B', 'B', now() + interval '1 hour', true);
select public.payments_apply_status(:'o4n'::uuid, 'ch4n', 'cancelado', null, true, 'status');
select is(public.payments_apply_status(:'o4n'::uuid, 'ch4n', 'pago', 8900, true, 'reconcile') ->> 'applied', 'false', 'cancelado → pago não aplica');
reset role;
select results_eq(format('select status::text, needs_refund from public.payment_orders where id = %L', :'o4n'),
  $$values ('cancelado', true)$$, 'pago sobre cancelado: needs_refund=true');
select is((select outcome from public.payment_events where order_id = :'o4n'::uuid order by id desc limit 1), 'pago_ignorado_reembolsar',
  'outcome pago_ignorado_reembolsar');
select is((select count(*)::int from public.event_entitlements where order_id = :'o4n'::uuid), 0, 'sem direito');

-- ===================================================== purga do evento não apaga pedidos
select tests.login('00000000-0000-4000-8000-0000000008a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000008e9', 'festa', 'a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9') ->> 'orderId' as o9 \gset
reset role;
set local role service_role;
select public.payments_attach_charge(:'o9'::uuid, 'ch9', 'B', 'B', now() + interval '1 hour', true);
reset role;
delete from public.events where id in ('00000000-0000-4000-8000-0000000008e3', '00000000-0000-4000-8000-0000000008e6', '00000000-0000-4000-8000-0000000008e9');
select results_eq(format('select status::text, needs_refund, event_id from public.payment_orders where id in (%L, %L, %L, %L) order by amount_cents, status',
    :'o3', :'o6u', :'o6', :'o9'),
  $$values ('pago', true, null::uuid), ('pendente', false, null::uuid), ('estornado', false, null::uuid), ('pago', false, null::uuid)$$,
  'pedidos sobrevivem à purga com event_id null (pago, needs_refund, estornado, pendente)');
select is((select provider_charge_id from public.payment_orders where id = :'o3'::uuid), 'ch3', 'charge id preservado');
set local role service_role;
select is(public.payments_apply_status(:'o6u'::uuid, 'ch6u', 'estornado', 10000, true, 'webhook') ->> 'applied', 'true', 'estorno aplica após a purga');
select is(public.payments_apply_status(:'o3'::uuid, 'ch3', 'estornado', 2900, true, 'webhook') ->> 'applied', 'true', 'estorno do needs_refund após a purga');
select is(public.payments_apply_status(:'o9'::uuid, 'ch9', 'pago', 2900, true, 'webhook') - 'from', '{"applied":true,"to":"pago","entitlementId":null}'::jsonb,
  'pago em pedido sem evento: aplica sem direito');
reset role;
select results_eq(format('select status::text, needs_refund from public.payment_orders where id in (%L, %L, %L) order by amount_cents, status', :'o3', :'o9', :'o6u'),
  $$values ('estornado', false), ('pago', true), ('estornado', false)$$, 'estados após a purga; pago sem evento → needs_refund');

-- ===================================================== plano inativo no ambiente; pedido aberto de outro ambiente
select tests.login('00000000-0000-4000-8000-0000000008a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000008e2', 'festa', 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2') ->> 'orderId' as o2s \gset
reset role;
select tests.set_env('production');
update public.plans set production_active = false where code = 'grande';
select tests.login('00000000-0000-4000-8000-0000000008a1');
select is(public.payments_quote('00000000-0000-4000-8000-0000000008e2', 'grande') - 'amountCents' - 'fromPlanCode',
  '{"planCode":"grande","payable":false,"reason":"plano_inativo"}'::jsonb, 'quote_inactive_plan: plano_inativo');
select throws_ok($$select public.payments_open_order('00000000-0000-4000-8000-0000000008e2', 'grande', gen_random_uuid())$$,
  'MM014', 'pagamentoindisponivel', 'plano inativo não abre pedido');
select is((public.payments_open_order('00000000-0000-4000-8000-0000000008e2', 'festa', gen_random_uuid()) ->> 'amountCents')::int, 2900,
  'pedido em produção');
reset role;
select is((select provider_env from public.payment_orders where event_id = '00000000-0000-4000-8000-0000000008e2' and status = 'criado'),
  'production', 'provider_env = payments_env() na criação');
select is((select provider_env from public.payment_orders where id = :'o2'::uuid), 'sandbox', 'pedido anterior segue sandbox');
select is((select status::text from public.payment_orders where id = :'o2s'::uuid), 'cancelado', 'pedido aberto de outro ambiente não é reusado: cancelado');
select ok(exists (select 1 from public.audit_logs where action = 'payment.cancelado' and detail ->> 'orderId' = :'o2s'), 'cancelamento auditado');

select * from finish();
rollback;
