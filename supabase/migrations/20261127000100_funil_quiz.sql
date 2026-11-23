-- Funil de quiz (5 portas, uma por nível de consciência) com oferta de entrada: "Até 50 convidados" por R$ 19,90, válida 30 minutos
-- a partir do fim do quiz. ADITIVA: não muda preço, pedido nem direito existente.
--
-- Como funciona:
--   1. Quem termina o quiz vira um "lead" (funnel_leads). O lead não guarda nome, telefone nem e-mail: só o quiz, o perfil do
--      resultado, a faixa de convidados e a origem (UTM). O id do lead (uuid) é o que a pessoa leva no link.
--   2. A oferta vale 30 minutos DE VERDADE: o prazo nasce no banco (offer_expires_at) e é a cotação do servidor que confere.
--   3. Ao criar o evento, o anfitrião liga o lead ao evento (funnel_offer_claim). Só então o plano da oferta pode ser cotado e pago
--      para aquele evento, e só enquanto o prazo não venceu. O Pix aberto dentro do prazo segue válido pela validade normal do Pix.
--   4. O plano "ate50" é só da oferta (plans.offer_only): não aparece no catálogo público nem na página de preços.
--
-- O texto com a oferta sai pelo WhatsApp como resposta automática do gateway ao opt-in (subject `lead.<id>`); o banco só registra
-- que o contato foi confirmado (wa_confirmed_at), sem telefone.

-- ---------------------------------------------------------------- plano só de oferta
alter table public.plans add column offer_only boolean not null default false;

insert into public.plans (code, name, max_guests, max_shots, price_cents, sort, is_free, sandbox_active, production_active, features, offer_only)
values ('ate50', 'Até 50 convidados', 50, 36, 1990, 5, false, true, true, '[]', true)
on conflict (code) do nothing;

-- catálogo público: planos só de oferta ficam de fora (mesma regra das variantes "Mais poses")
create or replace function public.list_public_plans() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'features', p.features, 'highlighted', p.highlighted) order by p.sort, p.code), '[]')
  from public.plans p
  where p.pack_of is null and not p.offer_only
    and (p.is_free
     or (public.payments_env() = 'sandbox' and p.sandbox_active)
     or (public.payments_env() = 'production' and p.production_active))
$$;

-- ---------------------------------------------------------------- leads do funil (sem dado pessoal)
create table public.funnel_leads (
  id uuid primary key default gen_random_uuid(),
  quiz text not null check (quiz ~ '^[a-z0-9-]{1,40}$'),
  profile text check (profile is null or profile ~ '^[a-z0-9-]{1,40}$'),
  guests int check (guests is null or guests between 1 and 5000),
  source text check (source is null or char_length(source) <= 80),
  medium text check (medium is null or char_length(medium) <= 40),
  campaign text check (campaign is null or char_length(campaign) <= 60),
  created_at timestamptz not null default now(),
  offer_expires_at timestamptz not null default now() + interval '30 minutes',
  wa_confirmed_at timestamptz,
  user_id uuid references auth.users on delete set null,
  event_id uuid references public.events on delete set null,
  claimed_at timestamptz
);
create unique index funnel_leads_event_once on public.funnel_leads (event_id) where event_id is not null;
create index funnel_leads_created_idx on public.funnel_leads (created_at desc);
alter table public.funnel_leads enable row level security; -- nenhuma policy: só as funções abaixo (definer) leem e gravam
revoke all on public.funnel_leads from anon, authenticated;
grant select, insert, update, delete on public.funnel_leads to service_role;

-- plano vendido pela oferta do funil
create function public.funnel_offer_plan() returns text
language sql immutable set search_path = '' as $$ select 'ate50'::text $$;

-- cria o lead (só a Edge Function funnel-lead, que limita por IP antes de chamar)
create function public.funnel_lead_create(p_quiz text, p_profile text, p_guests int, p_source text, p_medium text, p_campaign text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.funnel_leads;
begin
  if p_quiz is null or p_quiz !~ '^[a-z0-9-]{1,40}$' or (p_profile is not null and p_profile !~ '^[a-z0-9-]{1,40}$')
     or (p_guests is not null and p_guests not between 1 and 5000) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  insert into public.funnel_leads (quiz, profile, guests, source, medium, campaign)
  values (p_quiz, p_profile, p_guests, public.origin_clean(p_source, 80), public.origin_clean(p_medium, 40), public.origin_clean(p_campaign, 60))
  returning * into l;
  return jsonb_build_object('leadId', l.id, 'expiresAt', l.offer_expires_at);
end $$;
revoke all on function public.funnel_lead_create(text, text, int, text, text, text) from public, anon, authenticated;
grant execute on function public.funnel_lead_create(text, text, int, text, text, text) to service_role;

-- contato confirmado pelo WhatsApp (webhook do gateway); idempotente, sem telefone
create function public.funnel_lead_confirm(p_lead uuid, p_at timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
begin
  update public.funnel_leads set wa_confirmed_at = coalesce(p_at, now()) where id = p_lead and wa_confirmed_at is null;
  if found then return 'applied'; end if;
  return case when exists (select 1 from public.funnel_leads where id = p_lead) then 'stale' else 'unknown_subject' end;
end $$;
revoke all on function public.funnel_lead_confirm(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.funnel_lead_confirm(uuid, timestamptz) to service_role;

-- a página da oferta lê o próprio lead pelo id (capacidade: uuid imprevisível; nada pessoal sai daqui).
-- `now` é o relógio do servidor, para a contagem regressiva não depender do relógio do aparelho.
-- `eventId` só volta para o dono do lead (quem já ligou o lead a um evento seu).
create function public.funnel_lead_view(p_lead uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare l public.funnel_leads; pl public.plans; mine boolean;
begin
  select * into l from public.funnel_leads where id = p_lead;
  if l.id is null then return null; end if;
  select * into pl from public.plans where code = public.funnel_offer_plan();
  mine := l.user_id is not null and l.user_id = auth.uid();
  return jsonb_build_object(
    'quiz', l.quiz, 'profile', l.profile, 'guests', l.guests, 'expiresAt', l.offer_expires_at, 'now', now(),
    'active', l.offer_expires_at > now()
      and ((public.payments_env() = 'sandbox' and pl.sandbox_active) or (public.payments_env() = 'production' and pl.production_active)),
    'planCode', pl.code, 'priceCents', pl.price_cents, 'maxGuests', pl.max_guests, 'maxShots', pl.max_shots,
    'claimed', l.event_id is not null,
    'eventId', case when mine then l.event_id end,
    'paid', mine and l.event_id is not null and public.payments_plan_covered(l.event_id, pl.code));
end $$;
revoke all on function public.funnel_lead_view(uuid) from public;
grant execute on function public.funnel_lead_view(uuid) to anon, authenticated;

-- oferta do funil válida agora para o evento
create function public.funnel_offer_active(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.funnel_leads l where l.event_id = p_event and l.offer_expires_at > now())
$$;
revoke all on function public.funnel_offer_active(uuid) from public, anon, authenticated;

-- o anfitrião liga o lead ao evento que acabou de criar. null = não há oferta (lead inexistente, vencido ou já usado em outro evento).
create function public.funnel_offer_claim(p_lead uuid, p_event uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.funnel_leads;
begin
  if auth.uid() is null or not exists (select 1 from public.events where id = p_event and host_id = auth.uid() and deleted_at is null) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  select * into l from public.funnel_leads where id = p_lead for update;
  if l.id is null or l.offer_expires_at <= now() then return null; end if;
  if l.event_id is not null and l.event_id <> p_event then return null; end if;
  if l.event_id is null then
    if exists (select 1 from public.funnel_leads where event_id = p_event) then return null; end if; -- um lead por evento
    if (select source from public.effective_entitlement(p_event)) <> 'gratis' then return null; end if;
    update public.funnel_leads set event_id = p_event, user_id = auth.uid(), claimed_at = now() where id = p_lead;
  end if;
  return jsonb_build_object('planCode', public.funnel_offer_plan(), 'expiresAt', l.offer_expires_at);
end $$;
revoke all on function public.funnel_offer_claim(uuid, uuid) from public, anon;
grant execute on function public.funnel_offer_claim(uuid, uuid) to authenticated;

-- oferta do funil do evento, para o painel (só o anfitrião ou o Master)
create function public.event_funnel_offer(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare l public.funnel_leads; pl public.plans;
begin
  if auth.uid() is null or not (public.is_host(p_event) or public.is_master()) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into l from public.funnel_leads where event_id = p_event and offer_expires_at > now();
  if l.id is null then return null; end if;
  select * into pl from public.plans where code = public.funnel_offer_plan();
  if public.payments_plan_covered(p_event, pl.code) then return null; end if;
  return jsonb_build_object('planCode', pl.code, 'priceCents', pl.price_cents, 'maxGuests', pl.max_guests, 'maxShots', pl.max_shots,
                            'expiresAt', l.offer_expires_at, 'now', now());
end $$;
revoke all on function public.event_funnel_offer(uuid) from public, anon;
grant execute on function public.event_funnel_offer(uuid) to authenticated;

-- ---------------------------------------------------------------- cotação: plano só de oferta exige a oferta do funil válida
-- (mesma função da migration 20261124000100; muda só: plano offer_only sem oferta válida = plano_inativo, e o desconto de 20% do
-- limite do grátis não se soma ao preço de oferta)
create or replace function public.payments_quote_internal(p_event uuid, p_plan text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ev public.events;
  pl public.plans;
  eff record;
  env text := public.payments_env();
  from_price int := 0;
  amount int;
  list_amount int;
  offer public.upgrade_offers;
  reason text := 'ok';
begin
  select * into ev from public.events where id = p_event and deleted_at is null;
  if not found then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into pl from public.plans where code = p_plan;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into eff from public.effective_entitlement(p_event);
  if eff.source = 'pago' then
    select p.price_cents into from_price from public.plans p where p.code = eff.plan_code;
  elsif pl.pack_of is not null and eff.source in ('cortesia', 'codigo') and public.payments_plan_covered(p_event, pl.pack_of) then
    select p.price_cents into from_price from public.plans p where p.code = pl.pack_of;
  end if;
  list_amount := greatest(pl.price_cents - coalesce(from_price, 0), 0);
  amount := list_amount;
  offer := public.upgrade_offer_active(p_event);
  if offer.id is not null and not pl.is_free and not pl.offer_only then
    amount := round(list_amount * (100 - offer.percent) / 100.0)::int;
  end if;
  if now() >= public.event_end(ev.start_at, ev.duration_hours, ev.ended_at) then
    reason := 'evento_encerrado';
  elsif env = 'desligado' or (env = 'sandbox' and not pl.sandbox_active) or (env = 'production' and not pl.production_active) then
    reason := 'plano_inativo';
  elsif pl.is_free or public.payments_plan_covered(p_event, p_plan) or amount = 0 then
    reason := 'ja_incluido';
  elsif pl.offer_only and not public.funnel_offer_active(p_event) then
    reason := 'plano_inativo';
  elsif amount < 100 then
    reason := 'valor_minimo';
  end if;
  return jsonb_build_object('planCode', pl.code, 'fromPlanCode', eff.plan_code, 'amountCents', amount,
                            'payable', reason = 'ok', 'reason', reason)
      || case when amount < list_amount
              then jsonb_build_object('listCents', list_amount, 'discountPct', offer.percent, 'offerExpiresAt', offer.expires_at)
              else '{}'::jsonb end;
end $$;

-- ---------------------------------------------------------------- relatório por quiz (equipe): os portões do funil
-- visitas (visitantes do dia na página do quiz), terminou (lead), contato (WhatsApp confirmado), evento criado, pedido aberto e pago.
-- Eventos, pedidos e receita nunca contam equipe, teste nem contas do dono (metrics_counts_host).
create function public.admin_funnel_report(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 1), 365);
  since timestamptz := now() - make_interval(days => d);
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return (
    with leads as (
      select l.*, (l.event_id is not null and public.metrics_counts_host(l.user_id)) as counts
      from public.funnel_leads l where l.created_at >= since
    ), orders as (
      select l.quiz, o.status, o.amount_cents
      from leads l join public.payment_orders o on o.event_id = l.event_id and o.plan_code = public.funnel_offer_plan()
      where l.counts and o.provider_env = 'production'
    ), quizzes as (
      select quiz from leads
      union
      select substr(h.path, 4) from public.access_hits h where h.at >= since and h.path ~ '^/q/[a-z0-9-]{1,40}$'
    )
    select jsonb_build_object('days', d, 'generatedAt', now(), 'rows', coalesce(jsonb_agg(jsonb_build_object(
      'quiz', q.quiz,
      'visitors', (select count(distinct h.visitor) from public.access_hits h where h.at >= since and h.path = '/q/' || q.quiz),
      'leads', (select count(*) from leads l where l.quiz = q.quiz),
      'whatsapp', (select count(*) from leads l where l.quiz = q.quiz and l.wa_confirmed_at is not null),
      'events', (select count(*) from leads l where l.quiz = q.quiz and l.counts),
      'ordersOpened', (select count(*) from orders o where o.quiz = q.quiz),
      'ordersPaid', (select count(*) from orders o where o.quiz = q.quiz and o.status = 'pago'),
      'revenueCents', (select coalesce(sum(o.amount_cents), 0) from orders o where o.quiz = q.quiz and o.status = 'pago')
    ) order by q.quiz), '[]'::jsonb))
    from quizzes q
  );
end $$;
revoke all on function public.admin_funnel_report(int) from public, anon;
grant execute on function public.admin_funnel_report(int) to authenticated;
