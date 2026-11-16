-- Rollback do console Master (migrations 20261111*): restaura as funções vigentes ANTES da publicação.
-- Funções novas (inexistentes antes) podem ficar; são só leitura/ação restrita a master.
-- Gerado em 2026-11-12 a partir do banco de produção.

CREATE OR REPLACE FUNCTION public.admin_event_detail(p_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events; host_display text; ev_end timestamptz; master boolean := public.is_master();
        ent jsonb; timeline jsonb; parts jsonb; orders jsonb := '[]'; aud jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into e from public.events where id = p_event;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select coalesce(nullif(e.host_name, ''), pr.display_name, '') into host_display from public.profiles pr where pr.id = e.host_id;
  ev_end := public.event_end(e.start_at, e.duration_hours, e.ended_at);

  select jsonb_build_object('planCode', x.plan_code, 'maxGuests', x.max_guests, 'maxShots', x.max_shots, 'source', x.source)
    into ent from public.effective_entitlement(e.id) x;

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
                                               'reason', a.reason) order by a.at desc, a.id desc), '[]')
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
    'entitlement', ent, 'timeline', timeline, 'participants', parts, 'orders', orders, 'audit', aud);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_events_board(p_filter text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.admin_export_csv(p_kind text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid(); master boolean := public.is_master();
  f jsonb := coalesce(p_filters, '{}'::jsonb); k text; cap constant int := 50000;
  header text; body text; total bigint := 0; n int; trunc boolean;
  q text; pat text; flt text; aba text; dias int; role text; clean jsonb := '{}'::jsonb; ov jsonb;
begin
  if uid is null or not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_kind is null or p_kind not in ('visao', 'eventos', 'pagamentos', 'pessoas', 'auditoria', 'impressoes') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if p_kind in ('pagamentos', 'impressoes') and not master then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if jsonb_typeof(f) <> 'object' then raise exception 'invalid' using errcode = 'MM005'; end if;
  for k in select jsonb_object_keys(f) loop
    if k not in ('dias', 'f', 'q', 'aba', 'a', 'status') then raise exception 'invalid' using errcode = 'MM005'; end if;
  end loop;
  perform public.check_rate_limit('export:' || uid, 20, interval '10 minutes');
  role := case when master then 'master' when public.is_platform_role('support') then 'support' else 'auditor' end;

  q := nullif(left(btrim(coalesce(f ->> 'q', '')), 80), '');
  pat := case when q is null then null else '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
  if q is not null then clean := clean || jsonb_build_object('q', q); end if;

  if p_kind = 'visao' then
    dias := coalesce((f ->> 'dias')::int, 30);
    if dias < 1 or dias > 366 then raise exception 'invalid' using errcode = 'MM005'; end if;
    clean := jsonb_build_object('dias', dias);
    ov := public.admin_overview(dias);
    header := public.csv_line('"data"', '"fotos"', '"entradas_de_convidados"', '"eventos_criados"', '"receita_centavos"');
    select string_agg(public.csv_line(public.csv_cell(s.value ->> 'day'), (s.value ->> 'photos'), (s.value ->> 'joins'), (s.value ->> 'eventsCreated'),
                                      case when master then coalesce(ov -> 'kpis' -> 'revenueCents' -> 'spark' ->> (s.ord::int - 1), '0') else '' end), E'\r\n' order by s.ord),
           count(*)
      into body, total
      from jsonb_array_elements(ov -> 'series') with ordinality as s(value, ord);

  elsif p_kind = 'eventos' then
    flt := nullif(f ->> 'f', '');
    if flt is not null and flt not in ('rolando', 'aguardando', 'revelados', 'denuncias', 'excluidos') then raise exception 'invalid' using errcode = 'MM005'; end if;
    if flt is not null then clean := clean || jsonb_build_object('f', flt); end if;
    header := public.csv_line('"evento_id"', '"titulo"', '"anfitriao"', '"categoria"', '"plano"', '"convidados"', '"capacidade"', '"fotos"', '"denuncias"',
                              '"revelacao_ativa"', '"revelacao_prevista_em"', '"revelado_em"', '"criado_em"', '"excluido_em"', '"situacao"');
    with b as (
      select e.id, e.title, coalesce(nullif(e.host_name, ''), pr.display_name, '') as host, e.category, e.capacity, e.created_at, e.deleted_at,
             e.reveal_enabled, e.reveal_at, e.revealed_at,
             (now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)) as live,
             (select pl.name from public.plans pl where pl.code = (select ee.plan_code from public.effective_entitlement(e.id) ee)) as plan_name,
             (select count(*) from public.participants p where p.event_id = e.id) as participants,
             (select count(*) from public.photos ph where ph.event_id = e.id and ph.upload_status = 'pronta' and ph.deleted_at is null) as photos,
             (select count(*) from public.photos ph where ph.event_id = e.id and ph.deleted_at is null and ph.status = 'visivel' and ph.reports > 0)
               + (select count(*) from public.photo_comments c where c.event_id = e.id and c.deleted_at is null and c.hidden_at is null and c.reports > 0) as reports
        from public.events e left join public.profiles pr on pr.id = e.host_id
       where not e.is_test and (pat is null or e.title ilike pat or e.host_name ilike pat or pr.display_name ilike pat)
    ), x as (
      select b.*, row_number() over (order by b.created_at desc, b.id) as rn from b
       where case flt
               when 'rolando' then deleted_at is null and live
               when 'aguardando' then deleted_at is null and reveal_enabled and revealed_at is null
               when 'revelados' then deleted_at is null and revealed_at is not null
               when 'denuncias' then deleted_at is null and reports > 0
               when 'excluidos' then deleted_at is not null
               else deleted_at is null end
       limit cap + 1
    )
    select string_agg(public.csv_line(public.csv_cell(x.id::text), public.csv_cell(x.title), public.csv_cell(x.host), public.csv_cell(x.category), public.csv_cell(x.plan_name),
             x.participants::text, coalesce(x.capacity::text, ''), x.photos::text, x.reports::text, case when x.reveal_enabled then 'sim' else 'não' end,
             public.csv_ts(x.reveal_at), public.csv_ts(x.revealed_at), public.csv_ts(x.created_at), public.csv_ts(x.deleted_at),
             public.csv_cell(case when x.deleted_at is not null then 'excluido' when x.revealed_at is not null then 'revelado' when x.live then 'rolando'
                                  when x.reveal_enabled then 'aguardando_revelacao' else 'encerrado' end)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;

  elsif p_kind = 'pagamentos' then
    flt := nullif(f ->> 'f', '');
    if flt is not null and flt not in ('pix', 'cartao', 'pendentes', 'recusados', 'estornos') then raise exception 'invalid' using errcode = 'MM005'; end if;
    if flt is not null then clean := clean || jsonb_build_object('f', flt); end if;
    clean := clean - 'q';
    header := public.csv_line('"pedido"', '"criado_em"', '"evento"', '"plano"', '"valor_centavos"', '"status"', '"metodo"', '"ambiente"', '"pago_em"',
                              '"precisa_estorno"', '"estorno_solicitado_em"');
    with x as (
      select o.*, e.title as event_title, p.name as plan_name, row_number() over (order by o.created_at desc, o.id) as rn
        from public.payment_orders o left join public.events e on e.id = o.event_id left join public.plans p on p.code = o.plan_code
       where case flt
               when 'pix' then o.payment_method = 'pix'
               when 'cartao' then o.payment_method in ('card', 'cartao')
               when 'pendentes' then o.status = 'pendente'
               when 'recusados' then o.status = 'falhou'
               when 'estornos' then o.status = 'estornado' or o.needs_refund or o.refund_requested_at is not null
               else true end
       limit cap + 1
    )
    select string_agg(public.csv_line(public.csv_cell(x.id::text), public.csv_ts(x.created_at), public.csv_cell(coalesce(x.event_title, 'Evento excluído')), public.csv_cell(coalesce(x.plan_name, x.plan_code)),
             x.amount_cents::text, public.csv_cell(x.status::text), public.csv_cell(x.payment_method), public.csv_cell(x.provider_env), public.csv_ts(x.paid_at),
             case when x.needs_refund then 'sim' else 'não' end, public.csv_ts(x.refund_requested_at)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;

  elsif p_kind = 'pessoas' then
    aba := coalesce(nullif(f ->> 'aba', ''), 'organizadores');
    if aba not in ('organizadores', 'convidados', 'equipe') then raise exception 'invalid' using errcode = 'MM005'; end if;
    clean := clean || jsonb_build_object('aba', aba);
    if aba = 'organizadores' then
      header := public.csv_line('"nome"', '"email"', '"entrou_com"', '"eventos"', '"gasto_total_centavos"', '"primeiro_evento_em"', '"exclusao_pedida"');
      with org as (
        select e.host_id, count(*) as events_count, min(e.created_at) as first_event_at, max(e.created_at) as last_event_at
          from public.events e where e.deleted_at is null group by e.host_id
      ), x as (
        select o.*, pr.display_name, u.email, coalesce(u.raw_app_meta_data ->> 'provider', 'anonymous') as provider,
               row_number() over (order by o.last_event_at desc, o.host_id) as rn
          from org o join public.profiles pr on pr.id = o.host_id left join auth.users u on u.id = o.host_id
         where pat is null or pr.display_name ilike pat or (master and u.email ilike pat)
         limit cap + 1
      )
      select string_agg(public.csv_line(public.csv_cell(x.display_name),
               public.csv_cell(case when master then x.email else regexp_replace(x.email, '^(.).*(@.*)$', '\1***\2') end),
               public.csv_cell(case x.provider when 'google' then 'Google' when 'email' then 'Link por e-mail' else 'Convidado' end),
               x.events_count::text,
               case when master then coalesce((select sum(po.amount_cents) from public.payment_orders po where po.host_id = x.host_id and po.status = 'pago'), 0)::text else '' end,
               public.csv_ts(x.first_event_at),
               case when exists (select 1 from public.account_deletion_requests d where d.user_id = x.host_id and d.processed_at is null) then 'sim' else 'não' end),
             E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
        into body, total from x;
    elsif aba = 'convidados' then
      header := public.csv_line('"nome"', '"evento"', '"mesa"', '"entrou_em"', '"situacao"');
      with x as (
        select p.name, e.title, p.table_label, p.joined_at, p.blocked_at, (p.user_id = e.host_id) as is_host,
               row_number() over (order by p.joined_at desc, p.event_id, p.user_id) as rn
          from public.participants p join public.events e on e.id = p.event_id
         where q is null or strpos(lower(p.name), lower(q)) > 0 or strpos(lower(e.title), lower(q)) > 0 or strpos(lower(p.table_label), lower(q)) > 0
         limit cap + 1
      )
      select string_agg(public.csv_line(public.csv_cell(x.name), public.csv_cell(x.title), public.csv_cell(x.table_label), public.csv_ts(x.joined_at),
               public.csv_cell(case when x.blocked_at is not null then 'bloqueado' when x.is_host then 'organizador' else 'ativo' end)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
        into body, total from x;
    else
      clean := clean - 'q';
      header := public.csv_line('"email"', '"papel"', '"desde"');
      with x as (
        select r.role, r.granted_at, u.email, row_number() over (order by r.granted_at, r.id) as rn
          from public.platform_roles r join auth.users u on u.id = r.user_id where r.revoked_at is null
         limit cap + 1
      )
      select string_agg(public.csv_line(public.csv_cell(case when master then x.email else regexp_replace(x.email, '^(.).*(@.*)$', '\1***\2') end),
               public.csv_cell(x.role), public.csv_ts(x.granted_at)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
        into body, total from x;
    end if;

  elsif p_kind = 'auditoria' then
    flt := nullif(left(btrim(coalesce(f ->> 'a', '')), 60), '');
    clean := case when flt is null then '{}'::jsonb else jsonb_build_object('a', flt) end;
    header := public.csv_line('"id"', '"quando"', '"papel_do_autor"', '"autor_id"', '"evento_id"', '"acao"', '"alvo_tipo"', '"alvo_id"', '"motivo"');
    with x as (
      select a.*, row_number() over (order by a.at desc, a.id desc) as rn from public.audit_logs a
       where flt is null or a.action like replace(replace(replace(flt, '\', '\\'), '%', '\%'), '_', '\_') || '%'
       limit cap + 1
    )
    select string_agg(public.csv_line(x.id::text, public.csv_ts(x.at), public.csv_cell(x.actor_role), public.csv_cell(x.actor_id::text), public.csv_cell(x.event_id::text),
             public.csv_cell(x.action), public.csv_cell(x.target_type), public.csv_cell(x.target_id), public.csv_cell(x.reason)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;

  else -- impressoes
    flt := nullif(f ->> 'status', '');
    if flt is not null and flt not in ('solicitado', 'em_producao', 'enviado', 'entregue', 'cancelado') then raise exception 'invalid' using errcode = 'MM005'; end if;
    if flt is not null then clean := clean || jsonb_build_object('status', flt); end if;
    header := public.csv_line('"pedido"', '"criado_em"', '"atualizado_em"', '"evento"', '"produto"', '"quantidade"', '"fotos"', '"solicitante"', '"contato_nome"',
                              '"contato_telefone"', '"contato_email"', '"cep"', '"rua"', '"numero"', '"complemento"', '"bairro"', '"cidade"', '"uf"',
                              '"observacao"', '"status"', '"nota_interna"');
    with x as (
      select o.*, row_number() over (order by o.created_at desc, o.id) as rn from public.print_orders o
       where (flt is null or o.status = flt)
         and (pat is null or o.contact_name ilike pat or o.contact_email ilike pat or o.contact_phone ilike pat or o.event_title ilike pat or o.id::text ilike pat)
       limit cap + 1
    )
    select string_agg(public.csv_line(public.csv_cell(x.id::text), public.csv_ts(x.created_at), public.csv_ts(x.updated_at), public.csv_cell(x.event_title),
             public.csv_cell(x.product), x.quantity::text, case when x.all_photos then '"todas"' else cardinality(x.photo_ids)::text end, public.csv_cell(x.requester_kind),
             public.csv_cell(x.contact_name), public.csv_cell(x.contact_phone), public.csv_cell(x.contact_email), public.csv_cell(x.shipping ->> 'cep'),
             public.csv_cell(x.shipping ->> 'street'), public.csv_cell(x.shipping ->> 'number'), public.csv_cell(x.shipping ->> 'complement'),
             public.csv_cell(x.shipping ->> 'neighborhood'), public.csv_cell(x.shipping ->> 'city'), public.csv_cell(x.shipping ->> 'state'),
             public.csv_cell(x.note), public.csv_cell(x.status), public.csv_cell(x.note_internal)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;
  end if;

  trunc := total > cap;
  n := least(total, cap)::int;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, detail)
  values (uid, role, 'export.csv', 'export', p_kind, jsonb_build_object('kind', p_kind, 'filters', clean, 'rows', n, 'truncated', trunc));
  return jsonb_build_object('kind', p_kind, 'rows', n, 'truncated', trunc, 'csv', header || E'\r\n' || case when body is null then '' else body || E'\r\n' end);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_grant_platform_role(p_user uuid, p_role text, p_reason text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare new_id bigint;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if not exists (select 1 from auth.users where id = p_user and not coalesce(is_anonymous, false)) then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform set_config('mm.audit_reason', btrim(p_reason), true);
  insert into public.platform_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid()) returning id into new_id;
  return new_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_audit(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_action text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_action), '') is null then null
                         else replace(replace(replace(left(btrim(p_action), 60), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.audit_logs where pat is null or action like pat),
    'limit', lim, 'offset', off,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'at', a.at, 'actorId', a.actor_id, 'actorRole', a.actor_role, 'eventId', a.event_id,
        'action', a.action, 'targetType', a.target_type, 'targetId', a.target_id, 'reason', a.reason) order by a.at desc, a.id desc), '[]')
      from (select * from public.audit_logs where pat is null or action like pat order by at desc, id desc limit lim offset off) a));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_audit_v2(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_category text DEFAULT NULL::text, p_event uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
        re text := public.audit_category_pattern(p_category);
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_category is not null and re is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.audit_logs a where (re is null or a.action ~ re) and (p_event is null or a.event_id = p_event)),
    'limit', lim, 'offset', off,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'at', a.at, 'actorId', a.actor_id,
        'actorRole', coalesce(a.actor_role, public.audit_actor_role_for(a.actor_id, a.event_id)),
        'eventId', a.event_id, 'action', a.action,
        'targetType', coalesce(a.target_type, case when a.target_id is null and a.event_id is not null then 'event' end),
        'targetId', coalesce(a.target_id, case when a.target_type is null and a.event_id is not null then a.event_id::text end),
        'reason', a.reason, 'eventTitle', e.title,
        'sensitive', a.reason is not null
                     or a.action ~ '^(admin\.|platform_role\.|platform_settings\.|feature_flags\.|plan\.updated|entitlement\.courtesy|payment\.refund|photo\.access|audit\.)')
        order by a.at desc, a.id desc), '[]')
      from (select * from public.audit_logs l where (re is null or l.action ~ re) and (p_event is null or l.event_id = p_event)
             order by l.at desc, l.id desc limit lim offset off) a
      left join public.events e on e.id = a.event_id));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_organizers(p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_search), '') is null then null
                         else '%' || replace(replace(replace(left(btrim(p_search), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
        full_pii boolean := public.is_master(); total bigint; items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with org as (
    select e.host_id, count(*) as events_count,
           count(*) filter (where now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)) as active_events,
           min(e.created_at) as first_event_at, max(e.created_at) as last_event_at
    from public.events e where e.deleted_at is null group by e.host_id
  ), f as (
    select o.*, pr.display_name, u.email from org o
    join public.profiles pr on pr.id = o.host_id left join auth.users u on u.id = o.host_id
    where pat is null or pr.display_name ilike pat or (full_pii and u.email ilike pat)
  )
  select (select count(*) from f), coalesce(jsonb_agg(jsonb_build_object(
      'userId', p.host_id, 'displayName', p.display_name,
      'email', case when full_pii then p.email else regexp_replace(p.email, '^(.).*(@.*)$', '\1***\2') end,
      'eventsCount', p.events_count, 'activeEvents', p.active_events, 'firstEventAt', p.first_event_at, 'lastEventAt', p.last_event_at,
      'photos', (select count(*) from public.photos ph join public.events e on e.id = ph.event_id
                 where e.host_id = p.host_id and e.deleted_at is null and ph.upload_status = 'pronta' and ph.deleted_at is null),
      'deletionRequested', exists (select 1 from public.account_deletion_requests d where d.user_id = p.host_id and d.processed_at is null))
    order by p.last_event_at desc, p.host_id), '[]')
  into total, items
  from (select * from f order by last_event_at desc, host_id limit lim offset off) p;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_users_v2(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_kind text DEFAULT NULL::text, p_include_tests boolean DEFAULT false, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
        inc boolean := coalesce(p_include_tests, false); master boolean := public.is_master();
        q text := nullif(left(btrim(coalesce(p_search, '')), 80), '');
        pat text; total bigint; items jsonb; summary jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_kind is not null and p_kind not in ('google', 'email', 'anon') then raise exception 'invalid' using errcode = 'MM005'; end if;
  pat := case when q is null then null else '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  with base as (
    select u.id, u.created_at, coalesce(u.is_anonymous, false) as anon, coalesce(u.raw_app_meta_data ->> 'provider', 'anonymous') as provider,
           u.email, u.last_sign_in_at, pr.display_name, coalesce(pr.is_test, false) as is_test,
           coalesce(u.is_anonymous, false) and not exists (select 1 from public.participants p where p.user_id = u.id) as orphan
      from auth.users u left join public.profiles pr on pr.id = u.id
     where inc or not coalesce(pr.is_test, false)
  ), f as (
    select * from base b
     where (p_kind is null or (p_kind = 'anon' and b.anon) or (p_kind = 'google' and not b.anon and b.provider = 'google')
            or (p_kind = 'email' and not b.anon and b.provider = 'email'))
       and (q is null or b.id::text = lower(q) or b.display_name ilike pat or (master and b.email ilike pat))
  )
  select (select count(*) from f),
         (select jsonb_build_object('google', count(*) filter (where not anon and provider = 'google'),
                                    'email', count(*) filter (where not anon and provider = 'email'),
                                    'anon', count(*) filter (where anon), 'orphanAnon', count(*) filter (where orphan)) from base),
         coalesce(jsonb_agg(jsonb_build_object(
      'userId', x.id, 'isAnonymous', x.anon, 'provider', x.provider,
      'email', case when x.email is null then null when master then x.email else regexp_replace(x.email, '^(.).*(@.*)$', '\1***\2') end,
      'createdAt', x.created_at, 'lastSignInAt', x.last_sign_in_at,
      'platformRole', (select r.role from public.platform_roles r where r.user_id = x.id and r.revoked_at is null
                        order by case r.role when 'master' then 0 when 'support' then 1 else 2 end limit 1),
      'eventsLinked', (select count(*) from (select e.id from public.events e where e.host_id = x.id and e.deleted_at is null
                                             union select p.event_id from public.participants p where p.user_id = x.id) l),
      'isTest', x.is_test, 'orphanAnon', x.orphan) order by x.created_at desc, x.id), '[]')
    into total, summary, items
    from (select * from f order by created_at desc, id limit lim offset off) x;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items, 'summary', summary);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_print_orders(p_filter text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_search), '') is null then null
                         else '%' || replace(replace(replace(left(btrim(p_search), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
        total bigint; counts jsonb; items jsonb;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_filter is not null and p_filter not in ('solicitado', 'em_producao', 'enviado', 'entregue', 'cancelado') then raise exception 'invalid' using errcode = 'MM005'; end if;
  with b as (
    select o.* from public.print_orders o
     where pat is null or o.contact_name ilike pat or o.contact_email ilike pat or o.contact_phone ilike pat or o.event_title ilike pat or o.id::text ilike pat
  ), f as (select b.* from b where p_filter is null or b.status = p_filter),
  page as (select f.* from f order by f.created_at desc, f.id limit lim offset off)
  select (select count(*) from f),
         (select jsonb_build_object('todos', count(*), 'solicitado', count(*) filter (where status = 'solicitado'), 'em_producao', count(*) filter (where status = 'em_producao'),
                                    'enviado', count(*) filter (where status = 'enviado'), 'entregue', count(*) filter (where status = 'entregue'),
                                    'cancelado', count(*) filter (where status = 'cancelado')) from b),
         coalesce(jsonb_agg(public.print_order_json(row(p.*)::public.print_orders, false) || jsonb_build_object('noteInternal', p.note_internal, 'requesterId', p.requester_id)
                            order by p.created_at desc, p.id), '[]'::jsonb)
    into total, counts, items from page p;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'counts', counts, 'items', items);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_platform_role(p_user uuid, p_role text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if p_role = 'master' and (select count(*) from public.platform_roles where role = 'master' and revoked_at is null) <= 1 then
    raise exception 'último master não pode ser revogado' using errcode = 'MM009';
  end if;
  perform set_config('mm.audit_reason', btrim(p_reason), true);
  update public.platform_roles set revoked_at = now() where user_id = p_user and role = p_role and revoked_at is null;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_feature_flag(p_key text, p_enabled boolean, p_rollout jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if p_enabled is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform set_config('mm.audit_reason', btrim(p_reason), true);
  insert into public.feature_flags (key, enabled, rollout, updated_by) values (p_key, p_enabled, coalesce(p_rollout, '{}'), auth.uid())
  on conflict (key) do update set enabled = excluded.enabled, rollout = excluded.rollout, updated_by = excluded.updated_by;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_print_order_status(p_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.print_orders; why text := nullif(btrim(coalesce(p_note, '')), ''); old text;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_status not in ('em_producao', 'enviado', 'entregue', 'cancelado') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if why is not null and char_length(why) > 500 then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into o from public.print_orders where id = p_id for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  old := o.status;
  if not ((old = 'solicitado' and p_status in ('em_producao', 'cancelado')) or (old = 'em_producao' and p_status in ('enviado', 'cancelado'))
          or (old = 'enviado' and p_status = 'entregue')) then
    raise exception 'estado' using errcode = 'MM009';
  end if;
  if p_status = 'cancelado' and (why is null or char_length(why) < 10) then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  update public.print_orders set status = p_status, note_internal = coalesce(why, note_internal), updated_at = now(), updated_by = auth.uid(),
         production_at = case when p_status = 'em_producao' then now() else production_at end,
         shipped_at = case when p_status = 'enviado' then now() else shipped_at end,
         delivered_at = case when p_status = 'entregue' then now() else delivered_at end,
         cancelled_at = case when p_status = 'cancelado' then now() else cancelled_at end
   where id = p_id returning * into o;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', o.event_id, 'print_order.status_changed', 'print_order', o.id::text, why, jsonb_build_object('from', old, 'to', p_status));
  return public.print_order_json(o, false) || jsonb_build_object('noteInternal', o.note_internal);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_setting(p_key text, p_value jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if p_value is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform set_config('mm.audit_reason', btrim(p_reason), true);
  insert into public.platform_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_test_flag(p_events uuid[], p_value boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare why text; r record; n int := 0;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  if p_value is null or p_events is null or cardinality(p_events) = 0 or cardinality(p_events) > 500 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if exists (select 1 from unnest(p_events) x(id) where x.id is null or not exists (select 1 from public.events e where e.id = x.id)) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  for r in select e.id from public.events e where e.id = any (p_events) and e.is_test is distinct from p_value order by e.id for update loop
    update public.events set is_test = p_value where id = r.id;
    perform public.admin_log(case when p_value then 'admin.set_test_flag' else 'admin.unset_test_flag' end, 'event', r.id::text, why, r.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'updated', n);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_soft_delete_test_events(p_events uuid[], p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare why text; r record; n int := 0;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  if p_events is null or cardinality(p_events) = 0 or cardinality(p_events) > 500 then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform 1 from public.events e where e.id = any (p_events) order by e.id for update;
  if exists (select 1 from unnest(p_events) x(id) where x.id is null or not exists (select 1 from public.events e where e.id = x.id)) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if exists (select 1 from public.events e where e.id = any (p_events) and not e.is_test) then
    raise exception 'nottest' using errcode = 'MM005';
  end if;
  -- marca de teste não basta: evento com dinheiro retido (pedido pago ou em disputa) ou com direito não gratuito ativo
  -- (pago, cortesia, código) nunca vai para a lixeira em lote. Pedido estornado/expirado não bloqueia (homologação Pix).
  -- Só leitura de payment_orders/event_entitlements.
  if exists (select 1 from public.payment_orders o where o.event_id = any (p_events) and o.status in ('pago', 'em_disputa'))
     or exists (select 1 from public.event_entitlements ee where ee.event_id = any (p_events) and ee.status = 'ativo'
                  and ee.source in ('pago', 'cortesia', 'codigo')) then
    raise exception 'paid' using errcode = 'MM005';
  end if;
  for r in select e.id from public.events e where e.id = any (p_events) and e.deleted_at is null order by e.id loop
    update public.events set deleted_at = now() where id = r.id and is_test;
    perform public.admin_log('admin.soft_delete_test_events', 'event', r.id::text, why, r.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'deleted', n);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_storage_breakdown()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tz constant text := 'America/Cuiaba'; r jsonb; growth jsonb; d0 date := (now() at time zone 'America/Cuiaba')::date - 29;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with o as (
    select ob.created_at, coalesce((ob.metadata ->> 'size')::bigint, 0) as sz,
           case when ob.bucket_id = 'event-branding' then 'branding'
                when not exists (select 1 from public.photos ph where ph.id = public.photo_id_from_path(ob.name)
                                   and ob.name in (ph.storage_path, ph.storage_path || '.thumb')) then 'orphan'
                when ob.name like '%.thumb' then 'derived' else 'original' end as cls
    from storage.objects ob where ob.bucket_id in ('event-photos', 'event-branding')
  )
  select jsonb_build_object(
    'originals', jsonb_build_object('n', count(*) filter (where cls = 'original'), 'bytes', coalesce(sum(sz) filter (where cls = 'original'), 0)),
    'derived', jsonb_build_object('n', count(*) filter (where cls = 'derived'), 'bytes', coalesce(sum(sz) filter (where cls = 'derived'), 0)),
    'orphans', jsonb_build_object('n', count(*) filter (where cls = 'orphan'), 'bytes', coalesce(sum(sz) filter (where cls = 'orphan'), 0)),
    'branding', jsonb_build_object('n', count(*) filter (where cls = 'branding'), 'bytes', coalesce(sum(sz) filter (where cls = 'branding'), 0)),
    'avgPhotoBytes', coalesce(round(avg(sz) filter (where cls = 'original')), 0)::bigint,
    'totalBytes', coalesce(sum(sz), 0))
  into r from o;

  select coalesce(jsonb_agg(jsonb_build_object('day', g::date, 'bytes', coalesce(x.b, 0)) order by g), '[]') into growth
  from generate_series(d0::timestamp, (d0 + 29)::timestamp, interval '1 day') g
  left join (select (ob.created_at at time zone tz)::date as day, sum(coalesce((ob.metadata ->> 'size')::bigint, 0)) as b
               from storage.objects ob
              where ob.bucket_id in ('event-photos', 'event-branding') and ob.created_at >= (d0::timestamp at time zone tz)
              group by 1) x on x.day = g::date;
  return r || jsonb_build_object('growth', growth);
end $function$;

CREATE OR REPLACE FUNCTION public.create_print_order(p_id uuid, p_event uuid, p_product text, p_quantity integer, p_photo_ids uuid[], p_all_photos boolean, p_contact_name text, p_contact_phone text, p_contact_email text, p_shipping jsonb, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid(); ev public.events; host boolean; ids uuid[]; cap int; ok_count int;
  nm text := btrim(coalesce(p_contact_name, '')); ph text := nullif(regexp_replace(coalesce(p_contact_phone, ''), '[^0-9]', '', 'g'), '');
  em text := nullif(lower(btrim(coalesce(p_contact_email, ''))), ''); nt text := nullif(btrim(coalesce(p_note, '')), '');
  sh jsonb; cep text; uf text; existing public.print_orders; o public.print_orders; k text;
begin
  if uid is null or p_id is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into existing from public.print_orders where id = p_id;
  if found then
    if existing.requester_id is distinct from uid then raise exception 'forbidden' using errcode = 'MM004'; end if;
    return public.print_order_json(existing, true);
  end if;
  select * into ev from public.events where id = p_event and deleted_at is null;
  if not found then raise exception 'forbidden' using errcode = 'MM004'; end if;
  host := ev.host_id = uid;
  if not (host or public.is_member(p_event)) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.is_revealed(p_event) then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform public.check_rate_limit('print:' || uid, 6, interval '1 hour');
  if (select count(*) from public.print_orders x where x.requester_id = uid and x.event_id = p_event and x.status = 'solicitado') >= 5 then
    raise exception 'ratelimited' using errcode = 'MM006';
  end if;

  if p_product not in ('album', 'caixa') or p_quantity is null or p_quantity < 1 or p_quantity > 10 then raise exception 'invalid' using errcode = 'MM005'; end if;
  cap := case p_product when 'album' then 60 else 30 end;
  if coalesce(p_all_photos, false) then
    ids := '{}';
  else
    select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(p_photo_ids, '{}')) x;
    if cardinality(ids) < 1 or cardinality(ids) > cap then raise exception 'invalid' using errcode = 'MM005'; end if;
    select count(*) into ok_count from public.photos ph2
     where ph2.id = any (ids) and ph2.event_id = p_event and ph2.upload_status = 'pronta' and ph2.deleted_at is null and public.can_see_photo(ph2.id);
    if ok_count <> cardinality(ids) then raise exception 'invalid' using errcode = 'MM005'; end if;
  end if;

  if char_length(nm) < 2 or char_length(nm) > 80 then raise exception 'invalid' using errcode = 'MM005'; end if;
  if ph is not null and (char_length(ph) < 10 or char_length(ph) > 13) then raise exception 'invalid' using errcode = 'MM005'; end if;
  if em is not null and (char_length(em) > 254 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if ph is null and em is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  if nt is not null and char_length(nt) > 500 then raise exception 'invalid' using errcode = 'MM005'; end if;

  if p_shipping is null or jsonb_typeof(p_shipping) <> 'object' then raise exception 'invalid' using errcode = 'MM005'; end if;
  for k in select jsonb_object_keys(p_shipping) loop
    if k not in ('cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state') then raise exception 'invalid' using errcode = 'MM005'; end if;
  end loop;
  cep := regexp_replace(coalesce(p_shipping ->> 'cep', ''), '[^0-9]', '', 'g');
  uf := upper(btrim(coalesce(p_shipping ->> 'state', '')));
  if cep !~ '^[0-9]{8}$' or uf !~ '^[A-Z]{2}$'
     or char_length(btrim(coalesce(p_shipping ->> 'street', ''))) not between 3 and 120
     or char_length(btrim(coalesce(p_shipping ->> 'number', ''))) not between 1 and 20
     or char_length(btrim(coalesce(p_shipping ->> 'complement', ''))) > 60
     or char_length(btrim(coalesce(p_shipping ->> 'neighborhood', ''))) not between 2 and 80
     or char_length(btrim(coalesce(p_shipping ->> 'city', ''))) not between 2 and 80 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  sh := jsonb_build_object('cep', cep, 'street', btrim(p_shipping ->> 'street'), 'number', btrim(p_shipping ->> 'number'),
                           'complement', nullif(btrim(coalesce(p_shipping ->> 'complement', '')), ''), 'neighborhood', btrim(p_shipping ->> 'neighborhood'),
                           'city', btrim(p_shipping ->> 'city'), 'state', uf);

  insert into public.print_orders (id, event_id, event_title, requester_id, requester_kind, product, quantity, photo_ids, all_photos,
                                   contact_name, contact_phone, contact_email, shipping, note, updated_by)
  values (p_id, p_event, ev.title, uid, case when host then 'anfitriao' else 'convidado' end, p_product, p_quantity, ids, coalesce(p_all_photos, false),
          nm, ph, em, sh, nt, uid)
  returning * into o;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, detail)
  values (uid, case when host then 'organizador' else 'convidado' end, p_event, 'print_order.created', 'print_order', o.id::text,
          jsonb_build_object('product', p_product, 'quantity', p_quantity, 'photos', case when o.all_photos then null else cardinality(ids) end, 'allPhotos', o.all_photos));
  return public.print_order_json(o, true);
end $function$;

CREATE OR REPLACE FUNCTION public.settings_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  why text := nullif(btrim(coalesce(current_setting('mm.audit_reason', true), '')), '');
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
  values (auth.uid(), case when public.is_master() then 'master' else 'operador' end,
          tg_table_name || '.' || lower(tg_op), tg_table_name, r.key, left(why, 500),
          case when tg_table_name = 'feature_flags'
               then jsonb_build_object('enabled', to_jsonb(r) -> 'enabled', 'rollout', to_jsonb(r) -> 'rollout')
               else jsonb_build_object('value_bytes', octet_length((to_jsonb(r) ->> 'value'))) end); -- valor de configuração não vai para o log
  return r;
end $function$;

-- admin_dashboard_metrics: a assinatura mudou (ganha p_include_tests). Para voltar: remover a nova e recriar a antiga.
drop function if exists public.admin_dashboard_metrics(timestamptz, timestamptz, text, boolean);
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics(p_from timestamp with time zone DEFAULT (now() - '30 days'::interval), p_to timestamp with time zone DEFAULT now(), p_tz text DEFAULT 'America/Cuiaba'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb; st jsonb; series jsonb;
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
             where created_at >= p_from and created_at < p_to group by 1) ec on ec.day = d::date
  left join (select (joined_at at time zone p_tz)::date as day, count(*) n from public.participants
             where joined_at >= p_from and joined_at < p_to group by 1) pj on pj.day = d::date
  left join (select (created_at at time zone p_tz)::date as day, count(*) n from public.photos
             where upload_status = 'pronta' and created_at >= p_from and created_at < p_to group by 1) pu on pu.day = d::date
  left join (select (created_at at time zone p_tz)::date as day, count(*) n from public.photos
             where (upload_status = 'falhou' or (upload_status = 'enviando' and created_at < now() - interval '1 hour'))
               and created_at >= p_from and created_at < p_to group by 1) uf on uf.day = d::date;

  r := jsonb_build_object(
    'from', p_from, 'to', p_to, 'tz', p_tz, 'generatedAt', now(),
    'events', jsonb_build_object(
      'created', (select count(*) from public.events where created_at >= p_from and created_at < p_to),
      'active', (select count(*) from public.events e where e.deleted_at is null and now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)),
      'ended', (select count(*) from public.events e where e.deleted_at is null and now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at)),
      'total', (select count(*) from public.events where deleted_at is null)),
    'organizers', jsonb_build_object(
      -- ativo no período = tem evento não apagado que começou antes do fim do período e terminou depois do início
      'active', (select count(distinct e.host_id) from public.events e
                 where e.deleted_at is null and e.start_at < p_to and public.event_end(e.start_at, e.duration_hours, e.ended_at) >= p_from),
      'total', (select count(distinct host_id) from public.events where deleted_at is null)),
    'participants', jsonb_build_object(
      'joined', (select count(*) from public.participants where joined_at >= p_from and joined_at < p_to),
      'total', (select count(*) from public.participants)),
    'photos', jsonb_build_object(
      'uploaded', (select count(*) from public.photos where upload_status = 'pronta' and created_at >= p_from and created_at < p_to),
      'total', (select count(*) from public.photos where upload_status = 'pronta' and deleted_at is null)),
    'uploads', jsonb_build_object(
      'failed', (select count(*) from public.photos
                 where (upload_status = 'falhou' or (upload_status = 'enviando' and created_at < now() - interval '1 hour'))
                   and created_at >= p_from and created_at < p_to),
      'inProgress', (select count(*) from public.photos where upload_status = 'enviando' and created_at >= now() - interval '1 hour')),
    'reveals', jsonb_build_object(
      'pending', (select count(*) from public.events where reveal_enabled and revealed_at is null and deleted_at is null),
      'overdue', (select count(*) from public.events where reveal_enabled and revealed_at is null and deleted_at is null and reveal_at < now())),
    'storage', st,
    'series', series);
  return r;
end $function$;
