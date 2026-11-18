-- pgTAP · faixas por convidados com eventos que já pagaram planos antigos:
-- (1) depois de comprar uma faixa nova, o plano efetivo é a faixa (sort acima dos antigos) e o próximo upgrade cobra só a diferença dela;
-- (2) event_current_plan devolve nome e limites do plano atual mesmo fora do catálogo público, só para o anfitrião/Master.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', '{}'::json)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

update public.platform_settings set value = to_jsonb('sandbox'::text) where key = 'payments_env';

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000044a1', 'authenticated', 'authenticated', 'host44@test.local', false),
  ('00000000-0000-4000-8000-0000000044a2', 'authenticated', 'authenticated', 'outro44@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%44@test.local' on conflict do nothing;
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, start_at) values
  ('00000000-0000-4000-8000-0000000044e1', 'Celebração antiga', 'festa', '00000000-0000-4000-8000-0000000044a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-0000000044e2', 'Casamento antigo', 'casamento', '00000000-0000-4000-8000-0000000044a1', 'H', 6, 10, 10, now());

-- ===================================================== ordem: as faixas novas ficam acima de todos os planos antigos
select ok((select min(sort) from public.plans where code in ('ate150', 'ate300'))
          > (select max(sort) from public.plans where code in ('festa', 'celebracao', 'casamento', 'grande')), 'faixas novas com sort acima dos antigos');

-- ===================================================== Celebração (antigo) → Até 150 → cotação do Até 300
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env) values
  ('00000000-0000-4000-8000-0000000044e1', 'celebracao', 100, 24, 'pago', 'sandbox'),
  ('00000000-0000-4000-8000-0000000044e1', 'ate150', 150, 36, 'pago', 'sandbox');
select is((select plan_code from public.effective_entitlement('00000000-0000-4000-8000-0000000044e1')), 'ate150', 'depois do upgrade, o plano efetivo é a faixa nova');
select tests.login('00000000-0000-4000-8000-0000000044a1');
select is(public.payments_quote('00000000-0000-4000-8000-0000000044e1', 'ate300') ->> 'amountCents', '15000', 'Até 150 → Até 300 cobra só a diferença (R$ 150)');
select is(public.payments_quote('00000000-0000-4000-8000-0000000044e1', 'ate150') ->> 'reason', 'ja_incluido', 'Até 150 já incluído');
reset role;

-- ===================================================== plano atual fora do catálogo público
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env) values
  ('00000000-0000-4000-8000-0000000044e2', 'casamento', 250, 36, 'pago', 'sandbox');
select tests.login('00000000-0000-4000-8000-0000000044a1');
select is(public.event_current_plan('00000000-0000-4000-8000-0000000044e2') - 'source',
  '{"code":"casamento","name":"Casamento","maxGuests":250,"maxShots":36,"priceCents":18900,"isFree":false}'::jsonb,
  'anfitrião vê o plano antigo com nome e limites');
select ok(not exists (select 1 from jsonb_array_elements(public.list_public_plans()) p where p ->> 'code' = 'casamento'), 'casamento fora do catálogo público');
select is(public.event_current_plan('00000000-0000-4000-8000-0000000044e1') ->> 'code', 'ate150', 'faixa nova também é devolvida');
reset role;
select tests.login('00000000-0000-4000-8000-0000000044a2');
select throws_ok($$select public.event_current_plan('00000000-0000-4000-8000-0000000044e2')$$, 'MM004', null, 'outro usuário não vê o plano do evento');
reset role;

select * from finish();
rollback;
