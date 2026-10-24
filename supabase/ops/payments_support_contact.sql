-- Grava o contato de suporte informado por Aurimar no chat (2026-10-24). NÃO grava razão social nem CNPJ (D5: dados do dono, não inventar).
-- Operador:  supabase db query --linked -f supabase/ops/payments_support_contact.sql
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', 'd58644e3-4ace-473a-bbc7-4edceb96fd5c',
  'role', 'authenticated', 'app_metadata', json_build_object('role', 'master'))::text, true);
select public.admin_set_setting('support_email', '"mazinhoww@gmail.com"'::jsonb,
  'Contato de suporte informado pelo dono no chat em 2026-10-24 (supabase/ops/payments_support_contact.sql)');
commit;
select key, value from public.platform_settings where key = 'support_email'; -- esperado: mazinhoww@gmail.com
