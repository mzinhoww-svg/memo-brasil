-- FECHA a compra controlada: payments_env='desligado' e production_active=false em todos os planos pagos.
-- Operador:  supabase db query --linked -f supabase/ops/payments_first_purchase_close.sql
begin;
select set_config('request.jwt.claims', json_build_object('sub','d58644e3-4ace-473a-bbc7-4edceb96fd5c','role','authenticated','app_metadata', json_build_object('role','master'))::text, true);
select public.admin_set_setting('payments_env', '"desligado"'::jsonb,
  'Fim da compra produtiva controlada (supabase/ops/payments_first_purchase_close.sql)');
select public.admin_set_plan(p.code, p.price_cents, p.sandbox_active, false,
  'Fim da compra produtiva controlada (supabase/ops/payments_first_purchase_close.sql)') from public.plans p where p.production_active and not p.is_free;
commit;
select public.payments_env() as env; -- esperado: desligado
