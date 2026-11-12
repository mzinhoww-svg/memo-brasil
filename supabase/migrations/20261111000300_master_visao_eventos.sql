-- Revela 2.0 · Console Master · Visão geral, Eventos e Pagamentos (M20 a M23). ADITIVA.
-- • admin_dashboard_metrics ganha p_include_tests (padrão false) e passa a EXCLUIR eventos de teste, o mesmo critério de admin_overview
--   (antes contava tudo, e as duas telas divergiam). Chamadas antigas (3 argumentos) continuam valendo.
-- • admin_events_board: counts.teste (chip "De teste N").
-- • admin_test_events (M22), test_batch_blockers (motivo por evento), admin_set_test_flag e admin_soft_delete_test_events com detalhe da recusa.
-- • admin_event_detail (M21): plano, avisos por e-mail só em números, denúncias por motivo, pedidos de impressão (master + chave printed_album), auditoria com nome.
-- Erros: MM004 forbidden · MM005 invalid | nottest | paid | missing (detail = JSON por evento) · MM011 reasonrequired

-- ---------------------------------------------------------------- admin_dashboard_metrics (critério de teste unificado)
drop function public.admin_dashboard_metrics(timestamptz, timestamptz, text);
create function public.admin_dashboard_metrics(p_from timestamptz default now() - interval '30 days', p_to timestamptz default now(),
                                               p_tz text default 'America/Cuiaba', p_include_tests boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; st jsonb; series jsonb; inc boolean := coalesce(p_include_tests, false);
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '366 days' then raise exception 'invalid' using errcode = 'MM005'; end if;

  select jsonb_build_object(
    'photosBytes', coalesce(sum((metadata ->> 'size')::bigint) filter (where bucket_id = 'event-photos'), 0),
    'photosObjects', count(*) filter (where bucket_id = 'event-photos'),
    'brandingBytes', coalesce(sum((metadata ->> 'size')::bigint) filter (where bucket_id = 'event-branding'), 0),
    'brandingObjects', count(*) filter (where bucket_id = 'event-branding'))
  into st from storage.objects where bucket_id in ('event-photos', 'event-branding');

  select coalesce(jsonb_agg(jsonb_build_object(
      'day', d::date, 'eventsCreated', coalesce(ec.n, 0), 'participantsJoined', coalesce(pj.n, 0),
      'photosUploaded', coalesce(pu.n, 0), 'uploadsFailed', coalesce(uf.n, 0)) order by d), '[]')
  into series
  from generate_series((p_from at time zone p_tz)::date, (p_to at time zone p_tz)::date, interval '1 day') d
  left join (select (created_at at time zone p_tz)::date as day, count(*) n from public.events
             where (inc or not is_test) and created_at >= p_from and created_at < p_to group by 1) ec on ec.day = d::date
  left join (select (x.joined_at at time zone p_tz)::date as day, count(*) n from public.participants x join public.events ev on ev.id = x.event_id
             where (inc or not ev.is_test) and x.joined_at >= p_from and x.joined_at < p_to group by 1) pj on pj.day = d::date
  left join (select (x.created_at at time zone p_tz)::date as day, count(*) n from public.photos x join public.events ev on ev.id = x.event_id
             where (inc or not ev.is_test) and x.upload_status = 'pronta' and x.created_at >= p_from and x.created_at < p_to group by 1) pu on pu.day = d::date
  left join (select (x.created_at at time zone p_tz)::date as day, count(*) n from public.photos x join public.events ev on ev.id = x.event_id
             where (inc or not ev.is_test) and (x.upload_status = 'falhou' or (x.upload_status = 'enviando' and x.created_at < now() - interval '1 hour'))
               and x.created_at >= p_from and x.created_at < p_to group by 1) uf on uf.day = d::date;

  r := jsonb_build_object(
    'from', p_from, 'to', p_to, 'tz', p_tz, 'generatedAt', now(),
    'events', jsonb_build_object(
      'created', (select count(*) from public.events where (inc or not is_test) and created_at >= p_from and created_at < p_to),
      'active', (select count(*) from public.events e where e.deleted_at is null and (inc or not e.is_test) and now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)),
      'ended', (select count(*) from public.events e where e.deleted_at is null and (inc or not e.is_test) and now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at)),
      'total', (select count(*) from public.events where (inc or not is_test) and deleted_at is null)),
    'organizers', jsonb_build_object(
      -- ativo no período = tem evento não apagado que começou antes do fim do período e terminou depois do início
      'active', (select count(distinct e.host_id) from public.events e
                 where e.deleted_at is null and (inc or not e.is_test) and e.start_at < p_to and public.event_end(e.start_at, e.duration_hours, e.ended_at) >= p_from),
      'total', (select count(distinct host_id) from public.events where (inc or not is_test) and deleted_at is null)),
    'participants', jsonb_build_object(
      'joined', (select count(*) from public.participants x join public.events ev on ev.id = x.event_id where (inc or not ev.is_test) and x.joined_at >= p_from and x.joined_at < p_to),
      'total', (select count(*) from public.participants x join public.events ev on ev.id = x.event_id where (inc or not ev.is_test))),
    'photos', jsonb_build_object(
      'uploaded', (select count(*) from public.photos x join public.events ev on ev.id = x.event_id where (inc or not ev.is_test) and x.upload_status = 'pronta' and x.created_at >= p_from and x.created_at < p_to),
      'total', (select count(*) from public.photos x join public.events ev on ev.id = x.event_id where (inc or not ev.is_test) and x.upload_status = 'pronta' and x.deleted_at is null)),
    'uploads', jsonb_build_object(
      'failed', (select count(*) from public.photos x join public.events ev on ev.id = x.event_id
                 where (inc or not ev.is_test) and (x.upload_status = 'falhou' or (x.upload_status = 'enviando' and x.created_at < now() - interval '1 hour'))
                   and x.created_at >= p_from and x.created_at < p_to),
      'inProgress', (select count(*) from public.photos x join public.events ev on ev.id = x.event_id where (inc or not ev.is_test) and x.upload_status = 'enviando' and x.created_at >= now() - interval '1 hour')),
    'reveals', jsonb_build_object(
      'pending', (select count(*) from public.events where (inc or not is_test) and reveal_enabled and revealed_at is null and deleted_at is null),
      'overdue', (select count(*) from public.events where (inc or not is_test) and reveal_enabled and revealed_at is null and deleted_at is null and reveal_at < now())),
    'storage', st,
    'series', series);
  return r;
end $$;

-- ---------------------------------------------------------------- admin_events_board (counts.teste)
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
      'excluidos', count(*) filter (where deleted_at is not null),
      'teste', (select count(*) from public.events t where t.is_test and t.deleted_at is null)) as cnt from b
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
-- ---------------------------------------------------------------- eventos de teste: quem impede o lote, por evento
-- Auxiliar interna (sem EXECUTE para clientes). p_mode: 'mark' (marcar como teste) | 'delete' (excluir). Devolve, por evento recusado,
-- {id, title, code, reason}. Regra única do servidor para a folha de recusa (M21.f1r e M22.f2):
--   missing  evento inexistente · nottest  não é evento de teste (só excluir) ·
--   paid     tem pedido pago ou em disputa, ou direito pago/cortesia/código ativo (evento pago não vira teste e não é excluído em lote).
create function public.test_batch_blockers(p_events uuid[], p_mode text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(r.j order by r.ord), '[]'::jsonb) from (
    select x.ord, jsonb_build_object('id', x.id, 'title', e.title, 'code', c.code, 'reason', c.reason) as j
      from (select id, min(ord) as ord from unnest(p_events) with ordinality as u(id, ord) group by id) x
      left join public.events e on e.id = x.id
      cross join lateral (
        select case
                 when e.id is null then 'missing'
                 when p_mode = 'delete' and not e.is_test then 'nottest'
                 when exists (select 1 from public.payment_orders o where o.event_id = e.id and o.status in ('pago', 'em_disputa'))
                   or exists (select 1 from public.event_entitlements ee where ee.event_id = e.id and ee.status = 'ativo' and ee.source in ('pago', 'cortesia', 'codigo')) then 'paid'
               end as code,
               case
                 when e.id is null then 'Evento não encontrado'
                 when p_mode = 'delete' and not e.is_test then 'Não é evento de teste'
                 when exists (select 1 from public.payment_orders o where o.event_id = e.id and o.status in ('pago', 'em_disputa') and o.provider_env = 'production') then 'Tem pagamento confirmado em produção'
                 when exists (select 1 from public.payment_orders o where o.event_id = e.id and o.status in ('pago', 'em_disputa')) then 'Tem pagamento confirmado no ambiente de testes'
                 when exists (select 1 from public.event_entitlements ee where ee.event_id = e.id and ee.status = 'ativo' and ee.source in ('pago', 'cortesia', 'codigo')) then 'Tem plano pago, cortesia ou código ativo'
               end as reason
      ) c
     where c.code is not null
  ) r
$$;
revoke all on function public.test_batch_blockers(uuid[], text) from public, anon, authenticated;

-- marca (admin.set_test_flag) ou desmarca (admin.unset_test_flag); um registro de auditoria por evento alterado. Só master.
-- Evento pago não vira teste: lote com evento pago ou inexistente é recusado INTEIRO (MM005, message = primeiro código, detail = JSON por evento).
create or replace function public.admin_set_test_flag(p_events uuid[], p_value boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare why text; r record; n int := 0; bad jsonb;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  if p_value is null or p_events is null or cardinality(p_events) = 0 or cardinality(p_events) > 500 or exists (select 1 from unnest(p_events) x(id) where x.id is null) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  perform 1 from public.events e where e.id = any (p_events) order by e.id for update;
  if p_value then
    bad := public.test_batch_blockers(p_events, 'mark');
    if jsonb_array_length(bad) > 0 then
      raise exception '%', coalesce(bad -> 0 ->> 'code', 'invalid') using errcode = 'MM005', detail = bad::text;
    end if;
  elsif exists (select 1 from unnest(p_events) x(id) where not exists (select 1 from public.events e where e.id = x.id)) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  for r in select e.id from public.events e where e.id = any (p_events) and e.is_test is distinct from p_value order by e.id loop
    update public.events set is_test = p_value where id = r.id;
    perform public.admin_log(case when p_value then 'admin.set_test_flag' else 'admin.unset_test_flag' end, 'event', r.id::text, why, r.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'updated', n);
end $$;

-- Exclusão em lote só de eventos is_test e só lógica (deleted_at). Lote com evento real, pago ou inexistente é recusado inteiro:
-- message = primeiro código (nottest | paid | missing), detail = JSON [{id,title,code,reason}] com o motivo de cada evento.
create or replace function public.admin_soft_delete_test_events(p_events uuid[], p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare why text; r record; n int := 0; bad jsonb;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  if p_events is null or cardinality(p_events) = 0 or cardinality(p_events) > 500 or exists (select 1 from unnest(p_events) x(id) where x.id is null) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  perform 1 from public.events e where e.id = any (p_events) order by e.id for update;
  bad := public.test_batch_blockers(p_events, 'delete');
  if jsonb_array_length(bad) > 0 then
    raise exception '%', coalesce(bad -> 0 ->> 'code', 'invalid') using errcode = 'MM005', detail = bad::text;
  end if;
  for r in select e.id from public.events e where e.id = any (p_events) and e.deleted_at is null order by e.id loop
    update public.events set deleted_at = now() where id = r.id and is_test;
    perform public.admin_log('admin.soft_delete_test_events', 'event', r.id::text, why, r.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'deleted', n);
end $$;

-- ---------------------------------------------------------------- M22: lista de eventos de teste
-- Leitura de staff. E-mail do organizador completo só para o master (os outros papéis veem a***@dominio, mascarado AQUI no servidor).
-- payment = ambiente do pedido mais recente do evento ('sandbox' | 'production') ou null; blocked = o servidor recusaria excluir.
create function public.admin_test_events(p_limit int default 25, p_offset int default 0, p_search text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_search), '') is null then null
                         else '%' || replace(replace(replace(left(btrim(p_search), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
        master boolean := public.is_master(); total bigint; items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with f as (
    select e.id, e.title, e.created_at, u.email,
           coalesce(nullif(e.host_name, ''), pr.display_name, '') as host,
           (select pl.name from public.plans pl where pl.code = (select ee.plan_code from public.effective_entitlement(e.id) ee)) as plan_name,
           (select o.provider_env from public.payment_orders o where o.event_id = e.id order by o.created_at desc, o.id limit 1) as pay_env,
           (select count(*) from public.photos ph where ph.event_id = e.id and ph.upload_status = 'pronta' and ph.deleted_at is null) as photos,
           public.test_batch_blockers(array[e.id], 'delete') as bad
      from public.events e left join public.profiles pr on pr.id = e.host_id left join auth.users u on u.id = e.host_id
     where e.is_test and e.deleted_at is null
       and (pat is null or e.title ilike pat or e.host_name ilike pat or pr.display_name ilike pat or (master and u.email ilike pat))
  ), page as (select f.*, row_number() over (order by f.created_at desc, f.id) as rn from f)
  select (select count(*) from f),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'title', p.title, 'hostName', p.host,
           'hostEmail', case when p.email is null then null when master then p.email else regexp_replace(p.email, '^(.).*(@.*)$', '\1***\2') end,
           'planName', coalesce(p.plan_name, 'Grátis'), 'payment', p.pay_env, 'photos', p.photos, 'createdAt', p.created_at,
           'blocked', jsonb_array_length(p.bad) > 0, 'blockedReason', p.bad -> 0 ->> 'reason') order by p.rn), '[]'::jsonb)
    into total, items from page p where p.rn > off and p.rn <= off + lim;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off,
    'allEvents', (select count(*) from public.events e where e.deleted_at is null), 'items', items);
end $$;

-- ---------------------------------------------------------------- admin_event_detail (M21)
create or replace function public.admin_event_detail(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events; host_display text; ev_end timestamptz; master boolean := public.is_master();
        ent jsonb; timeline jsonb; parts jsonb; orders jsonb := '[]'; aud jsonb;
        plan jsonb; notices jsonb; reasons jsonb; prints jsonb := '[]'; subs int; sent int; failed int; paid public.payment_orders;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into e from public.events where id = p_event;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select coalesce(nullif(e.host_name, ''), pr.display_name, '') into host_display from public.profiles pr where pr.id = e.host_id;
  ev_end := public.event_end(e.start_at, e.duration_hours, e.ended_at);

  select jsonb_build_object('planCode', x.plan_code, 'maxGuests', x.max_guests, 'maxShots', x.max_shots, 'source', x.source)
    into ent from public.effective_entitlement(e.id) x;

  -- plano: nome do catálogo e, só para o master, o pedido pago (valor e método), como a lista de Pagamentos
  if master then
    select * into paid from public.payment_orders o where o.event_id = e.id and o.status = 'pago' order by o.paid_at desc nulls last, o.id limit 1;
  end if;
  select jsonb_build_object('code', ent ->> 'planCode', 'name', (select pl.name from public.plans pl where pl.code = ent ->> 'planCode'), 'source', ent ->> 'source',
                            'paidCents', case when master and paid.id is not null then paid.amount_cents end,
                            'paidMethod', case when master and paid.id is not null then paid.payment_method end,
                            'orderCode', case when master and paid.id is not null then upper(left(paid.id::text, 8)) end)
    into plan;

  -- avisos de revelação por e-mail: SÓ números (nunca endereço nem token). Antes da revelação, inscritos = quem consentiu e não saiu;
  -- depois, as linhas da fila de envio.
  if e.revealed_at is null then
    select count(*) into subs from public.participant_emails pe join public.participants p on p.event_id = pe.event_id and p.user_id = pe.user_id
     where pe.event_id = e.id and pe.email is not null and pe.consent_at is not null and pe.opt_out_at is null and p.blocked_at is null;
    sent := 0; failed := 0;
  else
    select count(*), count(*) filter (where q.sent_at is not null), count(*) filter (where q.sent_at is null and q.last_error is not null)
      into subs, sent, failed from public.reveal_email_queue q where q.event_id = e.id;
  end if;
  notices := jsonb_build_object('subscribers', subs, 'sent', sent, 'failed', failed, 'queued', greatest(subs - sent - failed, 0));

  -- denúncias por motivo (fotos e comentários), agregadas: quem denunciou nunca aparece
  select jsonb_build_object(
      'naoQueroAparecer', count(*) filter (where r.reason = 'nao_quero_aparecer'),
      'constrangedora', count(*) filter (where r.reason = 'constrangedora'),
      'improprio', count(*) filter (where r.reason in ('improprio', 'ofensivo')),
      'outro', count(*) filter (where r.reason is null or r.reason in ('outro', 'spam')))
    into reasons
    from (select pr.reason from public.photo_reports pr join public.photos ph on ph.id = pr.photo_id where ph.event_id = e.id
          union all select cr.reason from public.comment_reports cr join public.photo_comments c on c.id = cr.comment_id where c.event_id = e.id) r;

  -- pedidos de impressão: só master e só com a chave printed_album ligada
  if master and public.printed_album_enabled() then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'code', 'IMP-' || upper(left(replace(x.id::text, '-', ''), 4)), 'product', x.product,
                                                 'quantity', x.quantity, 'status', x.status) order by x.created_at desc, x.id), '[]')
      into prints from (select * from public.print_orders po where po.event_id = e.id order by po.created_at desc, po.id limit 20) x;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('at', t.at, 'kind', t.kind, 'label', t.label) order by t.at, t.ord), '[]') into timeline
  from (
    select e.created_at as at, 'created' as kind, 'Evento criado' as label, 1 as ord
    union all select e.start_at, 'started', case when e.start_at > now() then 'Início previsto' else 'Início' end, 2
    union all select (select min(p.joined_at) from public.participants p where p.event_id = e.id and p.user_id <> e.host_id),
                     'first_join', 'Primeira entrada de convidado', 3
    union all select (select min(x.created_at) from public.photos x where x.event_id = e.id and x.upload_status = 'pronta'),
                     'first_photo', 'Primeira foto enviada', 4
    union all select ev_end, 'ended', case when ev_end > now() then 'Encerramento previsto' else 'Encerramento' end, 5
    union all select case when e.revealed_at is not null then e.revealed_at when e.reveal_enabled then e.reveal_at end,
                     case when e.revealed_at is not null then 'revealed' else 'reveal_scheduled' end,
                     case when e.revealed_at is not null then 'Revelação liberada' else 'Revelação agendada' end, 6
    union all select e.deleted_at, 'deleted', 'Evento excluído', 7
  ) t where t.at is not null;

  select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'joinedAt', x.joined_at, 'isHost', x.user_id = e.host_id) order by x.joined_at, x.user_id), '[]')
    into parts
    from (select * from public.participants p where p.event_id = e.id order by p.joined_at, p.user_id limit 200) x;

  if master then -- pedidos de pagamento: mesma regra de admin_list_payments (só master)
    select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'status', o.status, 'amountCents', o.amount_cents, 'createdAt', o.created_at)
                              order by o.created_at desc, o.id), '[]')
      into orders
      from (select * from public.payment_orders o where o.event_id = e.id order by o.created_at desc, o.id limit 50) o;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'action', a.action,
                                               'actorRole', coalesce(a.actor_role, public.audit_actor_role_for(a.actor_id, a.event_id)),
                                               'reason', a.reason, 'actorName', (select nullif(pr.display_name, '') from public.profiles pr where pr.id = a.actor_id),
                                               'targetType', a.target_type, 'targetId', a.target_id) order by a.at desc, a.id desc), '[]')
    into aud
    from (select * from public.audit_logs l where l.event_id = e.id order by l.at desc, l.id desc limit 50) a;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id, 'title', e.title, 'category', e.category, 'hostId', e.host_id, 'hostName', coalesce(host_display, ''),
      'status', case when e.deleted_at is not null then 'excluido' when now() >= ev_end then 'encerrado' else 'ativo' end,
      'startAt', e.start_at, 'endAt', ev_end, 'createdAt', e.created_at, 'deletedAt', e.deleted_at,
      'revealEnabled', e.reveal_enabled, 'revealAt', e.reveal_at, 'revealedAt', e.revealed_at,
      'revealState', case when not e.reveal_enabled then 'desativada' when e.revealed_at is not null then 'revelada'
                          when e.reveal_at < now() then 'atrasada' else 'pendente' end,
      'capacity', e.capacity, 'shotsPerPerson', e.shots_per_person, 'isTest', e.is_test, 'timezone', e.timezone,
      'participants', (select count(*) from public.participants p where p.event_id = e.id),
      'photos', (select count(*) from public.photos x where x.event_id = e.id and x.upload_status = 'pronta' and x.deleted_at is null),
      'failedUploads', (select count(*) from public.photos x where x.event_id = e.id and x.upload_status = 'falhou')),
    'entitlement', ent, 'plan', plan, 'notices', notices, 'reportsByReason', reasons, 'printOrders', prints, 'timeline', timeline, 'participants', parts, 'orders', orders, 'audit', aud);
end $$;
-- ---------------------------------------------------------------- execução
revoke all on function public.admin_dashboard_metrics(timestamptz, timestamptz, text, boolean), public.admin_events_board(text, text, int, int),
  public.admin_set_test_flag(uuid[], boolean, text), public.admin_soft_delete_test_events(uuid[], text), public.admin_test_events(int, int, text),
  public.admin_event_detail(uuid) from public, anon;
grant execute on function public.admin_dashboard_metrics(timestamptz, timestamptz, text, boolean), public.admin_events_board(text, text, int, int),
  public.admin_set_test_flag(uuid[], boolean, text), public.admin_soft_delete_test_events(uuid[], text), public.admin_test_events(int, int, text),
  public.admin_event_detail(uuid) to authenticated;
