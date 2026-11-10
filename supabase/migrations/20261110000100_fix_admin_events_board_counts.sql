-- Revela 2.0 · correção: `counts` (coluna do CTE) colidia com a variável plpgsql de mesmo nome em admin_events_board (erro 'column reference counts is ambiguous').
-- ADITIVA: só redefine a função criada em 20261109000600.
create or replace function public.admin_events_board(p_filter text default null, p_search text default null, p_limit int default 25, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_search), '') is null then null
                         else '%' || replace(replace(replace(left(btrim(p_search), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
        total bigint; counts jsonb; items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_filter is not null and p_filter not in ('rolando', 'aguardando', 'revelados', 'denuncias', 'excluidos') then raise exception 'invalid' using errcode = 'MM005'; end if;

  with b as (
    select e.id, e.title, coalesce(nullif(e.host_name, ''), pr.display_name, '') as host, e.category, e.capacity, e.created_at, e.deleted_at,
           e.reveal_enabled, e.reveal_at, e.revealed_at,
           (now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)) as live,
           (select ee.plan_code from public.effective_entitlement(e.id) ee) as plan_code,
           (select count(*) from public.participants p where p.event_id = e.id) as participants,
           (select count(*) from public.photos ph where ph.event_id = e.id and ph.upload_status = 'pronta' and ph.deleted_at is null) as photos,
           (select count(*) from public.photos ph where ph.event_id = e.id and ph.deleted_at is null and ph.status = 'visivel' and ph.reports > 0)
             + (select count(*) from public.photo_comments c where c.event_id = e.id and c.deleted_at is null and c.hidden_at is null and c.reports > 0) as reports
      from public.events e left join public.profiles pr on pr.id = e.host_id
     where not e.is_test and (pat is null or e.title ilike pat or e.host_name ilike pat or pr.display_name ilike pat)
  ), c as (
    select jsonb_build_object(
      'todos', count(*) filter (where deleted_at is null),
      'rolando', count(*) filter (where deleted_at is null and live),
      'aguardando', count(*) filter (where deleted_at is null and reveal_enabled and revealed_at is null),
      'revelados', count(*) filter (where deleted_at is null and revealed_at is not null),
      'denuncias', count(*) filter (where deleted_at is null and reports > 0),
      'excluidos', count(*) filter (where deleted_at is not null)) as cnt from b
  ), f as (
    select b.* from b
     where case p_filter
             when 'rolando' then deleted_at is null and live
             when 'aguardando' then deleted_at is null and reveal_enabled and revealed_at is null
             when 'revelados' then deleted_at is null and revealed_at is not null
             when 'denuncias' then deleted_at is null and reports > 0
             when 'excluidos' then deleted_at is not null
             else deleted_at is null end
  ), page as (select f.*, row_number() over (order by f.created_at desc, f.id) as rn from f)
  select (select count(*) from f), (select cnt from c),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'title', p.title, 'hostName', p.host, 'category', p.category, 'planCode', p.plan_code,
           'planName', (select pl.name from public.plans pl where pl.code = p.plan_code),
           'participants', p.participants, 'capacity', p.capacity, 'photos', p.photos, 'reports', p.reports,
           'revealEnabled', p.reveal_enabled, 'revealAt', p.reveal_at, 'revealedAt', p.revealed_at, 'live', p.live, 'deletedAt', p.deleted_at) order by p.rn), '[]'::jsonb)
    into total, counts, items
    from page p where p.rn > off and p.rn <= off + lim;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'counts', counts, 'items', items);
end $$;

