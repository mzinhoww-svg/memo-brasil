-- REMOVE o plano de teste: apaga a linha se nenhum pedido/direito a referencia; senão apenas esconde (production_active=false),
-- porque pedido pago e direito concedido precisam manter o vínculo (histórico financeiro). Em ambos os casos some da lista pública.
-- Operador:  supabase db query --linked -f supabase/ops/payments_test_plan_close.sql
begin;
update public.plans set production_active = false, sandbox_active = false where code = 'teste1real';
do $$
begin
  begin
    delete from public.plans where code = 'teste1real';
    raise notice 'plano teste1real apagado';
  exception when foreign_key_violation then
    raise notice 'plano teste1real mantido (inativo) por ter pedido/direito vinculado';
  end;
end $$;
commit;
select code, price_cents, production_active from public.plans order by sort;
