-- Atribuição: de onde veio quem criou o evento (primeiro toque do navegador, sem dado pessoal), gravado no evento e copiado para
-- o pedido; relatório "Conversão por origem" no Master. ADITIVA.
-- Métricas de conversão nunca contam equipe, contas/eventos de teste nem as contas listadas em platform_settings.metrics_excluded_hosts
-- (contas do próprio dono usadas para testar).

alter table public.events
  add column origin_source text check (origin_source is null or char_length(origin_source) <= 80),
  add column origin_medium text check (origin_medium is null or char_length(origin_medium) <= 40),
  add column origin_campaign text check (origin_campaign is null or char_length(origin_campaign) <= 60);
alter table public.payment_orders
  add column origin_source text check (origin_source is null or char_length(origin_source) <= 80),
  add column origin_medium text check (origin_medium is null or char_length(origin_medium) <= 40),
  add column origin_campaign text check (origin_campaign is null or char_length(origin_campaign) <= 60);

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
create function public.set_event_origin(p_event uuid, p_source text, p_medium text, p_campaign text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  clean_src text := nullif(left(btrim(regexp_replace(coalesce(p_source, ''), '[[:cntrl:]<>]', '', 'g')), 80), '');
  clean_med text := nullif(left(btrim(regexp_replace(coalesce(p_medium, ''), '[[:cntrl:]<>]', '', 'g')), 40), '');
  clean_cmp text := nullif(left(btrim(regexp_replace(coalesce(p_campaign, ''), '[[:cntrl:]<>]', '', 'g')), 60), '');
begin
  if auth.uid() is null or not exists (select 1 from public.events where id = p_event and host_id = auth.uid() and deleted_at is null) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  update public.events
     set origin_source = clean_src, origin_medium = coalesce(clean_med, 'direto'), origin_campaign = clean_cmp
   where id = p_event and origin_medium is null; -- só a primeira vez
  update public.payment_orders o
     set origin_source = e.origin_source, origin_medium = e.origin_medium, origin_campaign = e.origin_campaign
    from public.events e
   where e.id = p_event and o.event_id = p_event and o.origin_medium is null;
end $$;
revoke all on function public.set_event_origin(uuid, text, text, text) from public, anon;
grant execute on function public.set_event_origin(uuid, text, text, text) to authenticated;

-- pedido herda a origem do evento
create function public.payment_orders_origin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_id is not null and new.origin_medium is null then
    select e.origin_source, e.origin_medium, e.origin_campaign into new.origin_source, new.origin_medium, new.origin_campaign
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
      select e.id, e.host_id,
             coalesce(e.origin_source, case when e.origin_medium is null then 'Sem registro' else 'Direto' end) as source,
             coalesce(e.origin_medium, '—') as medium,
             coalesce(e.origin_campaign, '') as campaign,
             exists (select 1 from public.participants p where p.event_id = e.id and p.user_id <> e.host_id) as activated
      from public.events e
      where e.created_at >= since and e.deleted_at is null and not e.is_test and public.metrics_counts_host(e.host_id)
    ), paid as (
      select o.event_id, sum(o.amount_cents)::bigint as cents
      from public.payment_orders o
      where o.status = 'pago' and o.provider_env = 'production' and o.event_id in (select id from ev)
      group by o.event_id
    )
    select jsonb_build_object(
      'days', d,
      'generatedAt', now(),
      'rows', coalesce(jsonb_agg(r order by (r ->> 'events')::int desc, r ->> 'source'), '[]'::jsonb))
    from (
      select jsonb_build_object('source', ev.source, 'medium', ev.medium, 'campaign', nullif(ev.campaign, ''),
               'events', count(*), 'activated', count(*) filter (where ev.activated),
               'paid', count(paid.event_id), 'revenueCents', coalesce(sum(paid.cents), 0)) as r
      from ev left join paid on paid.event_id = ev.id
      group by ev.source, ev.medium, ev.campaign
    ) t
  );
end $$;
revoke all on function public.admin_conversion_by_origin(int) from public, anon;
grant execute on function public.admin_conversion_by_origin(int) to authenticated;
