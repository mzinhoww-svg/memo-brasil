-- LIGA as vendas em produção: payments_env='production' e production_active em TODOS os planos pagos.
-- Decisão do dono em 2026-10-24 ("coloque tudo em produção e ligado", sem compra de teste prévia).
-- Desligar: supabase/ops/payments_first_purchase_close.sql (desliga env e todos os production_active).
-- Operador:  supabase db query --linked -f supabase/ops/payments_production_on.sql
begin;
select set_config('request.jwt.claims', json_build_object('sub','d58644e3-4ace-473a-bbc7-4edceb96fd5c','role','authenticated','app_metadata', json_build_object('role','master'))::text, true);
select public.admin_set_plan(p.code, p.price_cents, p.sandbox_active, true,
  'Abertura de vendas em producao por decisao do dono (supabase/ops/payments_production_on.sql)') from public.plans p where not p.is_free;
select public.admin_set_setting('payments_env', '"production"'::jsonb,
  'Abertura de vendas em producao por decisao do dono (supabase/ops/payments_production_on.sql)');
commit;
select public.payments_env() as env; -- esperado: production
select code, price_cents, production_active from public.plans order by sort; -- esperado: pagos com production_active=true
