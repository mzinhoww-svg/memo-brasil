-- ABRE a janela de homologação do Mercado Pago (payments_env = 'sandbox'). Operador, a partir da raiz do repositório:
--   supabase db query --linked -f supabase/ops/payments_sandbox_open.sql
-- Auditado por admin_set_setting. O checkout de sandbox só funciona para o Master (403 sandbox_restrito para os demais) e usa
-- SOMENTE o token de teste do vendedor 3786688395. Feche a janela com payments_sandbox_close.sql.
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'd58644e3-4ace-473a-bbc7-4edceb96fd5c',
  'role', 'authenticated', 'app_metadata', json_build_object('role', 'master'))::text, true);
select public.admin_set_setting('payments_env', '"sandbox"'::jsonb,
  'Operador, por supabase db query --linked (supabase/ops/payments_sandbox_open.sql) - abre janela de homologacao sandbox do Mercado Pago');
commit;
select public.payments_env() as env, jsonb_array_length(public.list_public_plans()) as planos_publicos; -- esperado: sandbox, 5
