begin;
select no_plan();
delete from public.validapay_webhook_inbox;
insert into public.validapay_webhook_inbox(provider_env,event_id,charge_id,event_type)
 select 'sandbox','batch-'||g,'SANDBOX_cha_batch_'||g,'payment.success' from generate_series(1,120) g;
insert into public.validapay_webhook_inbox(provider_env,event_id,charge_id,event_type)
 select 'production','batch-'||g,'cha_batch_'||g,'payment.success' from generate_series(1,3) g;
set local role service_role;
create temporary table batch_a as select * from public.payments_validapay_claim_inbox_env('sandbox',50);
create temporary table batch_b as select * from public.payments_validapay_claim_inbox_env('sandbox',50);
create temporary table batch_c as select * from public.payments_validapay_claim_inbox_env('sandbox',50);
select is((select count(*) from batch_a),50::bigint,'first lease is bounded at fifty');
select is((select count(*) from batch_b),50::bigint,'second lease advances another fifty');
select is((select count(*) from batch_c),20::bigint,'remaining twenty are reachable');
select is((select count(*) from batch_a a join batch_b b using(provider_env,event_id)),0::bigint,'lease batches do not overlap');
select is((select count(*) from public.payments_validapay_claim_inbox_env('sandbox',50)),0::bigint,'leased records wait for retry time');
select is((select count(*) from public.payments_validapay_claim_inbox_env('production',50)),3::bigint,'production identifiers are independently leased');
reset role;
update public.validapay_webhook_inbox set next_attempt_at=now() where provider_env='sandbox';
set local role service_role;
select is((select count(*) from public.payments_validapay_claim_inbox_env('sandbox',999)),100::bigint,'upper batch cap is one hundred');
select is((select count(*) from public.payments_validapay_claim_inbox_env('sandbox',0)),1::bigint,'lower batch cap is one');
reset role;
select ok(not has_function_privilege('authenticated','public.payments_validapay_claim_inbox_env(text,integer)','EXECUTE'),'browser cannot claim leases');
select * from finish();
rollback;
