-- pgTAP · pacote "Mais poses" (+12 poses por pessoa) como plano-variante oculto (plans.pack_of).
-- Cobre: estrutura e valores iniciais, catálogo público sem variantes, list_public_pose_packs (anon barrado, inativo some),
-- diferença de preço na cotação (grátis, plano pago, cortesia, legado), limite de poses imposto pelo servidor com e sem o pacote,
-- pedido real até o direito, idempotência da migration e preservação de planos/pedidos/direitos, e o Master (packOf).
begin;
select no_plan();

-- ===================================================== estado inicial criado pela migration (antes de qualquer fixture)
select has_column('public', 'plans', 'pack_of', 'plans.pack_of existe');
select results_eq(
  $$select code, pack_of, max_guests, max_shots, price_cents - (select price_cents from public.plans b where b.code = k.pack_of), sort - (select sort from public.plans b where b.code = k.pack_of), sandbox_active, production_active, is_free
      from public.plans k where pack_of is not null order by code$$,
  $$values ('celebracao_36', 'celebracao', 100, 36, 1990, 0, false, false, false),
           ('festa_36', 'festa', 30, 36, 1990, 0, false, false, false)$$,
  'variantes nascem desligadas, com os convidados do base, 36 poses e +R$ 19,90');

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
-- compra de verdade: pedido do anfitrião (open_order) → cobrança (attach) → pagamento aprovado (apply_status) como serviço
create function tests.buy(p_host uuid, p_event uuid, p_plan text) returns jsonb language plpgsql as $$
declare r jsonb; o uuid; amt int; ch text := 'ch_' || gen_random_uuid()::text;
begin
  perform tests.login(p_host);
  r := public.payments_open_order(p_event, p_plan, gen_random_uuid());
  reset role;
  o := (r ->> 'orderId')::uuid; amt := (r ->> 'amountCents')::int;
  set local role service_role;
  perform public.payments_attach_charge(o, ch, 'BR', 'B64', now() + interval '1 hour', true);
  r := public.payments_apply_status(o, ch, 'pago', amt, true, 'webhook');
  reset role;
  return r || jsonb_build_object('orderId', o, 'amountCents', amt, 'chargeId', ch);
end $$;
create function tests.age(p_event uuid) returns void language sql as $$
  update public.event_entitlements set created_at = created_at - interval '1 hour' where event_id = p_event
$$;
create function tests.ent(p_event uuid) returns table (plan_code text, max_guests int, max_shots int, source text) language sql as $$
  select * from public.effective_entitlement(p_event)
$$;
create function tests.quote(p_host uuid, p_event uuid, p_plan text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform tests.login(p_host);
  r := public.payments_quote(p_event, p_plan);
  reset role;
  return r;
end $$;
grant usage on schema tests to authenticated, service_role, anon;
grant execute on all functions in schema tests to authenticated, service_role, anon;

-- pessoas: a1 free · a2 festa · a3 cortesia · a4 legado · a5 celebração · a6 festa+pacote · c1 master
insert into auth.users (id, aud, role, email, is_anonymous)
  select ('00000000-0000-4000-8000-0000000037a' || g)::uuid, 'authenticated', 'authenticated', 'h37' || g || '@test.local', false from generate_series(1, 6) g;
insert into auth.users (id, aud, role, email, is_anonymous) values ('00000000-0000-4000-8000-0000000037c1', 'authenticated', 'authenticated', 'm37@test.local', false);
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-00000000037%' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000037c1', 'master');
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, start_at)
  select ('00000000-0000-4000-8000-0000000037e' || g)::uuid, 'E37-' || g, 'festa', ('00000000-0000-4000-8000-0000000037a' || g)::uuid, 'H', 6, 10, 10, now()
  from generate_series(1, 6) g;

-- planos como em produção (Festa 50/24 R$ 59,90; Celebração 100/24 R$ 89); as variantes seguem o base (+19,90)
update public.plans set max_guests = 50, price_cents = 5990 where code = 'festa';
update public.plans set max_guests = 50, price_cents = 7980 where code = 'festa_36';
update public.plans set price_cents = 10890 where code = 'celebracao_36';
select tests.set_env('sandbox');

-- cortesia (a3) e legado (a4) concedidos como em produção: direito + limites do evento
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, reason)
  values ('00000000-0000-4000-8000-0000000037e3', 'festa', 50, 24, 'cortesia', 'nenhum', 'fixture'),
         ('00000000-0000-4000-8000-0000000037e4', 'gratis', 50, 24, 'legado', 'nenhum', 'fixture');
update public.events set capacity = 50, shots_per_person = 24 where id in ('00000000-0000-4000-8000-0000000037e3', '00000000-0000-4000-8000-0000000037e4');

-- ===================================================== desligado: não aparece nem vende
select is(public.payments_quote_internal('00000000-0000-4000-8000-0000000037e1', 'festa_36') ->> 'reason', 'plano_inativo', 'pacote desligado: plano_inativo na cotação');
select tests.login('00000000-0000-4000-8000-0000000037a1');
select is(public.list_public_pose_packs(), '[]'::jsonb, 'pacote desligado: list_public_pose_packs vazio');
select throws_ok($$select public.payments_open_order('00000000-0000-4000-8000-0000000037e1', 'festa_36', gen_random_uuid())$$, 'MM014', null, 'pacote desligado: não abre pedido');
reset role;

-- liga os pacotes (como o Master faria)
update public.plans set sandbox_active = true where pack_of is not null;

-- ===================================================== catálogo público: variantes ocultas
set local role anon;
select ok(not exists (select 1 from jsonb_array_elements(public.list_public_plans()) p where p ->> 'code' like '%\_36'), 'anon: list_public_plans não traz pacote (ativo e oculto)');
select is((select count(*)::int from jsonb_array_elements(public.list_public_plans())), 5, 'anon: list_public_plans continua com os 5 planos');
select throws_ok($$select public.list_public_pose_packs()$$, '42501', null, 'anon não executa list_public_pose_packs');
reset role;
select tests.login('00000000-0000-4000-8000-0000000037a1');
select ok(not exists (select 1 from jsonb_array_elements(public.list_public_plans()) p where p ->> 'code' like '%\_36'), 'logado: list_public_plans não traz pacote');
select is((select jsonb_agg(p - 'name' - 'maxGuests' order by p ->> 'code') from jsonb_array_elements(public.list_public_pose_packs()) p),
  '[{"code":"celebracao_36","baseCode":"celebracao","maxShots":36,"baseMaxShots":24,"priceCents":10890,"extraCents":1990},
    {"code":"festa_36","baseCode":"festa","maxShots":36,"baseMaxShots":24,"priceCents":7980,"extraCents":1990}]'::jsonb, 'logado: list_public_pose_packs traz os dois pacotes ativos com o extra');
reset role;
update public.plans set sandbox_active = false where code = 'celebracao_36';
select tests.login('00000000-0000-4000-8000-0000000037a1');
select is((select jsonb_agg(p ->> 'code') from jsonb_array_elements(public.list_public_pose_packs()) p), '["festa_36"]'::jsonb, 'pacote inativo some da lista');
reset role;
update public.plans set sandbox_active = true where code = 'celebracao_36';
update public.plans set sandbox_active = false where code = 'celebracao';
select tests.login('00000000-0000-4000-8000-0000000037a1');
select is((select jsonb_agg(p ->> 'code') from jsonb_array_elements(public.list_public_pose_packs()) p), '["festa_36"]'::jsonb, 'plano-base inativo derruba o pacote da lista');
reset role;
update public.plans set sandbox_active = true where code = 'celebracao';
select tests.set_env('production');
select tests.login('00000000-0000-4000-8000-0000000037a1');
select is(public.list_public_pose_packs(), '[]'::jsonb, 'ambiente production sem production_active: lista vazia');
reset role;
select tests.set_env('sandbox');

-- ===================================================== diferença de preço na cotação
select is(tests.quote('00000000-0000-4000-8000-0000000037a1', '00000000-0000-4000-8000-0000000037e1', 'festa_36'),
  '{"planCode":"festa_36","fromPlanCode":"gratis","amountCents":7980,"payable":true,"reason":"ok"}'::jsonb, 'grátis → Festa + Mais poses: preço cheio do pacote (Festa + 19,90)');
select tests.buy('00000000-0000-4000-8000-0000000037a2', '00000000-0000-4000-8000-0000000037e2', 'festa') as b2 \gset
select is((:'b2'::jsonb) ->> 'applied', 'true', 'fixture: Festa paga no evento 2');
select is(tests.quote('00000000-0000-4000-8000-0000000037a2', '00000000-0000-4000-8000-0000000037e2', 'festa_36'),
  '{"planCode":"festa_36","fromPlanCode":"festa","amountCents":1990,"payable":true,"reason":"ok"}'::jsonb, 'quem já tem Festa paga só a diferença: R$ 19,90');
select is(tests.quote('00000000-0000-4000-8000-0000000037a2', '00000000-0000-4000-8000-0000000037e2', 'celebracao_36') ->> 'amountCents', '4900', 'Festa → Celebração + Mais poses: 108,90 menos o que pagou (59,90)');
select is(tests.quote('00000000-0000-4000-8000-0000000037a3', '00000000-0000-4000-8000-0000000037e3', 'festa_36') ->> 'amountCents', '1990', 'Festa por cortesia: o pacote desconta o preço do plano-base (R$ 19,90)');
select is(tests.quote('00000000-0000-4000-8000-0000000037a4', '00000000-0000-4000-8000-0000000037e4', 'festa_36') ->> 'amountCents', '7980', 'limites legados: continua preço cheio (Ruling 6)');
select tests.buy('00000000-0000-4000-8000-0000000037a5', '00000000-0000-4000-8000-0000000037e5', 'celebracao') as b5 \gset
select is(tests.quote('00000000-0000-4000-8000-0000000037a5', '00000000-0000-4000-8000-0000000037e5', 'celebracao_36') ->> 'amountCents', '1990', 'Celebração → Celebração + Mais poses: R$ 19,90');
select is(tests.quote('00000000-0000-4000-8000-0000000037a5', '00000000-0000-4000-8000-0000000037e5', 'festa_36') ->> 'reason', 'ja_incluido', 'Celebração paga não compra Festa + Mais poses (não é pagável)');

-- ===================================================== limite de poses: o servidor decide
-- sem pacote (Festa paga): 24 sim, 25..36 não
select is((select max_shots from tests.ent('00000000-0000-4000-8000-0000000037e2')), 24, 'Festa sem pacote: 24 poses');
select tests.login('00000000-0000-4000-8000-0000000037a2');
select throws_ok($$update public.events set shots_per_person = 36 where id = '00000000-0000-4000-8000-0000000037e2'$$, 'MM012', null, 'sem comprar o pacote o anfitrião não sobe para 36');
reset role;
select tests.login('00000000-0000-4000-8000-0000000037a1');
select throws_ok($$update public.events set shots_per_person = 24 where id = '00000000-0000-4000-8000-0000000037e1'$$, 'MM012', null, 'grátis não sobe para 24');
reset role;

-- compra do pacote por quem já tem Festa: pedido de R$ 19,90, direito festa_36, 36 poses
select tests.age('00000000-0000-4000-8000-0000000037e2');
select tests.buy('00000000-0000-4000-8000-0000000037a2', '00000000-0000-4000-8000-0000000037e2', 'festa_36') as p2 \gset
select is((:'p2'::jsonb) ->> 'amountCents', '1990', 'pedido do pacote nasce com R$ 19,90');
select is((:'p2'::jsonb) ->> 'applied', 'true', 'pagamento do pacote aplicado');
select results_eq($$select plan_code, max_guests, max_shots, source from tests.ent('00000000-0000-4000-8000-0000000037e2')$$, $$values ('festa_36', 50, 36, 'pago')$$,
  'direito efetivo: festa_36, mesmos 50 convidados, 36 poses');
select is((select shots_per_person from public.events where id = '00000000-0000-4000-8000-0000000037e2'), 36, 'o evento sobe para 36 poses (regra única de subida)');
select tests.login('00000000-0000-4000-8000-0000000037a2');
select lives_ok($$update public.events set shots_per_person = 30 where id = '00000000-0000-4000-8000-0000000037e2'$$, 'com o pacote pode configurar até 36 (30)');
select throws_ok($$update public.events set shots_per_person = 37 where id = '00000000-0000-4000-8000-0000000037e2'$$, 'MM012', null, 'com o pacote 37 continua barrado');
select throws_ok($$update public.events set capacity = 51 where id = '00000000-0000-4000-8000-0000000037e2'$$, 'MM012', null, 'o pacote não aumenta convidados');
select is(public.payments_quote('00000000-0000-4000-8000-0000000037e2', 'festa_36') ->> 'reason', 'ja_incluido', 'comprar o pacote de novo: ja_incluido');
reset role;
-- outro evento do mesmo anfitrião-tipo sem pacote segue limitado
select is((select max_shots from tests.ent('00000000-0000-4000-8000-0000000037e5')), 24, 'quem não comprou o pacote continua com 24');

-- Celebração + pacote: compra real no evento 5
select tests.age('00000000-0000-4000-8000-0000000037e5');
select tests.buy('00000000-0000-4000-8000-0000000037a5', '00000000-0000-4000-8000-0000000037e5', 'celebracao_36') as p5 \gset
select is((:'p5'::jsonb) ->> 'amountCents', '1990', 'Celebração + Mais poses cobra só a diferença');
select results_eq($$select plan_code, max_guests, max_shots from tests.ent('00000000-0000-4000-8000-0000000037e5')$$, $$values ('celebracao_36', 100, 36)$$, 'Celebração com pacote: 100 convidados, 36 poses');
-- subir de Festa+pacote para Casamento mantém 36 e a cobrança parte do preço pago do pacote
select tests.age('00000000-0000-4000-8000-0000000037e2');
select tests.buy('00000000-0000-4000-8000-0000000037a2', '00000000-0000-4000-8000-0000000037e2', 'casamento') as c2 \gset
select is((:'c2'::jsonb) ->> 'amountCents', '10920', 'Festa+pacote → Casamento: 189 menos 79,80');
select results_eq($$select plan_code, max_guests, max_shots from tests.ent('00000000-0000-4000-8000-0000000037e2')$$, $$values ('casamento', 250, 36)$$, 'Casamento: 250 convidados, 36 poses');

-- ===================================================== estorno do pacote: volta ao limite do plano-base
select tests.buy('00000000-0000-4000-8000-0000000037a6', '00000000-0000-4000-8000-0000000037e6', 'festa_36') as p6 \gset
select is((:'p6'::jsonb) ->> 'amountCents', '7980', 'grátis comprando o pacote direto paga Festa + 19,90');
set local role service_role;
select is(public.payments_apply_status(((:'p6'::jsonb) ->> 'orderId')::uuid, (:'p6'::jsonb) ->> 'chargeId', 'estornado', 7980, true, 'webhook') ->> 'applied', 'true', 'pacote estornado');
reset role;
select results_eq($$select plan_code, max_shots from tests.ent('00000000-0000-4000-8000-0000000037e6')$$, $$values ('gratis', 10)$$, 'estorno devolve o direito ao Grátis');
select is((select shots_per_person from public.events where id = '00000000-0000-4000-8000-0000000037e6'), 10, 'e o evento volta ao limite que tinha');

-- ===================================================== Master enxerga e edita as variantes
select tests.login('00000000-0000-4000-8000-0000000037c1', 'master');
select is((select jsonb_agg(p ->> 'code' order by p ->> 'code') from public.admin_list_plans() p where p ->> 'packOf' is not null), '["celebracao_36","festa_36"]'::jsonb, 'admin_list_plans devolve packOf das variantes');
select is((select count(*)::int from public.admin_list_plans() p where p ->> 'packOf' is null), 5, 'admin_list_plans: os 5 planos normais têm packOf nulo');
reset role;

-- ===================================================== migration idempotente e sem tocar em nada existente
update public.plans set price_cents = 8480 where code = 'festa_36'; -- preço editado pelo Master não é desfeito
create temporary table plans_before as select to_jsonb(p) - 'updated_at' as s from public.plans p;
create temporary table orders_before as select to_jsonb(o) as s from public.payment_orders o;
create temporary table rights_before as select to_jsonb(e) as s from public.event_entitlements e;
\ir ../../migrations/20261112000100_pose_packs.sql
select results_eq($$select to_jsonb(p) - 'updated_at' from public.plans p$$, $$select s from plans_before$$, 'reaplicar a migration não altera nenhum plano (nem preço editado)');
select results_eq($$select to_jsonb(o) from public.payment_orders o$$, $$select s from orders_before$$, 'pedidos intactos');
select results_eq($$select to_jsonb(e) from public.event_entitlements e$$, $$select s from rights_before$$, 'direitos intactos');
select is((select count(*)::int from public.plans where pack_of is not null), 2, 'continuam 2 variantes');
select is((select count(*)::int from public.plans where pack_of is null), 5, 'continuam 5 planos normais');
select throws_ok($$update public.plans set pack_of = code where code = 'festa_36'$$, '23514', null, 'variante não pode ser de si mesma');

select * from finish();
rollback;
