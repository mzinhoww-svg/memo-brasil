-- Endurecimento V2 (achados da revisão independente A4). Aditiva.
-- NÃO VALIDADA EM BANCO NESTA SESSÃO (Docker indisponível): rodar `supabase db reset --local && supabase test db` antes de qualquer uso.

-- (2) Fila de purga conhece o bucket: logo/capa de eventos apagados também saem do Storage.
alter table public.storage_purge_queue add column if not exists bucket text not null default 'event-photos';

create or replace function public.purge_deleted_events() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.storage_purge_queue (path)
    select ph.storage_path from public.photos ph join public.events e on e.id = ph.event_id where e.deleted_at < now() - interval '30 days'
    union all
    select ph.storage_path || '.thumb' from public.photos ph join public.events e on e.id = ph.event_id where e.deleted_at < now() - interval '30 days'
  on conflict do nothing;
  insert into public.storage_purge_queue (path, bucket)
    select a.storage_path, 'event-branding' from public.event_assets a join public.events e on e.id = a.event_id where e.deleted_at < now() - interval '30 days'
  on conflict do nothing;
  with gone as (delete from public.events where deleted_at < now() - interval '30 days' returning id) select count(*) into n from gone;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;

-- Uploads de logo/capa abandonados em 'enviando' há mais de 1 h: enfileira o objeto e apaga a linha (chamar de um job; ainda não agendado).
create function public.expire_pending_assets() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.storage_purge_queue (path, bucket)
    select storage_path, 'event-branding' from public.event_assets where upload_status = 'enviando' and created_at < now() - interval '1 hour'
  on conflict do nothing;
  with gone as (delete from public.event_assets where upload_status = 'enviando' and created_at < now() - interval '1 hour' returning id) select count(*) into n from gone;
  return n;
end $$;
revoke execute on function public.expire_pending_assets() from public, anon, authenticated;

-- (7) event_preview com limite de tentativas por pessoa (não é mais STABLE: grava o contador).
create or replace function public.event_preview(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare e public.events; n int; t public.event_themes; th jsonb;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform public.check_rate_limit('preview:' || auth.uid(), 120, interval '1 hour');
  select * into e from public.events where code = upper(btrim(p_code)) and deleted_at is null;
  if not found then return null; end if;
  select count(*) into n from public.participants where event_id = e.id;
  select * into t from public.event_themes where event_id = e.id;
  if found then
    th := jsonb_build_object('preset', t.preset, 'colors', t.colors, 'font', t.font, 'welcomeMessage', t.welcome_message,
                             'qrStyle', t.qr_style, 'decor', t.decor);
  end if;
  return jsonb_build_object(
    'code', e.code, 'title', e.title, 'category', e.category, 'hostName', e.host_name, 'startAt', e.start_at, 'place', e.place,
    'palette', e.palette, 'eventFont', e.event_font, 'capacity', e.capacity,
    'status', case when now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then 'encerrado' else 'ativo' end,
    'full', e.capacity is not null and n >= e.capacity,
    'theme', th);
end $$;
revoke execute on function public.event_preview(text) from public, anon;
grant execute on function public.event_preview(text) to authenticated;
