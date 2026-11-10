-- Desfaz as migrations 20261110000300 a 20261110000500 (pedido de impressão, exportação CSV do Master, conciliação manual).
-- ATENÇÃO: apagar print_orders descarta os pedidos de impressão e os dados de contato/endereço. Exporte antes se houver pedidos reais.
-- A trilha em audit_logs é imutável e continua com as linhas `export.csv`, `print_order.*` e `payments.reconcile_requested`.
-- Remova também a Edge Function: `supabase functions delete payments-reconcile-now` (e o bloco [functions.payments-reconcile-now] do config.toml).
begin;
-- 20261110000500
drop function if exists public.admin_request_reconcile();
-- 20261110000400
drop function if exists public.admin_export_csv(text, jsonb);
drop function if exists public.csv_line(text[]);
drop function if exists public.csv_ts(timestamptz);
drop function if exists public.csv_cell(text);
-- 20261110000300
drop function if exists public.admin_set_print_order_status(uuid, text, text);
drop function if exists public.admin_print_orders(text, text, int, int);
drop function if exists public.cancel_print_order(uuid);
drop function if exists public.list_my_print_orders(uuid);
drop function if exists public.create_print_order(uuid, uuid, text, int, uuid[], boolean, text, text, text, jsonb, text);
drop function if exists public.print_order_json(public.print_orders, boolean);
drop table if exists public.print_orders;
-- registro das migrations (Supabase CLI)
delete from supabase_migrations.schema_migrations where version in ('20261110000300', '20261110000400', '20261110000500');
commit;
