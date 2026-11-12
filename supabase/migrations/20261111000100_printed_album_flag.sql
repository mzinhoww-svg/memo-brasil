-- Revela 2.0 · Master: papéis do console (M32) e álbum impresso desligável. ADITIVA (create function / create or replace; nenhuma tabela alterada).
--
-- current_platform_role(): o papel de plataforma ATIVO de quem chama ('master' | 'support' | 'auditor') ou null. Mesma regra de is_platform_role
--   (claim app_metadata.role E linha ativa em platform_roles), numa chamada só: é o que o layout do /master usa para admitir support e auditor.
-- Alinhamento com a matriz de papéis da M32 (decisão: opção mais segura, registrada em docs/evidence/revela-fiel/master/DIVERGENCIAS.md):
--   * Auditoria (admin_list_audit, admin_list_audit_v2): só master e auditor. Antes qualquer staff lia a trilha por RPC, embora a política de
--     audit_logs já negasse ao support (pgTAP 02, "support não lê a trilha de auditoria").
--   * Exportar (admin_export_csv): só master e auditor. Antes qualquer staff exportava; support passa a receber MM004.
-- printed_album_enabled(): a chave `printed_album` de feature_flags (sem linha = desligado, como `validapay_card`). Quem liga é o master, pela
--   RPC admin_set_feature_flag (com motivo, auditada). Legível por qualquer authenticated (anfitrião precisa saber se mostra o pedido de impressão).
--   create_print_order passa a recusar (MM004) com a chave desligada, para que esconder a tela não deixe a RPC aberta.

create function public.current_platform_role() returns text
language sql stable security definer set search_path = '' as $$
  select r from unnest(array['master', 'support', 'auditor']) as r where public.is_platform_role(r) limit 1
$$;

create function public.printed_album_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.feature_flags f where f.key = 'printed_album' and f.enabled)
$$;

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
  if not public.printed_album_enabled() then raise exception 'forbidden' using errcode = 'MM004'; end if; -- álbum impresso desligado (chave printed_album)
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
  if not (public.is_master() or public.is_platform_role('auditor')) then raise exception 'forbidden' using errcode = 'MM004'; end if;
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
  if not (public.is_master() or public.is_platform_role('auditor')) then raise exception 'forbidden' using errcode = 'MM004'; end if;
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
  if uid is null or not (master or public.is_platform_role('auditor')) then raise exception 'forbidden' using errcode = 'MM004'; end if;
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

revoke all on function public.current_platform_role(), public.printed_album_enabled() from public, anon;
grant execute on function public.current_platform_role(), public.printed_album_enabled() to authenticated;
