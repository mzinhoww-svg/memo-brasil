-- Read-only receipt disposition, including authorization and inherited grants.
begin;
select no_plan();
insert into auth.users (id, aud, role, email, is_anonymous) values
 ('00000000-0000-4000-8000-0000000026a1','authenticated','authenticated','receipt26@test.local',false),
 ('00000000-0000-4000-8000-0000000026a2','authenticated','authenticated','other26@test.local',false);
insert into public.events (id,title,category,host_id,host_name,duration_hours,capacity,shots_per_person,start_at)
 values ('00000000-0000-4000-8000-0000000026e1','Receipt','festa','00000000-0000-4000-8000-0000000026a1','H',6,10,10,now());
insert into public.payment_orders (id,event_id,host_id,plan_code,amount_cents,provider_env,idempotency_key,status,needs_refund)
 values ('00000000-0000-4000-8000-0000000026d1','00000000-0000-4000-8000-0000000026e1','00000000-0000-4000-8000-0000000026a1','festa',2900,'production',gen_random_uuid(),'pago',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000026a1","role":"authenticated"}',true);
set local role authenticated;
select is(public.payments_order_status('00000000-0000-4000-8000-0000000026d1')->'needsRefund','true'::jsonb,'refund review flag is exposed');
select is(public.payments_order_status('00000000-0000-4000-8000-0000000026d1')->'entitlementActive','false'::jsonb,'paid alone never implies an entitlement');
reset role;
insert into public.event_entitlements (event_id,plan_code,max_guests,max_shots,source,order_id,env)
 values ('00000000-0000-4000-8000-0000000026e1','festa',30,24,'pago','00000000-0000-4000-8000-0000000026d1','production');
set local role authenticated;
select is(public.payments_order_status('00000000-0000-4000-8000-0000000026d1')->'entitlementActive','true'::jsonb,'actual active entitlement is exposed');
reset role;
update public.event_entitlements set status='revogado' where order_id='00000000-0000-4000-8000-0000000026d1';
set local role authenticated;
select is(public.payments_order_status('00000000-0000-4000-8000-0000000026d1')->'entitlementActive','false'::jsonb,'revoked entitlement is inactive');
reset role;
update public.event_entitlements set status='ativo',env='sandbox' where order_id='00000000-0000-4000-8000-0000000026d1';
update public.platform_settings set value='"production"'::jsonb where key='payments_env';
set local role authenticated;
select is(public.payments_order_status('00000000-0000-4000-8000-0000000026d1')->'entitlementActive','false'::jsonb,'inactive environment never claims entitlement');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000026a2","role":"authenticated"}',true);
select throws_ok($$select public.payments_order_status('00000000-0000-4000-8000-0000000026d1')$$,'MM004','forbidden','other owner is denied');
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select public.payments_order_status('00000000-0000-4000-8000-0000000026d1')$$,'MM004','forbidden','missing auth is denied');
reset role;
select ok(has_function_privilege('authenticated','public.payments_order_status(uuid)','EXECUTE'),'authenticated retains execute');
select ok(not has_function_privilege('anon','public.payments_order_status(uuid)','EXECUTE'),'anon has no execute');
select ok(not exists (select 1 from pg_proc p, lateral aclexplode(p.proacl) a where p.oid='public.payments_order_status(uuid)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'public has no execute');
select * from finish();
rollback;
