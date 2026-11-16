-- Revela 2.0 · Master M02 (Eventos), M08 (Revelações) e M09 (Moderação). ADITIVA: três leituras novas, sem alterar RPC, tabela ou política existentes.
--
-- admin_events_board: a lista de Eventos do desenho (categoria, plano, convidados, revelação, situação e denúncias) com os seis filtros
--   (Todos, Rolando, Aguardando revelação, Revelados, Com denúncias, Excluídos) e a contagem de cada um. Só metadados e contagens;
--   nada de fotos nem de conteúdo de convidados. Eventos de teste ficam de fora, como em "Todos" do console.
-- admin_reveals_board: fila de revelações (pendentes primeiro, depois as últimas 7 dias) com contagem do aviso por e-mail
--   (inscritos com consentimento, enviados, falhas, na fila). Só números; nenhum endereço.
-- admin_moderation_queue: fila de denúncias de todos os eventos. Fotos: só identificação, evento e número de denúncias (o console não exibe
--   fotografias privadas; o acesso excepcional continua em admin_request_photo_access). Comentários e participantes bloqueados: o texto e
--   o nome só voltam para o master, que já os vê em list_comments_for_moderation / admin_search_participants.

create function public.admin_events_board(p_filter text default null, p_search text default null, p_limit int default 25, p_offset int default 0) returns jsonb
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
      'excluidos', count(*) filter (where deleted_at is not null)) as counts from b
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
  select (select count(*) from f), (select counts from c),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'title', p.title, 'hostName', p.host, 'category', p.category, 'planCode', p.plan_code,
           'planName', (select pl.name from public.plans pl where pl.code = p.plan_code),
           'participants', p.participants, 'capacity', p.capacity, 'photos', p.photos, 'reports', p.reports,
           'revealEnabled', p.reveal_enabled, 'revealAt', p.reveal_at, 'revealedAt', p.revealed_at, 'live', p.live, 'deletedAt', p.deleted_at) order by p.rn), '[]'::jsonb)
    into total, counts, items
    from page p where p.rn > off and p.rn <= off + lim;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'counts', counts, 'items', items);
end $$;

create function public.admin_moderation_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare master boolean := public.is_master(); photos jsonb; comments jsonb; blocked jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('photoId', x.id, 'eventId', x.event_id, 'eventTitle', x.title, 'reports', x.reports, 'hidden', x.status = 'oculta')
                            order by x.reports desc, x.created_at desc), '[]'::jsonb) into photos
    from (select ph.id, ph.event_id, e.title, ph.reports, ph.status, ph.created_at
            from public.photos ph join public.events e on e.id = ph.event_id
           where ph.deleted_at is null and ph.status <> 'removida' and ph.reports > 0 and e.deleted_at is null
           order by ph.reports desc, ph.created_at desc limit 100) x;

  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'eventId', x.event_id, 'eventTitle', x.title, 'authorName', case when master then x.author_name end,
                                               'body', case when master then x.body end, 'reports', x.reports, 'hidden', x.hidden_at is not null,
                                               'hiddenBy', x.hidden_by, 'createdAt', x.created_at) order by x.reports desc, x.created_at desc), '[]'::jsonb) into comments
    from (select c.id, c.event_id, e.title, c.author_name, c.body, c.reports, c.hidden_at, c.hidden_by, c.created_at
            from public.photo_comments c join public.events e on e.id = c.event_id
           where c.deleted_at is null and e.deleted_at is null and (c.reports > 0 or c.hidden_at is not null)
           order by c.reports desc, c.created_at desc limit 100) x;

  select coalesce(jsonb_agg(jsonb_build_object('eventId', x.event_id, 'eventTitle', x.title, 'name', case when master then x.name end, 'blockedAt', x.blocked_at)
                            order by x.blocked_at desc), '[]'::jsonb) into blocked
    from (select p.event_id, e.title, p.name, p.blocked_at
            from public.participants p join public.events e on e.id = p.event_id
           where p.blocked_at is not null and e.deleted_at is null order by p.blocked_at desc limit 100) x;

  return jsonb_build_object('photos', photos, 'comments', comments, 'blocked', blocked);
end $$;

create function public.admin_reveals_board(p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'title', x.title, 'revealAt', x.reveal_at, 'revealedAt', x.revealed_at, 'photos', x.photos,
           'emailOptIns', x.opt_ins, 'emailsSent', x.sent, 'emailsFailed', x.failed, 'emailsQueued', x.queued) order by x.pending desc, x.sort_at, x.id), '[]'::jsonb)
    into items
    from (select e.id, e.title, e.reveal_at, e.revealed_at, (e.revealed_at is null) as pending, coalesce(e.revealed_at, e.reveal_at) as sort_at,
                 (select count(*) from public.photos ph where ph.event_id = e.id and ph.upload_status = 'pronta' and ph.deleted_at is null) as photos,
                 (select count(*) from public.participant_emails pe where pe.event_id = e.id and pe.email is not null and pe.consent_at is not null and pe.opt_out_at is null) as opt_ins,
                 (select count(*) from public.reveal_email_queue q where q.event_id = e.id and q.sent_at is not null) as sent,
                 (select count(*) from public.reveal_email_queue q where q.event_id = e.id and q.sent_at is null and q.last_error is not null) as failed,
                 (select count(*) from public.reveal_email_queue q where q.event_id = e.id and q.sent_at is null and q.last_error is null) as queued
            from public.events e
           where e.deleted_at is null and not e.is_test and e.reveal_enabled
             and (e.revealed_at is null or e.revealed_at >= now() - interval '7 days')
           order by (e.revealed_at is null) desc, coalesce(e.revealed_at, e.reveal_at), e.id limit lim) x;
  return jsonb_build_object('items', items);
end $$;

revoke all on function public.admin_events_board(text, text, int, int), public.admin_moderation_queue(), public.admin_reveals_board(int) from public, anon;
grant execute on function public.admin_events_board(text, text, int, int), public.admin_moderation_queue(), public.admin_reveals_board(int) to authenticated;
