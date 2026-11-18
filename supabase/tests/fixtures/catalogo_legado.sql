-- Fixture: o catálogo de antes de 20261120000100_plans_faixas_convidados.sql (Grátis, Festa, Celebração, Casamento, Grande ativos;
-- sem as faixas novas). Os testes de pagamento/direitos usam esses planos como dados de exemplo da mecânica (cotação, pedido,
-- estorno, pacotes), que não depende de quais planos estão à venda. Incluído com \ir logo depois do `begin;` (some no rollback).
-- O catálogo vigente é coberto por 43_plans_faixas_convidados.test.sql e 44_faixas_upgrade_e_plano_atual.test.sql.
delete from public.plans where code in ('ate150', 'ate300');
update public.plans set sandbox_active = true, production_active = true where code in ('gratis', 'festa', 'celebracao', 'casamento', 'grande');
