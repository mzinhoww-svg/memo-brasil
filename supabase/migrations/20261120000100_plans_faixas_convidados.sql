-- Catálogo por faixa de convidados (design 2026-11-18): Grátis até 10, "Até 150 convidados" R$ 147 e "Até 300 convidados" R$ 297,
-- 36 poses por convidado nos pagos. Acima de 300, o atendimento é pelo WhatsApp (fora do catálogo).
-- Os planos antigos ficam desligados e NUNCA são apagados: eventos que já os compraram continuam reconhecidos pelo código
-- (event_entitlements.plan_code referencia plans).
-- sort 10/20: acima de todos os planos antigos (1..4). effective_entitlement escolhe o plano do direito pelo MAIOR sort; com sort menor,
-- um evento que comprou "Celebração" e depois "Até 150" continuaria lido como Celebração (e a cotação do próximo upgrade cobraria a mais).

insert into public.plans (code, name, max_guests, max_shots, price_cents, sort, is_free, sandbox_active, production_active, features)
values
  ('ate150', 'Até 150 convidados', 150, 36, 14700, 10, false, true, true, '[]'),
  ('ate300', 'Até 300 convidados', 300, 36, 29700, 20, false, true, true, '[]')
on conflict (code) do update set
  name = excluded.name, max_guests = excluded.max_guests, max_shots = excluded.max_shots, price_cents = excluded.price_cents,
  sort = excluded.sort, is_free = false, sandbox_active = true, production_active = true;

update public.plans set sandbox_active = false, production_active = false
where code not in ('gratis', 'ate150', 'ate300');

-- destaque único (índice parcial plans_single_highlighted): limpa antes de marcar
update public.plans set highlighted = false where highlighted and code <> 'ate150';
update public.plans set highlighted = true where code = 'ate150';

-- Plano vigente do evento com nome e limites, mesmo quando o plano saiu do catálogo público (plano antigo desligado):
-- o painel não consegue achar "Casamento" em list_public_plans e cairia no Grátis. Só o anfitrião do evento ou o Master.
-- Limites: os do direito efetivo (effective_entitlement), não os do plano; nome e preço: os do plano (ou da variante "Mais poses").
create or replace function public.event_current_plan(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare eff record; pl record;
begin
  if auth.uid() is null or not (public.is_host(p_event) or public.is_master()) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  select * into eff from public.effective_entitlement(p_event);
  select * into pl from public.plans where code = eff.plan_code;
  return jsonb_build_object('code', eff.plan_code, 'name', coalesce(pl.name, eff.plan_code), 'maxGuests', eff.max_guests,
    'maxShots', eff.max_shots, 'priceCents', coalesce(pl.price_cents, 0), 'isFree', coalesce(pl.is_free, false), 'source', eff.source);
end $$;
revoke execute on function public.event_current_plan(uuid) from public, anon;
grant execute on function public.event_current_plan(uuid) to authenticated, service_role;
