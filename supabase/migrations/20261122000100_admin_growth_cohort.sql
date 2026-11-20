-- GF-01 · Funil por coorte de eventos criados, totalmente aditivo.
-- Somente MASTER lê: agrega sem expor usuários, fotos, pedidos individuais ou dados biométricos.
-- Não une `access_hits` a contas (hash diário não permite atribuição longitudinal).
-- Maturação: métricas posteriores à criação são avaliadas até o momento da consulta;
-- coortes recentes naturalmente têm menor janela de oportunidade.
-- O painel não é DRE: paidCents representa soma bruta dos pedidos que AINDA estão
-- em estado 'pago' (não subtrai estornos parciais); outras situações são separadas.
-- Rollback: DROP FUNCTION public.admin_growth_cohort(integer).
create function public.admin_growth_cohort(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 90);
  v_today date := (now() at time zone 'America/Cuiaba')::date;
  v_from timestamptz := ((v_today - (v_days - 1))::timestamp at time zone 'America/Cuiaba');
  v_to timestamptz := ((v_today + 1)::timestamp at time zone 'America/Cuiaba');
  v_result jsonb;
begin
  if not public.is_master() then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  with cohort as (
    select e.id, e.host_id, (e.created_at at time zone 'America/Cuiaba')::date as cohort_day
    from public.events e
    left join public.profiles prof on prof.id = e.host_id
    where e.created_at >= v_from and e.created_at < v_to
      and e.deleted_at is null
      and not e.is_test and not coalesce(prof.is_test, false)
  ),
  flags as (
    select c.id, c.cohort_day,
      exists (select 1 from public.participants p
        where p.event_id = c.id and p.user_id <> c.host_id and p.blocked_at is null) as has_guest,
      exists (select 1 from public.photos ph
        where ph.event_id = c.id and ph.upload_status = 'pronta'
          and ph.status = 'visivel' and ph.deleted_at is null) as has_photo,
      exists (select 1 from public.payment_orders o
        where o.event_id = c.id and o.provider_env = 'production'
          and o.currency = 'BRL') as has_checkout,
      exists (select 1 from public.payment_orders o
        where o.event_id = c.id and o.provider_env = 'production'
          and o.currency = 'BRL' and o.status = 'pago' and o.paid_at is not null) as has_paid,
      exists (select 1 from public.event_entitlements ee
        where ee.event_id = c.id and ee.source in ('codigo', 'cortesia')
          and ee.status = 'ativo') as has_courtesy
    from cohort c
  ),
  totals as (
    select count(*)::int as created,
      count(*) filter (where has_guest)::int as with_guests,
      count(*) filter (where has_photo)::int as with_photos,
      count(*) filter (where has_guest and has_photo)::int as activated,
      count(*) filter (where has_checkout)::int as checkout_events,
      count(*) filter (where has_paid)::int as paid_events,
      count(*) filter (where has_courtesy)::int as courtesy_events
    from flags
  ),
  order_stats as (
    select count(*) filter (where o.status = 'pago' and o.paid_at is not null)::int as paid_orders,
      coalesce(sum(o.amount_cents) filter (where o.status = 'pago' and o.paid_at is not null), 0)::bigint as paid_cents,
      count(*) filter (where o.status in ('estornado', 'em_disputa', 'perdido'))::int as reversed_or_disputed
    from public.payment_orders o join cohort c on c.id = o.event_id
    where o.provider_env = 'production' and o.currency = 'BRL'
  )
  select jsonb_build_object(
    'days', v_days,
    'timezone', 'America/Cuiaba',
    'from', v_from,
    'toExclusive', v_to,
    'generatedAt', now(),
    'totals', jsonb_build_object(
      'created', t.created, 'withGuests', t.with_guests,
      'withPhotos', t.with_photos, 'activated', t.activated,
      'checkoutEvents', t.checkout_events, 'paidEvents', t.paid_events,
      'courtesyEvents', t.courtesy_events, 'paidOrders', os.paid_orders,
      'paidCents', os.paid_cents, 'reversedOrDisputedOrders', os.reversed_or_disputed
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', s.cohort_day, 'created', s.created, 'activated', s.activated,
        'checkoutEvents', s.checkout_events, 'paidEvents', s.paid_events
      ) order by s.cohort_day), '[]'::jsonb)
      from (
        select g.day::date as cohort_day, count(f.id)::int as created,
          count(f.id) filter (where f.has_guest and f.has_photo)::int as activated,
          count(f.id) filter (where f.has_checkout)::int as checkout_events,
          count(f.id) filter (where f.has_paid)::int as paid_events
        from generate_series((v_today - (v_days - 1))::timestamp,
          v_today::timestamp, interval '1 day') as g(day)
        left join flags f on f.cohort_day = g.day::date
        group by g.day
      ) s
    )
  ) into v_result
  from totals t cross join order_stats os;
  return v_result;
end $$;

-- Public é um schema exposto; execute só após autenticação e dupla verificação
-- de cargo (app_metadata + platform_roles via public.is_master()).
revoke all on function public.admin_growth_cohort(integer) from public, anon;
grant execute on function public.admin_growth_cohort(integer) to authenticated;
