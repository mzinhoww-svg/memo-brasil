-- pgTAP GF-01: permissões Master, coortes, deduplicação, sandbox, teste e cortesia.
-- Uma transação isolada; NÃO usa ou altera dados reais de produção.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub',p_user,'role','authenticated','is_anonymous',false,'aal','aal2',
    'app_metadata',case when p_role is null then '{}'::json else json_build_object('role',p_role) end
  )::text,true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
('00000000-0000-4000-8000-0000000046a1','authenticated','authenticated','master46@test.local',false),
('00000000-0000-4000-8000-0000000046b1','authenticated','authenticated','host46@test.local',false),
('00000000-0000-4000-8000-0000000046c1','authenticated','authenticated','guest46@test.local',false),
('00000000-0000-4000-8000-0000000046d1','authenticated','authenticated','testhost46@test.local',false);
insert into public.profiles (id,is_test) values
('00000000-0000-4000-8000-0000000046a1',false),
('00000000-0000-4000-8000-0000000046b1',false),
('00000000-0000-4000-8000-0000000046c1',false),
('00000000-0000-4000-8000-0000000046d1',true)
on conflict (id) do update set is_test=excluded.is_test;
insert into public.platform_roles (user_id,role) values
('00000000-0000-4000-8000-0000000046a1','master');

-- baseline pré-fixture: ignora outras linhas que possam existir no banco de testes
select tests.login('00000000-0000-4000-8000-0000000046a1','master');
select set_config('growth_baseline',public.admin_growth_cohort(7)::text,true);
reset role;

insert into public.events (id,title,category,host_id,duration_hours,created_at,is_test) values
('00000000-0000-4000-8000-000000004601','Evento GF-A','festa','00000000-0000-4000-8000-0000000046b1',6,now()-interval '2 days',false),
('00000000-0000-4000-8000-000000004602','Evento GF-B','festa','00000000-0000-4000-8000-0000000046b1',6,now()-interval '2 days',false),
('00000000-0000-4000-8000-000000004603','Evento GF-TEST','festa','00000000-0000-4000-8000-0000000046b1',6,now()-interval '2 days',true),
('00000000-0000-4000-8000-000000004604','Evento GF-TEST-HOST','festa','00000000-0000-4000-8000-0000000046d1',6,now()-interval '2 days',false);

insert into public.participants (event_id,user_id,name) values
('00000000-0000-4000-8000-000000004601','00000000-0000-4000-8000-0000000046c1','Pessoa GF');
insert into public.photos (id,event_id,author_id,author_name,storage_path,upload_status,status) values
('00000000-0000-4000-8000-000000004651','00000000-0000-4000-8000-000000004601','00000000-0000-4000-8000-0000000046c1','Pessoa GF',
 '00000000-0000-4000-8000-000000004601/00000000-0000-4000-8000-000000004651','pronta','visivel'),
('00000000-0000-4000-8000-000000004652','00000000-0000-4000-8000-000000004602','00000000-0000-4000-8000-0000000046c1','Pessoa GF',
 '00000000-0000-4000-8000-000000004602/00000000-0000-4000-8000-000000004652','falhou','visivel');

-- Dois upgrades pagos no mesmo evento; contagem de eventos pagos deve ser 1.
insert into public.payment_orders (id,event_id,host_id,plan_code,amount_cents,idempotency_key,provider,provider_env,status,paid_at) values
('00000000-0000-4000-8000-000000004661','00000000-0000-4000-8000-000000004601','00000000-0000-4000-8000-0000000046b1','ate150',14700,
 '00000000-0000-4000-8000-000000004671','validapay','production','pago',now()),
('00000000-0000-4000-8000-000000004662','00000000-0000-4000-8000-000000004601','00000000-0000-4000-8000-0000000046b1','ate300',29700,
 '00000000-0000-4000-8000-000000004672','validapay','production','pago',now()),
('00000000-0000-4000-8000-000000004663','00000000-0000-4000-8000-000000004602','00000000-0000-4000-8000-0000000046b1','ate150',14700,
 '00000000-0000-4000-8000-000000004673','validapay','sandbox','pago',now()),
('00000000-0000-4000-8000-000000004664','00000000-0000-4000-8000-000000004602','00000000-0000-4000-8000-0000000046b1','ate150',14700,
 '00000000-0000-4000-8000-000000004674','validapay','production','cancelado',null),
('00000000-0000-4000-8000-000000004665','00000000-0000-4000-8000-000000004601','00000000-0000-4000-8000-0000000046b1','ate150',14700,
 '00000000-0000-4000-8000-000000004675','validapay','production','estornado',now()),
('00000000-0000-4000-8000-000000004666','00000000-0000-4000-8000-000000004603','00000000-0000-4000-8000-0000000046b1','ate150',14700,
 '00000000-0000-4000-8000-000000004676','validapay','production','pago',now());

insert into public.event_entitlements (event_id,plan_code,status,source,env) values
('00000000-0000-4000-8000-000000004602','ate150','ativo','codigo','nenhum');

-- sem permissões: anon nem pode invocar a RPC
set local role anon;
select throws_ok($$select public.admin_growth_cohort(7)$$,'42501',null,'anon não tem EXECUTE');
reset role;
select tests.login('00000000-0000-4000-8000-0000000046b1');
select throws_ok($$select public.admin_growth_cohort(7)$$,'MM004',null,'anfitrião comum não pode ver crescimento');
reset role;

select tests.login('00000000-0000-4000-8000-0000000046a1','master');
select is(public.admin_growth_cohort(7)->>'timezone','America/Cuiaba','fuso declarado');
select is((public.admin_growth_cohort(7)->>'days')::int,7,'período 7');
select is((public.admin_growth_cohort(999)->>'days')::int,90,'período limitado a 90');
select is((public.admin_growth_cohort(-4)->>'days')::int,1,'período mínimo 1');
select is(jsonb_array_length(public.admin_growth_cohort(7)->'series'),7,'série apresenta todos os 7 dias, inclusive zeros');

select is(
 (public.admin_growth_cohort(7)->'totals'->>'created')::int -
 (current_setting('growth_baseline')::jsonb->'totals'->>'created')::int,2,
 'somente eventos reais e hosts não teste entram na coorte');
select is(
 (public.admin_growth_cohort(7)->'totals'->>'withGuests')::int -
 (current_setting('growth_baseline')::jsonb->'totals'->>'withGuests')::int,1,
 'convidado válido conta uma vez');
select is(
 (public.admin_growth_cohort(7)->'totals'->>'withPhotos')::int -
 (current_setting('growth_baseline')::jsonb->'totals'->>'withPhotos')::int,1,
 'upload falho não conta como foto');
select is(
 (public.admin_growth_cohort(7)->'totals'->>'activated')::int -
 (current_setting('growth_baseline')::jsonb->'totals'->>'activated')::int,1,
 'ativação exige convidado e foto pronta');
select is(
 (public.admin_growth_cohort(7)->'totals'->>'checkoutEvents')::int -
 (current_setting('growth_baseline')::jsonb->'totals'->>'checkoutEvents')::int,2,
 'dois eventos iniciaram checkout em produção (mesmo que cancelado)');
select is(
 (public.admin_growth_cohort(7)->'totals'->>'paidEvents')::int -
 (current_setting('growth_baseline')::jsonb->'totals'->>'paidEvents')::int,1,
 'upgrades pagos deduplicados; sandbox e eventos de teste ignorados');
select is(
 (public.admin_growth_cohort(7)->'totals'->>'paidOrders')::int -
 (current_setting('growth_baseline')::jsonb->'totals'->>'paidOrders')::int,2,
 'dois pedidos pagos atuais contabilizados separadamente');
select is(
 (public.admin_growth_cohort(7)->'totals'->>'paidCents')::bigint -
 (current_setting('growth_baseline')::jsonb->'totals'->>'paidCents')::bigint,44400::bigint,
 'valor bruto em centavos; ignora sandbox e estornos');
select is(
 (public.admin_growth_cohort(7)->'totals'->>'courtesyEvents')::int -
 (current_setting('growth_baseline')::jsonb->'totals'->>'courtesyEvents')::int,1,
 'cortesia é separada de pagamento real');
select is(
 (public.admin_growth_cohort(7)->'totals'->>'reversedOrDisputedOrders')::int -
 (current_setting('growth_baseline')::jsonb->'totals'->>'reversedOrDisputedOrders')::int,1,
 'estorno separado de valores pagos atuais');
reset role;

select * from finish();
rollback;
