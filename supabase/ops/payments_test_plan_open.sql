-- CRIA o plano de teste real "teste1real" (R$ 1,00, só produção) pedido por Aurimar em 2026-10-24. Aparece na lista pública
-- enquanto production_active = true. Feche com payments_test_plan_close.sql logo após a compra.
-- Operador:  supabase db query --linked -f supabase/ops/payments_test_plan_open.sql
begin;
insert into public.plans (code, name, max_guests, max_shots, price_cents, sort, is_free, sandbox_active, production_active)
values ('teste1real', 'Teste R$ 1', 10, 10, 100, 99, false, false, true)
on conflict (code) do update set price_cents = 100, production_active = true, sandbox_active = false;
commit;
select code, name, price_cents, production_active from public.plans order by sort;
