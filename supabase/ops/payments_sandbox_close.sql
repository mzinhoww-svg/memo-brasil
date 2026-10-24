-- FECHA a janela de homologação (payments_env = 'desligado'). Operador:
--   supabase db query --linked -f supabase/ops/payments_sandbox_close.sql
-- Depois rode o passo 2 do §9.1 do PAYMENTS-RUNBOOK (listar/reaplicar limites de eventos de teste; nada é apagado).
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'd58644e3-4ace-473a-bbc7-4edceb96fd5c',
  'role', 'authenticated', 'app_metadata', json_build_object('role', 'master'))::text, true);
select public.admin_set_setting('payments_env', '"desligado"'::jsonb,
  'Operador, por supabase db query --linked (supabase/ops/payments_sandbox_close.sql) - fim da janela de homologacao sandbox');
commit;
select public.payments_env() as env; -- esperado: desligado
