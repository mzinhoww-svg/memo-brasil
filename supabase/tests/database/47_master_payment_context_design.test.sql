begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values ('47000000-0000-4000-8000-000000000001','m47@test.local',false),('47000000-0000-4000-8000-000000000002','s47@test.local',false);
insert into public.platform_roles(user_id,role) values ('47000000-0000-4000-8000-000000000001','master'),('47000000-0000-4000-8000-000000000002','support');
insert into public.events(id,title,category,host_id,host_name,duration_hours,capacity,shots_per_person,start_at) values ('47000000-0000-4000-8000-000000000100','Evento47','festa','47000000-0000-4000-8000-000000000001','Teste',6,10,10,now());
insert into public.payment_orders(id,event_id,host_id,plan_code,amount_cents,provider,provider_env,provider_charge_id,idempotency_key,status,paid_at) values
 ('47000000-0000-4000-8000-000000000200','47000000-0000-4000-8000-000000000100','47000000-0000-4000-8000-000000000001','festa',2900,'validapay','production','cha_master47',gen_random_uuid(),'pago',now()),
 ('47000000-0000-4000-8000-000000000201','47000000-0000-4000-8000-000000000100','47000000-0000-4000-8000-000000000001','festa',2900,'validapay','sandbox','SANDBOX_cha_master47',gen_random_uuid(),'pago',now());
insert into public.validapay_webhook_inbox(event_id,charge_id,event_type,received_at,provider_env) values
 ('master47_wrong_env','cha_master47','payment.success',now()-interval '3 hours','sandbox'),
 ('master47_other_type','cha_master47','payment.failed',now()-interval '2 hours','production'),
 ('master47_valid','cha_master47','payment.success',now()-interval '1 hour','production');
insert into public.event_entitlements(event_id,plan_code,max_guests,max_shots,source,order_id,env) values
 ('47000000-0000-4000-8000-000000000100','festa',30,24,'pago','47000000-0000-4000-8000-000000000200','production');
select set_config('request.jwt.claims','{"sub":"47000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"master"}}',true);
set local role authenticated;
select is((public.admin_master_payment_context('47000000-0000-4000-8000-000000000200')->>'webhookAt')::timestamptz,now()-interval '1 hour','recebimento usa cobrança, ambiente e tipo corretos');
select is(public.admin_master_payment_context('47000000-0000-4000-8000-000000000200')->'grant'->>'maxGuests','30','convidados vêm da concessão deste pedido');
select is(public.admin_master_payment_context('47000000-0000-4000-8000-000000000200')->'grant'->>'maxShots','24','poses vêm da concessão deste pedido');
select ok(public.admin_master_payment_context('47000000-0000-4000-8000-000000000200')->'grant'->>'at' is not null,'horário real da concessão está presente');
select ok(public.admin_master_payment_context('47000000-0000-4000-8000-000000000201')->'webhookAt'='null'::jsonb and public.admin_master_payment_context('47000000-0000-4000-8000-000000000201')->'grant'='null'::jsonb,'pago sem webhook/concessão não inventa fatos');
select is((select array_agg(k order by k) from jsonb_object_keys(public.admin_master_payment_context('47000000-0000-4000-8000-000000000200')) k),array['grant','hostName','order','webhookAt'],'contexto expõe apenas projeção do pedido, anfitrião e fatos operacionais');
select is(public.admin_master_payment_context('47000000-0000-4000-8000-000000000200')->>'hostName','Teste','anfitrião vem do evento associado');
reset role;
insert into public.payment_orders(event_id,host_id,plan_code,amount_cents,provider_env,idempotency_key,status,created_at)
select '47000000-0000-4000-8000-000000000100','47000000-0000-4000-8000-000000000001','festa',2900,'production',gen_random_uuid(),'pago',now()+interval '1 day' from generate_series(1,501);
set local role authenticated;
select ok(not exists(select 1 from public.admin_list_payments(null,500) x where x->>'orderId'='47000000-0000-4000-8000-000000000200'),'pedido antigo está fora dos últimos 500');
select is(public.admin_master_payment_context('47000000-0000-4000-8000-000000000200')->'order'->>'orderId','47000000-0000-4000-8000-000000000200','detalhe por UUID encontra pedido antigo sem truncar');
select ok(not (public.admin_master_payment_context('47000000-0000-4000-8000-000000000200')->'order' ?| array['brcode','brcode_base64','idempotency_key','payer','email','taxId']),'projeção usa allowlist financeira sem payload ou dados do comprador');
select throws_ok($$select public.admin_master_payment_context('47000000-0000-4000-8000-000000000999')$$,'MM005','invalid','pedido inexistente recusado');
reset role;
select set_config('request.jwt.claims','{"sub":"47000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"support"}}',true);
set local role authenticated;
select throws_ok($$select public.admin_master_payment_context('47000000-0000-4000-8000-000000000200')$$,'MM004','forbidden','support não acessa dados financeiros');
reset role;
select ok(not has_function_privilege('anon','public.admin_master_payment_context(uuid)','execute'),'anon sem grant');
select * from finish();
rollback;
