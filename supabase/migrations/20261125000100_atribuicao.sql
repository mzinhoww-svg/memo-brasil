-- Atribuição: de onde veio quem criou o evento (primeiro toque do navegador, sem dado pessoal), gravado no evento e copiado para
-- o pedido; relatório "Conversão por origem" no Master. ADITIVA.
-- Métricas de conversão nunca contam equipe, contas/eventos de teste nem as contas listadas em platform_settings.metrics_excluded_hosts
-- (contas do próprio dono usadas para testar).

-- origin_* = primeiro toque (primeira visita do navegador); last_* = último toque (a origem mais recente antes de criar o evento).
alter table public.events
  add column origin_source text check (origin_source is null or char_length(origin_source) <= 80),
  add column origin_medium text check (origin_medium is null or char_length(origin_medium) <= 40),
  add column origin_campaign text check (origin_campaign is null or char_length(origin_campaign) <= 60),
  add column last_source text check (last_source is null or char_length(last_source) <= 80),
  add column last_medium text check (last_medium is null or char_length(last_medium) <= 40),
  add column last_campaign text check (last_campaign is null or char_length(last_campaign) <= 60);
alter table public.payment_orders
  add column origin_source text check (origin_source is null or char_length(origin_source) <= 80),
  add column origin_medium text check (origin_medium is null or char_length(origin_medium) <= 40),
  add column origin_campaign text check (origin_campaign is null or char_length(origin_campaign) <= 60),
  add column last_source text check (last_source is null or char_length(last_source) <= 80),
  add column last_medium text check (last_medium is null or char_length(last_medium) <= 40),
  add column last_campaign text check (last_campaign is null or char_length(last_campaign) <= 60);

insert into public.platform_settings (key, value) values ('metrics_excluded_hosts', '[]'::jsonb) on conflict (key) do nothing;

-- conta conta nas métricas? (não é equipe, não é teste, não está na lista do dono)
create function public.metrics_counts_host(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.platform_roles r where r.user_id = p_user)
     and not coalesce((select p.is_test from public.profiles p where p.id = p_user), false)
     and not coalesce((select (s.value ? p_user::text) from public.platform_settings s where s.key = 'metrics_excluded_hosts'), false)
$$;
revoke all on function public.metrics_counts_host(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- gravação pelo anfitrião (uma vez, logo depois de criar)
create function public.origin_clean(p text, p_max int) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]<>]', '', 'g')), p_max), '')
$$;

create function public.set_event_origin(p_event uuid, p_source text, p_medium text, p_campaign text,
  p_last_source text default null, p_last_medium text default null, p_last_campaign text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare has_last boolean := public.origin_clean(p_last_medium, 40) is not null or public.origin_clean(p_last_source, 80) is not null;
begin
  if auth.uid() is null or not exists (select 1 from public.events where id = p_event and host_id = auth.uid() and deleted_at is null) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  update public.events
     set origin_source = public.origin_clean(p_source, 80),
         origin_medium = coalesce(public.origin_clean(p_medium, 40), 'direto'),
         origin_campaign = public.origin_clean(p_campaign, 60),
         last_source = case when has_last then public.origin_clean(p_last_source, 80) else public.origin_clean(p_source, 80) end,
         last_medium = coalesce(case when has_last then public.origin_clean(p_last_medium, 40) else public.origin_clean(p_medium, 40) end, 'direto'),
         last_campaign = case when has_last then public.origin_clean(p_last_campaign, 60) else public.origin_clean(p_campaign, 60) end
   where id = p_event and origin_medium is null; -- só a primeira vez
  update public.payment_orders o
     set origin_source = e.origin_source, origin_medium = e.origin_medium, origin_campaign = e.origin_campaign,
         last_source = e.last_source, last_medium = e.last_medium, last_campaign = e.last_campaign
    from public.events e
   where e.id = p_event and o.event_id = p_event and o.origin_medium is null;
end $$;
revoke all on function public.set_event_origin(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.set_event_origin(uuid, text, text, text, text, text, text) to authenticated;

-- pedido herda a origem do evento
create function public.payment_orders_origin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_id is not null and new.origin_medium is null then
    select e.origin_source, e.origin_medium, e.origin_campaign, e.last_source, e.last_medium, e.last_campaign
      into new.origin_source, new.origin_medium, new.origin_campaign, new.last_source, new.last_medium, new.last_campaign
      from public.events e where e.id = new.event_id;
  end if;
  return new;
end $$;
revoke all on function public.payment_orders_origin() from public, anon, authenticated;
create trigger payment_orders_origin before insert on public.payment_orders for each row execute function public.payment_orders_origin();

-- ---------------------------------------------------------------- Master: conversão por origem
create function public.admin_conversion_by_origin(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 1), 365);
  since timestamptz := now() - make_interval(days => d);
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return (
    with ev as (
      select e.id,
             coalesce(e.origin_source, case when e.origin_medium is null then 'Sem registro' else 'Direto' end) as source,
             coalesce(e.origin_medium, '—') as medium, coalesce(e.origin_campaign, '') as campaign,
             coalesce(e.last_source, case when e.last_medium is null then 'Sem registro' else 'Direto' end) as l_source,
             coalesce(e.last_medium, '—') as l_medium, coalesce(e.last_campaign, '') as l_campaign,
             exists (select 1 from public.participants p where p.event_id = e.id and p.user_id <> e.host_id) as activated
      from public.events e
      where e.created_at >= since and e.deleted_at is null and not e.is_test and public.metrics_counts_host(e.host_id)
    ), paid as (
      select o.event_id, sum(o.amount_cents)::bigint as cents
      from public.payment_orders o
      where o.status = 'pago' and o.provider_env = 'production' and o.event_id in (select id from ev)
      group by o.event_id
    ), j as (select ev.*, paid.event_id as paid_event, paid.cents from ev left join paid on paid.event_id = ev.id)
    select jsonb_build_object(
      'days', d,
      'generatedAt', now(),
      'rows', (select coalesce(jsonb_agg(r order by (r ->> 'events')::int desc, r ->> 'source'), '[]'::jsonb) from (
                 select jsonb_build_object('source', source, 'medium', medium, 'campaign', nullif(campaign, ''),
                          'events', count(*), 'activated', count(*) filter (where activated),
                          'paid', count(paid_event), 'revenueCents', coalesce(sum(cents), 0)) r
                 from j group by source, medium, campaign) a),
      'rowsLast', (select coalesce(jsonb_agg(r order by (r ->> 'events')::int desc, r ->> 'source'), '[]'::jsonb) from (
                 select jsonb_build_object('source', l_source, 'medium', l_medium, 'campaign', nullif(l_campaign, ''),
                          'events', count(*), 'activated', count(*) filter (where activated),
                          'paid', count(paid_event), 'revenueCents', coalesce(sum(cents), 0)) r
                 from j group by l_source, l_medium, l_campaign) b))
  );
end $$;
revoke all on function public.admin_conversion_by_origin(int) from public, anon;
grant execute on function public.admin_conversion_by_origin(int) to authenticated;
