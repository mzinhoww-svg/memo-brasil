-- pgTAP · migração AbacatePay → Mercado Pago (Checkout Pro por Preferences) + regressão PAY-001…PAY-005.
-- Toda a decisão financeira vive em SQL: payments_apply_payment recebe o pagamento já normalizado (id, status, valor em
-- centavos, moeda, live_mode, recebedor, external_reference, data de atualização, reembolsado) e o recebedor esperado.
-- Valores fictícios; nenhum acesso a rede.
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
-- n-ésimo evento / pedido; instante base fixo + n minutos (para ordenar notificações)
create function tests.ev(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-0000000011' || lpad(n::text, 2, '0'))::uuid $$;
create function tests.od(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-0000000012' || lpad(n::text, 2, '0'))::uuid $$;
create function tests.t(n int) returns timestamptz language sql immutable as $$ select timestamptz '2026-10-23 12:00:00+00' + make_interval(mins => n) $$;
create function tests.o(n int, p_status text default 'pendente', p_provider text default 'mercadopago',
                        p_age interval default '10 minutes') returns uuid language plpgsql as $$
begin
  insert into public.payment_orders (id, event_id, host_id, plan_code, from_plan_code, amount_cents, status, provider, provider_env,
                                     idempotency_key, mp_preference_id, checkout_url, expires_at, created_at)
  values (tests.od(n), tests.ev(n), '00000000-0000-4000-8000-0000000011a1', 'festa', 'gratis', 2900, p_status::public.payment_status,
          p_provider, 'sandbox', gen_random_uuid(),
          case when p_provider = 'mercadopago' and p_status <> 'criado' then 'pref-' || n end,
          case when p_provider = 'mercadopago' and p_status <> 'criado' then 'https://mp.test/checkout?pref=' || n end,
          now() + interval '1 hour', now() - p_age);
  return tests.od(n);
end $$;
create function tests.p(p_order uuid, p_id text, p_status text, p_amount int default 2900, p_at timestamptz default tests.t(0),
                        p_ref int default 0, p_live boolean default false, p_coll text default '900', p_cur text default 'BRL',
                        p_ext text default null) returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'status', p_status, 'amountCents', p_amount, 'currency', p_cur, 'liveMode', p_live,
    'collectorId', p_coll, 'externalReference', coalesce(p_ext, p_order::text), 'method', 'pix', 'updatedAt', p_at, 'refundedCents', p_ref)
$$;
create function tests.ap(p_order uuid, p jsonb) returns jsonb language sql as $$
  select public.payments_apply_payment(p_order, p, '900', 'webhook')
$$;
create function tests.ent(p_event uuid) returns text language sql as $$
  select string_agg(source || ':' || status, ',') from public.event_entitlements where event_id = p_event and source = 'pago'
$$;
create function tests.nev(p_order uuid) returns bigint language sql as $$
  select count(*) from public.payment_events where order_id = p_order
$$;
create function tests.oc(p_order uuid, p_outcome text) returns bigint language sql as $$
  select count(*) from public.payment_events where order_id = p_order and outcome = p_outcome
$$;
grant usage on schema tests to authenticated, service_role;
grant execute on all functions in schema tests to authenticated, service_role;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000011a1', 'authenticated', 'authenticated', 'host11@test.local', false),
  ('00000000-0000-4000-8000-0000000011c1', 'authenticated', 'authenticated', 'master11@test.local', false),
  ('00000000-0000-4000-8000-0000000011a2', 'authenticated', 'authenticated', 'outro11@test.local', false);
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000011%' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000011c1', 'master');
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, start_at)
  select tests.ev(g), 'Evento ' || g, 'festa', '00000000-0000-4000-8000-0000000011a1', 'H', 6, 10, 10, now() from generate_series(1, 40) g;
select tests.set_env('sandbox');

-- ===================================================== estrutura
select has_column('public', 'payment_orders', 'mp_preference_id', 'mp_preference_id');
select has_column('public', 'payment_orders', 'mp_payment_id', 'mp_payment_id');
select has_column('public', 'payment_orders', 'checkout_url', 'checkout_url');
select has_column('public', 'payment_orders', 'payment_method', 'payment_method');
select has_table('public', 'payment_charges', 'payment_charges existe');
select has_function('public', 'payments_apply_payment', array['uuid', 'jsonb', 'text', 'text'], 'payments_apply_payment');
select has_function('public', 'admin_clear_needs_refund', array['uuid', 'text'], 'admin_clear_needs_refund (PAY-002)');
select throws_ok($$insert into public.payment_orders (event_id, host_id, plan_code, amount_cents, provider, provider_env, idempotency_key)
  values (tests.ev(40), '00000000-0000-4000-8000-0000000011a1', 'festa', 2900, 'pagseguro', 'sandbox', gen_random_uuid())$$,
  '23514', null, 'provider só abacatepay|mercadopago');
select is((select column_default from information_schema.columns where table_name = 'payment_orders' and column_name = 'provider'),
  '''mercadopago''::text', 'pedido novo nasce mercadopago');

-- ===================================================== privilégios: cliente não chama RPC de serviço
select tests.login('00000000-0000-4000-8000-0000000011a1');
select throws_ok(format('select public.payments_apply_payment(%L, %L::jsonb, %L, %L)', tests.od(1), '{}', '900', 'webhook'),
  '42501', null, 'cliente não chama apply_payment');
select throws_ok($$select public.payments_attach_preference(tests.od(1), 'x', 'https://x', now())$$, '42501', null, 'cliente não chama attach_preference');
select throws_ok($$select * from public.payments_reconcile_candidates('sandbox', 5)$$, '42501', null, 'cliente não chama reconcile_candidates');
reset role;

-- ===================================================== abertura de pedido e anexo da preferência
select tests.login('00000000-0000-4000-8000-0000000011a1');
select public.payments_open_order(tests.ev(1), 'festa', '11111111-1111-4111-8111-111111111111') as r1 \gset
reset role;
select (:'r1'::jsonb) ->> 'orderId' as o1 \gset
select is((:'r1'::jsonb) - 'orderId',
  '{"status":"criado","amountCents":2900,"checkoutUrl":null,"expiresAt":null,"provider":"mercadopago","paymentMethod":null,"reused":false}'::jsonb,
  'open_order: contrato OrderView (sem brCode)');
select is((select provider from public.payment_orders where id = :'o1'::uuid), 'mercadopago', 'pedido aberto é mercadopago');
set local role service_role;
select lives_ok(format('select public.payments_attach_preference(%L, %L, %L, %L)', :'o1', 'pref-1', 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1', now() + interval '1 hour'),
  'attach_preference');
select lives_ok(format('select public.payments_attach_preference(%L, %L, %L, %L)', :'o1', 'pref-1', 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1', now() + interval '1 hour'),
  'attach repetido: idempotente');
select lives_ok(format('select public.payments_attach_preference(%L, %L, %L, %L)', :'o1', 'pref-OUTRA', 'https://outra.test/', now() + interval '1 hour'),
  'segunda preferência (corrida): não troca a primeira');
reset role;
select is((select mp_preference_id from public.payment_orders where id = :'o1'::uuid), 'pref-1', 'preferência original mantida');
select is((select status::text from public.payment_orders where id = :'o1'::uuid), 'pendente', 'attach → pendente');
select tests.login('00000000-0000-4000-8000-0000000011a1');
select is(public.payments_open_order(tests.ev(1), 'festa', '11111111-1111-4111-8111-111111111111') ->> 'reused', 'true', 'mesma chave: reusa');
select is((select array_agg(k order by k) from jsonb_object_keys(public.payments_order_status(:'o1'::uuid)) k),
  array['amountCents', 'checkoutUrl', 'expiresAt', 'orderId', 'paidAt', 'paymentMethod', 'planCode', 'provider', 'status'],
  'order_status: chaves do OrderView');
select is(public.payments_order_status(:'o1'::uuid) ->> 'provider', 'mercadopago', 'order_status.provider');
reset role;

-- ===================================================== pagamento aprovado: libera, ordem de eventos, duplicados
select tests.o(2);
set local role service_role;
select is(tests.ap(tests.od(2), tests.p(tests.od(2), '5001', 'pending', 2900, tests.t(1))) ->> 'applied', 'false', 'pending em pedido pendente: sem mudança');
select is(tests.ap(tests.od(2), tests.p(tests.od(2), '5001', 'approved', 2900, tests.t(3))) ->> 'applied', 'true', 'approved válido: aplicado');
reset role;
select is((select status::text from public.payment_orders where id = tests.od(2)), 'pago', 'pedido pago');
select is((select mp_payment_id from public.payment_orders where id = tests.od(2)), '5001', 'mp_payment_id vinculado');
select is(tests.ent(tests.ev(2)), 'pago:ativo', 'direito pago concedido');
select ok((select capacity from public.events where id = tests.ev(2)) = 30, 'limites do plano aplicados ao evento');
select is((select needs_refund from public.payment_orders where id = tests.od(2)), false, 'sem needs_refund');
select tests.nev(tests.od(2)) as n_before \gset
set local role service_role;
select is(tests.ap(tests.od(2), tests.p(tests.od(2), '5001', 'approved', 2900, tests.t(3))) ->> 'applied', 'false', 'notificação duplicada: no-op');
select is(tests.ap(tests.od(2), tests.p(tests.od(2), '5001', 'approved', 2900, tests.t(3))) ->> 'applied', 'false', 'duplicada de novo');
-- fora de ordem: 'pending' (t=1... já visto) com data anterior à gravada é ignorado e não regride o pedido
select is(tests.ap(tests.od(2), tests.p(tests.od(2), '5001', 'pending', 2900, tests.t(2))) ->> 'applied', 'false', 'fora de ordem (mais antiga): ignorada');
reset role;
select is((select status::text from public.payment_orders where id = tests.od(2)), 'pago', 'fora de ordem não regride');
select is(tests.ent(tests.ev(2)), 'pago:ativo', 'direito segue único');
select is(tests.nev(tests.od(2)) - :n_before::bigint, 1::bigint, 'PAY-004: duplicados não regravam payment_events (só o obsoleto, 1 vez)');
select is(tests.oc(tests.od(2), 'obsoleto'), 1::bigint, 'fora de ordem registrado como obsoleto');
select is((select count(*) from public.payment_charges where order_id = tests.od(2) and role = 'primary'), 1::bigint, 'um pagamento primário');

-- ===================================================== divergências: identidade, valor, moeda, recebedor, ambiente
select tests.o(3); select tests.o(4); select tests.o(5); select tests.o(6); select tests.o(7);
set local role service_role;
select is(tests.ap(tests.od(3), tests.p(tests.od(3), '5103', 'approved', 2900, tests.t(1), 0, false, '900', 'BRL', tests.od(4)::text)) ->> 'applied', 'false', 'external_reference de outro pedido: recusa');
select is(tests.ap(tests.od(4), tests.p(tests.od(4), '5104', 'approved', 100)) ->> 'applied', 'false', 'valor divergente: recusa');
select is(tests.ap(tests.od(5), tests.p(tests.od(5), '5105', 'approved', 2900, tests.t(1), 0, false, '900', 'USD')) ->> 'applied', 'false', 'moeda divergente: recusa');
select is(tests.ap(tests.od(6), tests.p(tests.od(6), '5106', 'approved', 2900, tests.t(1), 0, false, '777')) ->> 'applied', 'false', 'recebedor divergente: recusa');
select is(tests.ap(tests.od(7), tests.p(tests.od(7), '5107', 'approved', 2900, tests.t(1), 0, true)) ->> 'applied', 'false', 'live_mode em sandbox: recusa');
select is(public.payments_apply_payment(tests.od(7), tests.p(tests.od(7), '5108', 'approved'), null, 'webhook') ->> 'applied', 'false', 'sem recebedor esperado: recusa');
reset role;
select is(tests.oc(tests.od(3), 'divergencia_cobranca'), 1::bigint, 'outcome divergencia_cobranca (identidade)');
select is(tests.oc(tests.od(4), 'divergencia_valor'), 1::bigint, 'outcome divergencia_valor');
select is(tests.oc(tests.od(5), 'divergencia_moeda'), 1::bigint, 'outcome divergencia_moeda');
select is(tests.oc(tests.od(6), 'divergencia_recebedor'), 1::bigint, 'outcome divergencia_recebedor');
select is(tests.oc(tests.od(7), 'divergencia_ambiente'), 1::bigint, 'outcome divergencia_ambiente (live_mode em sandbox)');
select is(tests.oc(tests.od(7), 'divergencia_recebedor'), 1::bigint, 'recebedor esperado ausente: divergencia_recebedor');
select is((select array_agg(status::text order by id) from public.payment_orders where id in (tests.od(3), tests.od(4), tests.od(5), tests.od(6), tests.od(7))),
  array['pendente', 'pendente', 'pendente', 'pendente', 'pendente'], 'nenhum virou pago');
select is(tests.ent(tests.ev(4)) is null and tests.ent(tests.ev(5)) is null and tests.ent(tests.ev(6)) is null and tests.ent(tests.ev(7)) is null,
  true, 'nenhuma divergência libera plano');
select is((select needs_refund from public.payment_orders where id = tests.od(4)), true, 'valor divergente aprovado: needs_refund');
select is((select role from public.payment_charges where payment_id = '5104'), 'extra', 'cobrança divergente é extra');
select is((select needs_refund from public.payment_orders where id = tests.od(3)), false, 'identidade de outro pedido não marca este pedido');

-- ===================================================== PAY-001: duas cobranças aprovadas para o mesmo pedido
select tests.o(8);
set local role service_role;
select is(tests.ap(tests.od(8), tests.p(tests.od(8), '6001', 'approved', 2900, tests.t(1))) ->> 'applied', 'true', 'primeira cobrança paga o pedido');
select is(tests.ap(tests.od(8), tests.p(tests.od(8), '6002', 'approved', 2900, tests.t(2))) ->> 'applied', 'false', 'segunda cobrança aprovada: não é aplicada');
reset role;
select is((select status::text from public.payment_orders where id = tests.od(8)), 'pago', 'pedido segue pago');
select is((select mp_payment_id from public.payment_orders where id = tests.od(8)), '6001', 'vínculo segue na primeira');
select is((select needs_refund from public.payment_orders where id = tests.od(8)), true, 'dinheiro em duplicidade: needs_refund');
select is(tests.oc(tests.od(8), 'pagamento_duplicado'), 1::bigint, 'outcome pagamento_duplicado');
select is(tests.ent(tests.ev(8)), 'pago:ativo', 'um único direito');
set local role service_role;
select is((select payment_id || ':' || kind from public.payments_refund_target(tests.od(8))), '6001:primary', 'PAY-001: alvo padrão do pedido pago é o vinculado');
select is((select payment_id || ':' || kind from public.payments_refund_target(tests.od(8), '6002')), '6002:extra', 'PAY-001: a divergente só por pedido explícito');
select throws_ok(format('select * from public.payments_refund_target(%L, %L)', tests.od(8), '9999'), 'MM005', null, 'PAY-001: pagamento desconhecido recusado');
select throws_ok(format('select * from public.payments_refund_target(%L, %L)', tests.od(8), '5001'), 'MM005', null, 'PAY-001: pagamento de outro pedido recusado');
reset role;
select tests.login('00000000-0000-4000-8000-0000000011c1', 'master');
select lives_ok(format('select public.admin_request_payment_refund(%L, %L, %L)', tests.od(8), '6002', 'devolver cobranca em duplicidade'),
  'Master solicita reembolso da duplicada');
select throws_ok(format('select public.admin_request_payment_refund(%L, %L, %L)', tests.od(8), '6002', 'devolver cobranca em duplicidade'),
  'MM005', null, 'repetição da solicitação: recusada (sem reembolso duplo)');
select throws_ok(format('select public.admin_request_payment_refund(%L, %L, %L)', tests.od(8), '6002', 'curto'), 'MM011', null, 'motivo obrigatório');
reset role;
select is((select refund_requested_at is null from public.payment_orders where id = tests.od(8)), true, 'PAY-001: pedido (vinculado) NÃO ficou marcado para reembolso');
select is((select refund_requested_at is not null from public.payment_charges where payment_id = '6002'), true, 'solicitação gravada na cobrança duplicada');
set local role service_role;
select tests.ap(tests.od(8), tests.p(tests.od(8), '6002', 'refunded', 2900, tests.t(5), 2900));
reset role;
select is((select needs_refund from public.payment_orders where id = tests.od(8)), false, 'duplicada reembolsada: needs_refund limpo');
select is((select status::text from public.payment_orders where id = tests.od(8)), 'pago', 'pedido segue pago');
select is(tests.ent(tests.ev(8)), 'pago:ativo', 'direito segue ativo');
-- reembolso padrão de pedido pago mira o vinculado
select tests.login('00000000-0000-4000-8000-0000000011c1', 'master');
select lives_ok(format('select public.admin_request_refund(%L, %L)', tests.od(8), 'cliente pediu cancelamento'), 'admin_request_refund no pedido pago');
reset role;
select is((select refund_requested_at is not null from public.payment_orders where id = tests.od(8)), true, 'reembolso padrão marca o pedido (vinculado)');

-- ===================================================== PAY-002: needs_refund limpo por RPC Master auditada
select tests.o(9, 'cancelado');
set local role service_role;
select is(tests.ap(tests.od(9), tests.p(tests.od(9), '7001', 'approved', 2900, tests.t(1))) ->> 'applied', 'false', 'pago após cancelamento: não libera');
reset role;
select is((select needs_refund from public.payment_orders where id = tests.od(9)), true, 'pago após cancelamento: needs_refund');
select is(tests.oc(tests.od(9), 'pago_ignorado_reembolsar'), 1::bigint, 'outcome pago_ignorado_reembolsar');
select is(tests.ent(tests.ev(9)) is null, true, 'sem direito');
select tests.login('00000000-0000-4000-8000-0000000011a1');
select throws_ok(format('select public.admin_clear_needs_refund(%L, %L)', tests.od(9), 'reembolsado no painel do MP'), 'MM004', null, 'PAY-002: não-master recusado');
reset role;
select tests.login('00000000-0000-4000-8000-0000000011c1', 'master');
select throws_ok(format('select public.admin_clear_needs_refund(%L, %L)', tests.od(9), 'curto'), 'MM011', null, 'PAY-002: motivo obrigatório');
select ok((select count(*) from public.admin_payment_divergences() d where d ->> 'orderId' = tests.od(9)::text) > 0, 'divergência visível antes de tratar');
select lives_ok(format('select public.admin_clear_needs_refund(%L, %L)', tests.od(9), 'reembolsado no painel do MP'), 'PAY-002: Master limpa com motivo');
select is((select count(*) from public.admin_payment_divergences() d where d ->> 'orderId' = tests.od(9)::text), 0::bigint, 'PAY-002: some do Master depois de tratada');
reset role;
select is((select needs_refund from public.payment_orders where id = tests.od(9)), false, 'PAY-002: needs_refund limpo');
select is((select count(*) from public.audit_logs where action = 'payment.needs_refund_cleared' and target_id = tests.od(9)::text and reason = 'reembolsado no painel do MP'),
  1::bigint, 'PAY-002: auditado com motivo');
select tests.login('00000000-0000-4000-8000-0000000011c1', 'master');
select throws_ok(format('select public.admin_clear_needs_refund(%L, %L)', tests.od(2), 'nada a limpar aqui'), 'MM005', null, 'sem pendência: MM005');
reset role;

-- ===================================================== PAY-003: waiver de valor só para pedido ainda não pago
-- histórico AbacatePay: pedido pago + needs_refund NÃO aceita estorno com valor diferente
insert into public.payment_orders (id, event_id, host_id, plan_code, from_plan_code, amount_cents, status, provider, provider_env, provider_charge_id,
                                   idempotency_key, needs_refund, paid_at)
values (tests.od(10), tests.ev(10), '00000000-0000-4000-8000-0000000011a1', 'festa', 'gratis', 2900, 'pago', 'abacatepay', 'sandbox', 'abc_ch_10',
        gen_random_uuid(), true, now()),
       (tests.od(11), tests.ev(11), '00000000-0000-4000-8000-0000000011a1', 'festa', 'gratis', 2900, 'cancelado', 'abacatepay', 'sandbox', 'abc_ch_11',
        gen_random_uuid(), true, null);
set local role service_role;
select is(public.payments_apply_status(tests.od(10), 'abc_ch_10', 'estornado', 100, true, 'webhook') ->> 'applied', 'false', 'PAY-003: pago não aceita waiver de valor');
select is(public.payments_apply_status(tests.od(11), 'abc_ch_11', 'estornado', 100, true, 'webhook') ->> 'applied', 'true', 'waiver segue valendo para não pago com needs_refund');
reset role;
select is((select status::text from public.payment_orders where id = tests.od(10)), 'pago', 'PAY-003: pedido pago intacto');
select is((select status::text from public.payment_orders where id = tests.od(11)), 'estornado', 'não pago: estorno fecha');
-- MP: primário reembolsado com valor diferente não passa
select tests.o(12);
set local role service_role;
select tests.ap(tests.od(12), tests.p(tests.od(12), '8001', 'approved', 2900, tests.t(1)));
select is(tests.ap(tests.od(12), tests.p(tests.od(12), '8001', 'refunded', 100, tests.t(2), 100)) ->> 'applied', 'false', 'PAY-003 (MP): primário reembolsado com valor divergente: recusado');
reset role;
select is((select status::text from public.payment_orders where id = tests.od(12)), 'pago', 'PAY-003 (MP): segue pago');
-- legado segue reembolsável pelo alvo padrão (provider_charge_id) e nunca por id inventado
set local role service_role;
select is((select payment_id || ':' || kind from public.payments_refund_target(tests.od(10))), 'abc_ch_10:primary', 'histórico: alvo é provider_charge_id');
select throws_ok(format('select * from public.payments_refund_target(%L, %L)', tests.od(10), 'outra'), 'MM005', null, 'histórico: id inventado recusado (PAY-001)');
reset role;

-- ===================================================== pagamento após expiração, cancelamento e substituição
select tests.o(13, 'expirado');
select tests.o(14, 'cancelado');
select tests.o(15, 'expirado');
set local role service_role;
select is(tests.ap(tests.od(13), tests.p(tests.od(13), '9001', 'approved')) ->> 'applied', 'true', 'pago depois de expirado: libera');
select is(tests.ap(tests.od(14), tests.p(tests.od(14), '9002', 'approved')) ->> 'applied', 'false', 'pago depois de cancelado: não libera');
reset role;
select is(tests.ent(tests.ev(13)), 'pago:ativo', 'expirado+pago: direito');
select is(tests.ent(tests.ev(14)) is null and (select needs_refund from public.payment_orders where id = tests.od(14)), true, 'cancelado+pago: sem direito e needs_refund');
-- substituição: um segundo pedido do mesmo evento já foi pago; o antigo (expirado) recebe pagamento depois
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, reason)
  select tests.ev(15), 'festa', 30, 24, 'cortesia', 'nenhum', 'cortesia no meio';
set local role service_role;
select is(tests.ap(tests.od(15), tests.p(tests.od(15), '9003', 'approved')) ->> 'applied', 'true', 'substituído: pedido fica pago');
reset role;
select is(tests.ent(tests.ev(15)) is null, true, 'substituído: sem direito novo (plano já coberto)');
select is((select needs_refund from public.payment_orders where id = tests.od(15)), true, 'substituído: needs_refund');

-- ===================================================== reembolso total/parcial, repetição, disputa
select tests.o(16);
set local role service_role;
select tests.ap(tests.od(16), tests.p(tests.od(16), '4001', 'approved', 2900, tests.t(1)));
select is(tests.ap(tests.od(16), tests.p(tests.od(16), '4001', 'approved', 2900, tests.t(2), 1000)) ->> 'applied', 'false', 'parcial: não muda o estado');
reset role;
select is((select status::text from public.payment_orders where id = tests.od(16)), 'pago', 'parcial: segue pago');
select is((select refunded_cents from public.payment_orders where id = tests.od(16)), 1000, 'parcial: refunded_cents');
select is(tests.ent(tests.ev(16)), 'pago:ativo', 'parcial: direito mantido');
select is(tests.oc(tests.od(16), 'reembolso_parcial'), 1::bigint, 'parcial registrado');
set local role service_role;
select tests.ap(tests.od(16), tests.p(tests.od(16), '4001', 'approved', 2900, tests.t(2), 1000));
reset role;
select is(tests.oc(tests.od(16), 'reembolso_parcial'), 1::bigint, 'parcial repetido: não regrava');
select tests.login('00000000-0000-4000-8000-0000000011c1', 'master');
select throws_ok(format('select public.admin_request_payment_refund(%L, %L, %L, %s)', tests.od(16), '4001', 'devolver o restante a mais', 2000), 'MM005', null, 'parcial acima do saldo: recusado');
select lives_ok(format('select public.admin_request_payment_refund(%L, %L, %L, %s)', tests.od(16), '4001', 'devolver parte ao cliente', 1500), 'parcial dentro do saldo');
select throws_ok(format('select public.admin_request_payment_refund(%L, %L, %L, %s)', tests.od(16), '4001', 'devolver parte ao cliente', 1500), 'MM005', null, 'repetição da parcial: recusada');
reset role;
select is((select refund_amount_cents from public.payment_orders where id = tests.od(16)), 1500, 'valor parcial solicitado gravado');
set local role service_role;
select tests.ap(tests.od(16), tests.p(tests.od(16), '4001', 'approved', 2900, tests.t(3), 2500));
reset role;
select is((select refund_requested_at is null and refund_amount_cents is null from public.payment_orders where id = tests.od(16)), true, 'parcial concluída: libera nova solicitação');
set local role service_role;
select is(tests.ap(tests.od(16), tests.p(tests.od(16), '4001', 'refunded', 2900, tests.t(4), 2900)) ->> 'applied', 'true', 'reembolso total: estornado');
select is(tests.ap(tests.od(16), tests.p(tests.od(16), '4001', 'refunded', 2900, tests.t(4), 2900)) ->> 'applied', 'false', 'reembolso total repetido: no-op');
reset role;
select is((select status::text from public.payment_orders where id = tests.od(16)), 'estornado', 'estornado');
select is(tests.ent(tests.ev(16)), 'pago:estornado', 'direito estornado');
select ok((select capacity from public.events where id = tests.ev(16)) <= 10, 'limites reaplicados após estorno');
-- Pix em processamento: pedido segue pago até chegar 'refunded'
select tests.o(17);
set local role service_role;
select tests.ap(tests.od(17), tests.p(tests.od(17), '4101', 'approved', 2900, tests.t(1)));
reset role;
select tests.login('00000000-0000-4000-8000-0000000011c1', 'master');
select lives_ok(format('select public.admin_request_refund(%L, %L)', tests.od(17), 'pix devolvido ao cliente'), 'pedido solicita reembolso total');
reset role;
select is((select status::text from public.payment_orders where id = tests.od(17)), 'pago', 'reembolso solicitado: segue pago até confirmar');
-- disputa
select tests.o(18);
set local role service_role;
select tests.ap(tests.od(18), tests.p(tests.od(18), '4201', 'approved', 2900, tests.t(1)));
select is(tests.ap(tests.od(18), tests.p(tests.od(18), '4201', 'in_mediation', 2900, tests.t(2))) ->> 'to', 'em_disputa', 'in_mediation → em_disputa');
select is(tests.ap(tests.od(18), tests.p(tests.od(18), '4201', 'approved', 2900, tests.t(3))) ->> 'to', 'pago', 'disputa ganha → pago');
select tests.ap(tests.od(18), tests.p(tests.od(18), '4201', 'in_mediation', 2900, tests.t(4)));
select is(tests.ap(tests.od(18), tests.p(tests.od(18), '4201', 'charged_back', 2900, tests.t(5))) ->> 'to', 'perdido', 'charged_back → perdido');
reset role;
select is(tests.ent(tests.ev(18)), 'pago:estornado', 'perdido revoga o direito');
-- tentativa recusada não muda nada
select tests.o(19);
set local role service_role;
select is(tests.ap(tests.od(19), tests.p(tests.od(19), '4301', 'rejected', 2900, tests.t(1))) ->> 'applied', 'false', 'rejected: tentativa, sem efeito');
select is(tests.ap(tests.od(19), tests.p(tests.od(19), '4302', 'approved', 2900, tests.t(2))) ->> 'applied', 'true', 'nova tentativa aprovada paga o mesmo pedido');
reset role;
select is((select status::text from public.payment_orders where id = tests.od(19)), 'pago', 'rejected seguido de approved: pago');

-- ===================================================== eventos do provedor (deduplicação)
set local role service_role;
select is(public.payments_record_event('mercadopago', 'mp:payment:5001:payment.updated:x1', 'payment.updated', tests.od(2), 'recebido', '{"dataId":"5001"}'), true, 'record_event grava');
select is(public.payments_record_event('mercadopago', 'mp:payment:5001:payment.updated:x1', 'payment.updated', tests.od(2), 'recebido', '{"dataId":"5001"}'), false, 'record_event dedup');
select is(public.payments_record_event('abacatepay', 'mp:payment:5001:payment.updated:x1', 'x', null, 'recebido', '{}'), true, 'provedor distinto não colide');
reset role;

-- ===================================================== PAY-004: conciliação com teto de idade, sem regravar eventos
select tests.o(20, 'pendente', 'mercadopago', '8 days');
select tests.o(21, 'pendente', 'mercadopago', '10 minutes');
select tests.o(22, 'expirado', 'mercadopago', '2 days');
select tests.o(23, 'expirado', 'mercadopago', '9 days');
select tests.o(24, 'pendente', 'mercadopago', '20 minutes');
update public.payment_orders set last_checked_at = now() where id = tests.od(24);
select tests.o(25, 'pendente', 'abacatepay', '10 minutes');
set local role service_role;
select ok(exists (select 1 from public.payments_reconcile_candidates('sandbox', 50) where order_id = tests.od(21) and kind = 'search'), 'candidata: pendente recente');
select ok(exists (select 1 from public.payments_reconcile_candidates('sandbox', 50) where order_id = tests.od(22)), 'candidata: expirado recente (pagamento tardio)');
select ok(not exists (select 1 from public.payments_reconcile_candidates('sandbox', 50) where order_id = tests.od(20)), 'PAY-004: pendente de 8 dias sai da varredura');
select ok(not exists (select 1 from public.payments_reconcile_candidates('sandbox', 50) where order_id = tests.od(23)), 'PAY-004: expirado de 9 dias sai da varredura');
select ok(not exists (select 1 from public.payments_reconcile_candidates('sandbox', 50) where order_id = tests.od(24)), 'consultado há pouco: fora (throttle)');
select ok(not exists (select 1 from public.payments_reconcile_candidates('sandbox', 50) where order_id = tests.od(25)), 'histórico AbacatePay: fora da conciliação MP');
select ok(not exists (select 1 from public.payments_reconcile_candidates('production', 50)), 'ambiente da chave filtra');
select is((select count(*) from public.payments_reconcile_candidates('sandbox', 2)), 2::bigint, 'paginação: limite do lote respeitado');
select public.payments_touch_checked(tests.od(21));
select ok(not exists (select 1 from public.payments_reconcile_candidates('sandbox', 50) where order_id = tests.od(21)), 'touch_checked tira da fila sem gravar evento');
reset role;
select is(tests.nev(tests.od(21)), 0::bigint, 'touch_checked não grava payment_events');
-- pedido pago com reembolso solicitado entra mesmo velho, como 'payment'
update public.payment_orders set created_at = now() - interval '30 days', last_checked_at = now() - interval '1 hour' where id = tests.od(17);
set local role service_role;
select ok(exists (select 1 from public.payments_reconcile_candidates('sandbox', 50) where order_id = tests.od(17) and kind = 'payment' and payment_id = '4101'),
  'reembolso solicitado: reconsulta o pagamento, sem teto de idade');
reset role;
-- varreduras repetidas não criam eventos
select tests.nev(tests.od(17)) as nv17 \gset
set local role service_role;
select tests.ap(tests.od(17), tests.p(tests.od(17), '4101', 'approved', 2900, tests.t(1)));
select tests.ap(tests.od(17), tests.p(tests.od(17), '4101', 'approved', 2900, tests.t(1)));
reset role;
select is(tests.nev(tests.od(17)), :nv17::bigint, 'PAY-004: rodadas repetidas não criam payment_events');
-- expiração local
update public.payment_orders set expires_at = now() - interval '10 minutes' where id = tests.od(24);
set local role service_role;
select ok(public.payments_expire_stale() >= 1, 'expire_stale expira pendente vencido (com tolerância)');
reset role;
select is((select status::text from public.payment_orders where id = tests.od(24)), 'expirado', 'pendente vencido → expirado');
-- criado sem preferência
select tests.o(26, 'criado', 'mercadopago', '10 minutes');
select tests.o(27, 'criado', 'mercadopago', '1 minute');
set local role service_role;
select is(public.payments_fail_unattached(tests.od(26)), true, 'criado sem preferência há > 5 min: falhou');
select is(public.payments_fail_unattached(tests.od(27)), false, 'criado há 1 min: mantém');
reset role;

-- ===================================================== PAY-005: divergência em pedido pago não expira em 30 dias
insert into public.payment_events (provider, event_type, order_id, outcome, detail, received_at)
values ('mercadopago', 'apply.webhook', tests.od(2), 'divergencia_cobranca', '{"to":"pago"}', now() - interval '45 days'),
       ('mercadopago', 'apply.webhook', tests.od(14), 'divergencia_valor', '{"to":"pago"}', now() - interval '45 days');
select tests.login('00000000-0000-4000-8000-0000000011c1', 'master');
select ok(exists (select 1 from public.admin_payment_divergences() d where d ->> 'orderId' = tests.od(2)::text and d ->> 'kind' = 'divergencia_cobranca'),
  'PAY-005: divergência em pedido pago segue visível após 45 dias');
select lives_ok(format('select public.admin_clear_needs_refund(%L, %L)', tests.od(2), 'divergencia analisada e tratada'), 'tratamento pelo Master (sem needs_refund)');
select ok(not exists (select 1 from public.admin_payment_divergences() d where d ->> 'orderId' = tests.od(2)::text and d ->> 'kind' = 'divergencia_cobranca'),
  'PAY-005: some depois do tratamento');
reset role;
select ok((select count(*) from public.payment_events where order_id = tests.od(2) and outcome = 'divergencia_cobranca' and resolved_at is not null) = 1, 'evento marcado como resolvido, não apagado');

-- ===================================================== Master enxerga pedido MP e histórico
select tests.login('00000000-0000-4000-8000-0000000011c1', 'master');
select is((select d ->> 'providerChargeId' from public.admin_list_payments(null, 500) d where d ->> 'orderId' = tests.od(2)::text), '5001', 'Master: providerChargeId = pagamento MP');
select is((select d ->> 'provider' from public.admin_list_payments(null, 500) d where d ->> 'orderId' = tests.od(10)::text), 'abacatepay', 'Master: histórico AbacatePay continua listado');
reset role;

select * from finish();
rollback;
