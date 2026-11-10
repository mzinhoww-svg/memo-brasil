-- Revela 2.0 · Master: botões "Exportar" com função real. ADITIVA (funções novas; nada existente é alterado).
--
-- admin_export_csv(p_kind, p_filters): gera no servidor o CSV dos MESMOS filtros da tela do Master e grava a exportação em audit_logs
--   (quem, qual tela, filtros, nº de linhas). Só equipe da plataforma (is_platform_staff); pagamentos e impressões só Master (como as telas).
--   Tipos: visao (M01: série diária do período) · eventos (M02) · pagamentos (M05) · pessoas (M10: organizadores|convidados|equipe) ·
--   auditoria (M13) · impressoes (pedidos de impressão). Sem fotos, sem conteúdo de comentários, sem e-mails do aviso de revelação
--   (participant_emails/reveal_email_queue nunca são lidos). E-mail de conta só para o Master, mascarado para os demais (como nas telas).
--   Formato: cabeçalho em português, vírgula, texto sempre entre aspas (aspas duplicadas, quebras de linha preservadas), células de texto que
--   começam com = + - @ TAB CR ganham um apóstrofo (proteção contra fórmula em planilha), números sem aspas, datas ISO 8601 em UTC,
--   linhas separadas por CRLF. O BOM UTF-8 é acrescentado pelo cliente. Limite de 50.000 linhas: passou disso, `truncated = true`.
-- Erros: MM004 forbidden · MM005 invalid · MM006 ratelimited.

create function public.csv_cell(v text) returns text
language sql immutable set search_path = '' as $$
  select case when v is null then '' else '"' || replace(case when v ~ E'^[=+@\\t\\r-]' then '''' || v else v end, '"', '""') || '"' end
$$;
create function public.csv_ts(v timestamptz) returns text
language sql immutable set search_path = '' as $$
  select coalesce(to_char(v at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '')
$$;
create function public.csv_line(variadic cells text[]) returns text
language sql immutable set search_path = '' as $$ select array_to_string(cells, ',') $$;

create function public.admin_export_csv(p_kind text, p_filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
end $$;

revoke all on function public.csv_cell(text), public.csv_ts(timestamptz), public.csv_line(text[]), public.admin_export_csv(text, jsonb) from public, anon;
revoke all on function public.csv_cell(text), public.csv_ts(timestamptz), public.csv_line(text[]) from authenticated;
grant execute on function public.admin_export_csv(text, jsonb) to authenticated;
