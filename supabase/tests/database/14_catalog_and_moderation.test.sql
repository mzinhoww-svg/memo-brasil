-- Regressões A01/A04/A05. Sem chamadas externas; toda fixture é revertida.
begin;
select no_plan();
-- Reapply the additive migration against a real test-offer fixture. Its update must
-- retain price/limits, commercial plans, orders and historical entitlements.
insert into public.plans(code,name,max_guests,max_shots,price_cents,sort,sandbox_active,production_active)
values ('teste1real','Teste R$ 1',30,24,100,99,true,true)
on conflict (code) do update set name='Teste R$ 1',price_cents=100,production_active=true;
create temporary table plans_before as select to_jsonb(p) - 'production_active' - 'updated_at' as snapshot from public.plans p;
create temporary table orders_before as select to_jsonb(o) as snapshot from public.payment_orders o;
create temporary table rights_before as select to_jsonb(e) as snapshot from public.event_entitlements e;
\ir ../../migrations/20261107000100_catalog_and_moderation.sql
select is((select production_active from public.plans where code='teste1real'),false,'fixture Teste R$ 1 deixa oferta produtiva');
select results_eq($$select to_jsonb(p) - 'production_active' - 'updated_at' from public.plans p order by code$$,
 $$select snapshot from plans_before order by snapshot->>'code'$$,'plano, preço e limites preservados');
select results_eq($$select to_jsonb(o) from public.payment_orders o order by id$$,$$select snapshot from orders_before order by snapshot->>'id'$$,'pedidos históricos preservados');
select results_eq($$select to_jsonb(e) from public.event_entitlements e order by id$$,$$select snapshot from rights_before order by snapshot->>'id'$$,'direitos históricos preservados');
create schema tests;
create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;
insert into auth.users(id,aud,role,email,is_anonymous) values
 ('00000000-0000-4000-8000-0000000014a1','authenticated','authenticated','host14@test.local',false),
 ('00000000-0000-4000-8000-0000000014a2','authenticated','authenticated','other14@test.local',false),
 ('00000000-0000-4000-8000-0000000014b1','authenticated','authenticated','guest14@test.local',false);
insert into public.profiles(id) select id from auth.users where email in ('host14@test.local','other14@test.local','guest14@test.local') on conflict do nothing;
insert into public.events(id,title,category,host_id,host_name,duration_hours,capacity,shots_per_person) values
 ('00000000-0000-4000-8000-0000000014e1','Moderação','festa','00000000-0000-4000-8000-0000000014a1','Host',6,10,10),
 ('00000000-0000-4000-8000-0000000014e2','Outro evento','festa','00000000-0000-4000-8000-0000000014a2','Outro',6,10,10);
insert into public.participants(event_id,user_id,name) values
 ('00000000-0000-4000-8000-0000000014e1','00000000-0000-4000-8000-0000000014b1','Ana'),
 ('00000000-0000-4000-8000-0000000014e2','00000000-0000-4000-8000-0000000014b1','Ana');
-- Pending photo predates the block and must not be publishable after it.
insert into public.photos(id,event_id,author_id,author_name,moment,storage_path) values
 ('00000000-0000-4000-8000-0000000014f1','00000000-0000-4000-8000-0000000014e1','00000000-0000-4000-8000-0000000014b1','Ana','Festa','00000000-0000-4000-8000-0000000014e1/00000000-0000-4000-8000-0000000014f1');
update public.platform_settings set value='"production"'::jsonb where key='payments_env';
select ok(not exists(select 1 from jsonb_array_elements(public.list_public_plans()) p where p->>'code'='teste1real'),'oferta fixture ausente do catálogo público produtivo');
select is(public.payments_quote_internal('00000000-0000-4000-8000-0000000014e1','teste1real')->>'reason','plano_inativo','oferta fixture não permite cotação produtiva');
create function tests.rejoin() returns jsonb language sql as $$
 select public.join_event((select code from public.events where id='00000000-0000-4000-8000-0000000014e1'),'Ana')
$$;
-- blocked guests cannot read events, so freeze code in helper before switching identity.
do $$ declare event_code text; begin
 select code into event_code from public.events where id='00000000-0000-4000-8000-0000000014e1';
 execute format('create or replace function tests.rejoin() returns jsonb language sql as %L',
 format('select public.join_event(%L,''Ana'')',event_code));
end $$;
select tests.login('00000000-0000-4000-8000-0000000014a2');
select throws_ok($$select public.block_participant('00000000-0000-4000-8000-0000000014e1','00000000-0000-4000-8000-0000000014b1')$$,'MM004',null,'outro host não bloqueia');
select throws_ok($$select public.unblock_participant('00000000-0000-4000-8000-0000000014e1','00000000-0000-4000-8000-0000000014b1')$$,'MM004',null,'outro host não desbloqueia');
reset role;
select tests.login('00000000-0000-4000-8000-0000000014a1');
select lives_ok($$select public.block_participant('00000000-0000-4000-8000-0000000014e1','00000000-0000-4000-8000-0000000014b1')$$,'host bloqueia');
select ok((select blocked_at is not null from public.participants where event_id='00000000-0000-4000-8000-0000000014e1' and user_id='00000000-0000-4000-8000-0000000014b1'),'linha persiste bloqueada');
select throws_ok($$select public.block_participant('00000000-0000-4000-8000-0000000014e2','00000000-0000-4000-8000-0000000014b1')$$,'MM004',null,'escopo de evento é obrigatório');
reset role;
select tests.login('00000000-0000-4000-8000-0000000014b1');
select throws_ok($$select tests.rejoin()$$,'MM015',null,'mesma identidade não retorna');
select throws_ok($$delete from public.participants where event_id='00000000-0000-4000-8000-0000000014e1' and user_id=auth.uid()$$,'MM015',null,'self-delete não apaga bloqueio');
select throws_ok($$update public.participants set blocked_at=null where event_id='00000000-0000-4000-8000-0000000014e1' and user_id=auth.uid()$$,'MM015',null,'self-update não contorna bloqueio');
select throws_ok($$select public.begin_photo(gen_random_uuid(),'00000000-0000-4000-8000-0000000014e1')$$,'MM015',null,'bloqueado não reserva foto');
select throws_ok($$select public.finalize_photo('00000000-0000-4000-8000-0000000014f1')$$,'MM015',null,'bloqueado não finaliza reserva antiga');
reset role;
select is((select count(*)::int from public.photos where id='00000000-0000-4000-8000-0000000014f1'),1,'histórico de foto preservado');
select ok((select blocked_at is null from public.participants where event_id='00000000-0000-4000-8000-0000000014e2' and user_id='00000000-0000-4000-8000-0000000014b1'),'outro evento não é bloqueado');
select tests.login('00000000-0000-4000-8000-0000000014a1');
select lives_ok($$select public.unblock_participant('00000000-0000-4000-8000-0000000014e1','00000000-0000-4000-8000-0000000014b1')$$,'host desbloqueia');
reset role;
select tests.login('00000000-0000-4000-8000-0000000014b1');
select lives_ok($$select tests.rejoin()$$,'desbloqueio permite retorno');
select lives_ok($$select public.begin_photo('00000000-0000-4000-8000-0000000014f2','00000000-0000-4000-8000-0000000014e1')$$,'desbloqueio permite nova publicação');
reset role;
select ok(not exists(select 1 from public.plans where code='teste1real' and price_cents=100 and name in ('Teste','Teste R$ 1') and production_active),'oferta teste identificada não fica produtiva');
select results_eq($$select code,price_cents from public.plans where code in ('gratis','festa','celebracao','casamento','grande') order by sort$$,$$values ('gratis',0),('festa',2900),('celebracao',8900),('casamento',18900),('grande',34900)$$,'preços comerciais intactos');
select * from finish();
rollback;
