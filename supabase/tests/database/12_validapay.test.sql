-- Local-only financial tests. No network or real charges.
begin;
select no_plan();
create function pg_temp.vp_confirm(p_order uuid,p_charge jsonb,p_source text) returns jsonb language sql as $$
 select public.payments_validapay_confirm(p_order,p_charge||jsonb_build_object('merchantReference',p_order::text),p_source)
$$;
select has_function('public','payments_validapay_open',array['uuid','text','uuid','text']);
select has_function('public','payments_validapay_attach',array['uuid','text','text']);
select has_function('public','payments_validapay_confirm',array['uuid','jsonb','text']);
select has_table('public','validapay_webhook_inbox','private durable inbox exists');
select ok(not has_table_privilege('authenticated','public.validapay_webhook_inbox','SELECT'), 'inbox private');
select ok(not has_function_privilege('authenticated','public.payments_validapay_confirm(uuid,jsonb,text)','EXECUTE'), 'browser cannot confirm financial state');
select ok(not has_function_privilege('anon','public.payments_validapay_open(uuid,text,uuid,text)','EXECUTE'), 'anonymous cannot open');

insert into auth.users (id,aud,role,email,is_anonymous) values
 ('00000000-0000-4000-8000-0000000012a1','authenticated','authenticated','vp-master@test.local',false),
 ('00000000-0000-4000-8000-0000000012a2','authenticated','authenticated','vp-other@test.local',false);
insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000012a1'),('00000000-0000-4000-8000-0000000012a2') on conflict do nothing;
insert into public.platform_roles (user_id,role) values ('00000000-0000-4000-8000-0000000012a1','master');
insert into public.events (id,title,category,host_id,host_name,duration_hours,capacity,shots_per_person,start_at)
values ('00000000-0000-4000-8000-0000000012e1','ValidaPay local','festa','00000000-0000-4000-8000-0000000012a1','Teste',6,10,10,now());
update public.platform_settings set value='"sandbox"' where key='payments_env';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000012a1","role":"authenticated","is_anonymous":false,"app_metadata":{"role":"master"}}',true);
set local role authenticated;
select throws_ok($$select public.payments_validapay_open('00000000-0000-4000-8000-0000000012e1','festa','00000000-0000-4000-8000-0000000012b1','pix')$$,'MM014',null,'disabled by default');
reset role;
insert into public.feature_flags(key,enabled) values('validapay_checkout',true);
set local role authenticated;
select public.payments_validapay_open('00000000-0000-4000-8000-0000000012e1','festa','00000000-0000-4000-8000-0000000012b1','pix') as vp_order \gset
select is((:'vp_order'::jsonb)->>'provider','validapay','new provider');
select is((:'vp_order'::jsonb)->>'amountCents','2900','price comes from the database');
select is((public.payments_validapay_open('00000000-0000-4000-8000-0000000012e1','festa','00000000-0000-4000-8000-0000000012b1','pix'))->>'orderId',(:'vp_order'::jsonb)->>'orderId','same key reuses order');
select throws_ok($$select public.payments_open_order('00000000-0000-4000-8000-0000000012e1','festa','00000000-0000-4000-8000-0000000012b2')$$,'MM013',null,'legacy cannot cancel a ValidaPay order');
reset role;
select (:'vp_order'::jsonb)->>'orderId' as vp_id \gset
set local role service_role;
select lives_ok(format('select public.payments_validapay_attach(%L,%L,%L)',:'vp_id','SANDBOX_cha_local','pix'),'attach');
select lives_ok(format('select public.payments_validapay_attach(%L,%L,%L)',:'vp_id','SANDBOX_cha_local','pix'),'attach idempotent');
select throws_ok(format('select public.payments_validapay_attach(%L,%L,%L)',:'vp_id','cha_other','pix'),'MM005',null,'cannot replace charge');
select throws_ok(format('select pg_temp.vp_confirm(%L,%L::jsonb,%L)',:'vp_id','{"chargeId":"SANDBOX_cha_local","environment":"production","currency":"BRL","status":"PAID","amountCents":2900,"paidAmountCents":2900,"method":"pix"}','status'),'MM005',null,'wrong environment');
select throws_ok(format('select pg_temp.vp_confirm(%L,%L::jsonb,%L)',:'vp_id','{"chargeId":"SANDBOX_cha_local","environment":"sandbox","currency":"USD","status":"PAID","amountCents":2900,"paidAmountCents":2900,"method":"pix"}','status'),'MM005',null,'wrong currency');
select lives_ok(format('select pg_temp.vp_confirm(%L,%L::jsonb,%L)',:'vp_id','{"chargeId":"SANDBOX_cha_local","environment":"sandbox","currency":"BRL","status":"PAID","amountCents":1,"paidAmountCents":1,"method":"pix"}','status'),'mismatched received money is durably escalated');
reset role;
select ok((select needs_refund from public.payment_orders where id=:'vp_id'::uuid),'mismatched received money needs financial review');
select is((select count(*) from public.event_entitlements where order_id=:'vp_id'::uuid),0::bigint,'mismatch never grants benefits');
set local role service_role;
select pg_temp.vp_confirm(:'vp_id','{"chargeId":"SANDBOX_cha_local","environment":"sandbox","currency":"BRL","status":"PAID","amountCents":2900,"paidAmountCents":2900,"method":"pix"}','status');
select pg_temp.vp_confirm(:'vp_id','{"chargeId":"SANDBOX_cha_local","environment":"sandbox","currency":"BRL","status":"PAID","amountCents":2900,"paidAmountCents":2900,"method":"pix"}','webhook');
reset role;
select is((select count(*) from public.event_entitlements where order_id=:'vp_id'::uuid),1::bigint,'benefit once');
select is((select status::text from public.payment_orders where id=:'vp_id'::uuid),'pago','confirmed financial status');
set local role service_role;
select pg_temp.vp_confirm(:'vp_id','{"chargeId":"SANDBOX_cha_local","environment":"sandbox","currency":"BRL","status":"PENDING","amountCents":2900,"method":"pix"}','webhook');
reset role;
select is((select status::text from public.payment_orders where id=:'vp_id'::uuid),'pago','out-of-order pending cannot revoke paid');
set local role service_role;
select is(public.payments_validapay_claim_refund(:'vp_id','00000000-0000-4000-8000-0000000012f1')->>'claimed','true','full refund intent is reserved once');
select is(public.payments_validapay_claim_refund(:'vp_id','00000000-0000-4000-8000-0000000012f2')->>'claimed','false','another click cannot send a second refund POST');
select public.payments_validapay_confirm_refund(:'vp_id',jsonb_build_object('chargeId','SANDBOX_cha_local','merchantReference',:'vp_id','environment','sandbox','currency','BRL','amountCents',2900,'refundedCents',500),'status');
reset role;
select is((select count(*) from public.event_entitlements where order_id=:'vp_id'::uuid and status='ativo'),1::bigint,'partial refund does not revoke the plan');
set local role service_role;
select public.payments_validapay_confirm_refund(:'vp_id',jsonb_build_object('chargeId','SANDBOX_cha_local','merchantReference',:'vp_id','environment','sandbox','currency','BRL','amountCents',2900,'refundedCents',2900),'status');
select public.payments_validapay_confirm_refund(:'vp_id',jsonb_build_object('chargeId','SANDBOX_cha_local','merchantReference',:'vp_id','environment','sandbox','currency','BRL','amountCents',2900,'refundedCents',2900),'webhook');
reset role;
select is((select status::text from public.payment_orders where id=:'vp_id'::uuid),'estornado','full confirmed refund changes financial state');
select is((select count(*) from public.event_entitlements where order_id=:'vp_id'::uuid and status='ativo'),0::bigint,'full confirmed refund revokes benefits idempotently');
select ok(not has_function_privilege('authenticated','public.payments_validapay_confirm_refund(uuid,jsonb,text)','EXECUTE'),'buyer cannot forge refund confirmation');
set local role authenticated;
select public.payments_validapay_open('00000000-0000-4000-8000-0000000012e1','festa','00000000-0000-4000-8000-0000000012b9','pix') as vp_early \gset
reset role;
select (:'vp_early'::jsonb)->>'orderId' as early_id \gset
set local role service_role;
select public.payments_validapay_attach(:'early_id','SANDBOX_cha_early_refund','pix');
select public.payments_validapay_confirm_refund(:'early_id',jsonb_build_object('chargeId','SANDBOX_cha_early_refund','merchantReference',:'early_id','environment','sandbox','currency','BRL','amountCents',2900,'refundedCents',2900),'webhook');
reset role;
select is((select status::text from public.payment_orders where id=:'early_id'::uuid),'estornado','refund before payment confirmation closes the order');
select is((select count(*) from public.event_entitlements where order_id=:'early_id'::uuid),0::bigint,'early refund never creates benefits');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000012a2","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select is((select count(*) from public.payment_orders where id=:'vp_id'::uuid),0::bigint,'other buyer cannot read order');
select throws_ok(format('select public.payments_order_status(%L)',:'vp_id'),'MM004',null,'other buyer cannot recover order');
reset role;
-- Poison records cannot hide later work, and parallel workers cannot claim the same batch.
insert into public.validapay_webhook_inbox(event_id,charge_id,event_type)
 select 'poison-'||g,'cha_unknown_'||g,'payment.success' from generate_series(1,55) g;
set local role service_role;
create temporary table first_claim as select * from public.payments_validapay_claim_inbox(50);
create temporary table second_claim as select * from public.payments_validapay_claim_inbox(50);
select is((select count(*) from first_claim),50::bigint,'first worker claims fifty records');
select is((select count(*) from second_claim),5::bigint,'later events progress despite fifty poison records');
select is((select count(*) from first_claim a join second_claim b using(event_id)),0::bigint,'leases prevent duplicate concurrent claims');
reset role;
select * from finish();
rollback;
