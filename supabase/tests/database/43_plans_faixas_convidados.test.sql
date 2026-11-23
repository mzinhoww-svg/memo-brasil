-- pgTAP · catálogo por faixa de convidados: Grátis (até 10), Até 150 (R$ 147), Até 300 (R$ 297); planos antigos desligados, não apagados.
begin;
select plan(9);

select is((select array_agg(code order by sort) from public.plans where production_active and pack_of is null and not offer_only),
  array['gratis', 'ate150', 'ate300'], 'produção: só três planos visíveis');
select is((select array_agg(code order by sort) from public.plans where sandbox_active and pack_of is null and not offer_only),
  array['gratis', 'ate150', 'ate300'], 'sandbox: os mesmos três');
select is((select price_cents from public.plans where code = 'ate150'), 14700, 'até 150 = R$ 147');
select is((select price_cents from public.plans where code = 'ate300'), 29700, 'até 300 = R$ 297');
select is((select max_guests from public.plans where code = 'ate300'), 300, 'até 300 convidados');
select is((select max_shots from public.plans where code = 'ate150'), 36, '36 poses');
select is((select array_agg(code) from public.plans where highlighted), array['ate150'], 'destaque único no até 150');
select ok(exists (select 1 from public.plans where code = 'casamento' and not production_active and not sandbox_active), 'antigo preservado e desligado');
select is((select max_guests from public.plans where code = 'gratis'), 10, 'Grátis segue até 10');

select * from finish();
rollback;
