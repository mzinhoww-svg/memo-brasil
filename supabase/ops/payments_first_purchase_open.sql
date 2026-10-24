-- ABRE a compra produtiva controlada: payments_env='production' e SOMENTE o plano festa com production_active.
-- NÃO EXECUTAR sem autorização específica do dono (plano, valor R$ 29,00, quem compra, quando). Janela curta: enquanto aberta,
-- qualquer visitante pode comprar o plano Festa. Feche com payments_first_purchase_close.sql logo após a compra e o reembolso.
-- Operador:  supabase db query --linked -f supabase/ops/payments_first_purchase_open.sql
begin;
select set_config('request.jwt.claims', json_build_object('sub','d58644e3-4ace-473a-bbc7-4edceb96fd5c','role','authenticated','app_metadata', json_build_object('role','master'))::text, true);
select public.admin_set_plan('festa', p.price_cents, p.sandbox_active, true,
  'Compra produtiva controlada pelo dono (supabase/ops/payments_first_purchase_open.sql)') from public.plans p where p.code = 'festa';
select public.admin_set_setting('payments_env', '"production"'::jsonb,
  'Compra produtiva controlada pelo dono (supabase/ops/payments_first_purchase_open.sql)');
commit;
select public.payments_env() as env; -- esperado: production
select code, price_cents, production_active from public.plans order by sort; -- esperado: só festa com production_active=true
