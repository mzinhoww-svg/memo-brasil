-- Local simulated provider evidence only; no live financial operations.
begin;
select no_plan();
insert into auth.users(id,aud,role,email,is_anonymous) values
('00000000-0000-4000-8000-0000000013a1','authenticated','authenticated','vp-prod-owner@test.local',false),
('00000000-0000-4000-8000-0000000013a2','authenticated','authenticated','vp-prod-other@test.local',false);
insert into public.profiles(id) values('00000000-0000-4000-8000-0000000013a1'),('00000000-0000-4000-8000-0000000013a2') on conflict do nothing;
insert into public.events(id,title,category,host_id,host_name,duration_hours,capacity,shots_per_person,start_at)
values('00000000-0000-4000-8000-0000000013e1','Production local','festa','00000000-0000-4000-8000-0000000013a1','Teste',6,10,10,now());
insert into public.feature_flags(key,enabled) values('validapay_checkout',true);
update public.platform_settings set value='"sandbox"' where key='payments_env';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000013a1","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select throws_ok($$select public.payments_validapay_open('00000000-0000-4000-8000-0000000013e1','festa','00000000-0000-4000-8000-0000000013b1','pix')$$,'MM004',null,'sandbox still requires master');
reset role;
update public.platform_settings set value='"production"' where key='payments_env';
set local role authenticated;
select public.payments_validapay_open('00000000-0000-4000-8000-0000000013e1','festa','00000000-0000-4000-8000-0000000013b1','pix') as opened \gset
reset role;
select (:'opened'::jsonb)->>'orderId' as order_id \gset
select is((select provider_env from public.payment_orders where id=:'order_id'),'production','nonmaster owner opens production order');
select ok(not has_function_privilege('authenticated','public.payments_validapay_mark_attempt(uuid)','EXECUTE'),'browser cannot mark attempts');
select ok(not has_function_privilege('authenticated','public.payments_validapay_abandon(uuid)','EXECUTE'),'browser cannot bypass ownership check to abandon');
select ok(not has_function_privilege('anon','public.payments_validapay_abandon(uuid)','EXECUTE'),'anonymous cannot abandon');
set local role service_role;
select ok(public.payments_validapay_abandon(:'order_id'),'unattempted reservation can be abandoned');
select ok(not public.payments_validapay_mark_attempt(:'order_id'),'abandon winner prevents subsequent financial attempt');
reset role;
set local role authenticated;
select public.payments_validapay_open('00000000-0000-4000-8000-0000000013e1','festa','00000000-0000-4000-8000-0000000013b2','pix') as attempted \gset
reset role;
select (:'attempted'::jsonb)->>'orderId' as attempted_id \gset
set local role service_role;
select ok(public.payments_validapay_mark_attempt(:'attempted_id'),'mark obtains order lock before financial POST');
select ok(public.payments_validapay_mark_attempt(:'attempted_id'),'same-order uncertain retry remains possible');
select ok(not public.payments_validapay_abandon(:'attempted_id'),'attempt winner prevents abandoning uncertain payment');
select throws_ok(format('select public.payments_validapay_attach(%L,%L,%L)',:'attempted_id','SANDBOX_cha_wrong','pix'),'MM005',null,'production rejects sandbox IDs');
select public.payments_validapay_attach(:'attempted_id','cha_prod_local','pix');
select throws_ok(format('select public.payments_validapay_confirm(%L,%L::jsonb,%L)',:'attempted_id',jsonb_build_object('chargeId','cha_prod_local','merchantReference',:'attempted_id','environment','sandbox','currency','BRL','status','PAID','amountCents',2900,'paidAmountCents',2900,'method','pix')::text,'status'),'MM005',null,'sandbox evidence cannot grant real entitlements');
reset role;
select is((select count(*) from public.event_entitlements where order_id=:'attempted_id'),0::bigint,'env mismatch grants nothing');
set local role service_role;
select public.payments_validapay_confirm(:'attempted_id',jsonb_build_object('chargeId','cha_prod_local','merchantReference',:'attempted_id','environment','production','currency','BRL','status','PAID','amountCents',2900,'paidAmountCents',2900,'method','pix'),'status');
reset role;
select is((select count(*) from public.event_entitlements where order_id=:'attempted_id' and status='ativo'),1::bigint,'production confirmation grants owner benefits');
set local role service_role;
select throws_ok(format('select public.payments_validapay_claim_refund(%L,%L)',:'attempted_id','00000000-0000-4000-8000-0000000013f1'),'MM005',null,'production refund writer stays forbidden');
select public.payments_validapay_confirm_refund(:'attempted_id',jsonb_build_object('chargeId','cha_prod_local','merchantReference',:'attempted_id','environment','production','currency','BRL','amountCents',2900,'refundedCents',2900),'reconcile');
reset role;
select is((select count(*) from public.event_entitlements where order_id=:'attempted_id' and status='ativo'),0::bigint,'production verified refund readback revokes benefits');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000013a2","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select is((select count(*) from public.payment_orders where id=:'attempted_id'),0::bigint,'other owner cannot read production payment');
select throws_ok($$select public.payments_validapay_open('00000000-0000-4000-8000-0000000013e1','festa','00000000-0000-4000-8000-0000000013b3','pix')$$,'MM004',null,'other owner cannot open for this event');
reset role;
insert into public.validapay_webhook_inbox(provider_env,event_id,charge_id,event_type) values
('production','same-event','cha_prod_event','payment.success'),('sandbox','same-event','SANDBOX_cha_event','payment.success');
set local role service_role;
create temporary table vp_prod_claims as select * from public.payments_validapay_claim_inbox_env('production',50);
select is((select count(*) from vp_prod_claims where provider_env<>'production'),0::bigint,'production worker cannot lease sandbox deliveries');
select is((select count(*) from vp_prod_claims),1::bigint,'same event ID persists independently in both environments');
reset role;
select * from finish();
rollback;
