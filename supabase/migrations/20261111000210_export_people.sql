-- Revela 2.0 · Master: exportar Pessoas (M24 em Contas, Organizadores, Convidados e Convites). ADITIVA (função nova + create or replace da MESMA assinatura).
--
-- admin_export_people(aba, q, filtro, master, teto): monta cabeçalho e linhas do CSV de cada aba de Pessoas com os MESMOS filtros da tela:
--   contas (f: equipe | google | email | convidados) · organizadores · convidados (f: ativos | bloqueados | organizadores) · convites (f: ativos | expirados | esgotados | revogados)
--   · equipe. Colunas = as da tela. E-mail só para o master, mascarado (a***@dominio) para os demais; gasto total só para o master. Convites sem token nem hash;
--   convidados sem e-mail de aviso de revelação. Filtro inválido: MM005.
-- admin_export_csv (substituída): o ramo 'pessoas' passa a delegar a admin_export_people e aceita as abas contas e convites. Todo o resto é igual à versão anterior
--   (papéis master e auditor, teto de 50.000 linhas, auditoria 'export.csv', limite de 20 por 10 minutos).

create function public.admin_export_people(p_aba text, p_q text, p_filter text, p_master boolean, cap int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  header text; body text; total bigint := 0; filt jsonb := '{}'::jsonb;
  pat text := case when p_q is null then null else '%' || replace(replace(replace(p_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
  idpat text := case when p_q is null then null else replace(replace(replace(lower(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
begin
  if p_aba = 'contas' then
    if p_filter is not null and p_filter not in ('equipe', 'google', 'email', 'convidados') then raise exception 'invalid' using errcode = 'MM005'; end if;
    if p_filter is not null then filt := jsonb_build_object('f', p_filter); end if;
    header := public.csv_line('"conta_id"', '"tipo"', '"email"', '"criado_em"', '"ultimo_acesso_em"', '"papel"');
    with b as (
      select u.id, u.email, u.created_at, u.last_sign_in_at, pr.display_name, coalesce(u.is_anonymous, false) as anon,
             coalesce(u.raw_app_meta_data ->> 'provider', 'anonymous') as provider,
             (select r.role from public.platform_roles r where r.user_id = u.id and r.revoked_at is null
               order by case r.role when 'master' then 0 when 'support' then 1 else 2 end limit 1) as role
        from auth.users u left join public.profiles pr on pr.id = u.id where not coalesce(pr.is_test, false)
    ), x as (
      select b.*, row_number() over (order by b.created_at desc, b.id) as rn from b
       where (p_filter is null or (p_filter = 'equipe' and b.role is not null) or (p_filter = 'google' and not b.anon and b.provider = 'google')
              or (p_filter = 'email' and not b.anon and b.provider = 'email') or (p_filter = 'convidados' and b.anon))
         and (p_q is null or b.id::text like idpat or b.display_name ilike pat or (p_master and b.email ilike pat))
       limit cap + 1
    )
    select string_agg(public.csv_line(public.csv_cell(x.id::text), public.csv_cell(case when x.anon then 'Convidado' when x.provider = 'google' then 'Google' when x.provider = 'email' then 'E-mail' else x.provider end),
             public.csv_cell(case when p_master then x.email else regexp_replace(x.email, '^(.).*(@.*)$', '\1***\2') end),
             public.csv_ts(x.created_at), public.csv_ts(x.last_sign_in_at), public.csv_cell(x.role)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;

  elsif p_aba = 'organizadores' then
    header := public.csv_line('"nome"', '"email"', '"entrou_com"', '"eventos"', '"ativos"', '"fotos"', '"ultimo_evento_em"', '"gasto_total_centavos"', '"exclusao_pedida"');
    with org as (
      select e.host_id, count(*) as events_count, count(*) filter (where now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)) as active_events,
             max(e.created_at) as last_event_at
        from public.events e where e.deleted_at is null group by e.host_id
    ), x as (
      select o.*, pr.display_name, u.email, coalesce(u.raw_app_meta_data ->> 'provider', 'anonymous') as provider,
             row_number() over (order by o.last_event_at desc, o.host_id) as rn
        from org o join public.profiles pr on pr.id = o.host_id left join auth.users u on u.id = o.host_id
       where p_q is null or pr.display_name ilike pat or (p_master and u.email ilike pat)
       limit cap + 1
    )
    select string_agg(public.csv_line(public.csv_cell(x.display_name),
             public.csv_cell(case when p_master then x.email else regexp_replace(x.email, '^(.).*(@.*)$', '\1***\2') end),
             public.csv_cell(case x.provider when 'google' then 'Google' when 'email' then 'E-mail' else 'Convidado' end),
             x.events_count::text, x.active_events::text,
             (select count(*) from public.photos ph join public.events e on e.id = ph.event_id
               where e.host_id = x.host_id and e.deleted_at is null and ph.upload_status = 'pronta' and ph.deleted_at is null)::text,
             public.csv_ts(x.last_event_at),
             case when p_master then coalesce((select sum(po.amount_cents) from public.payment_orders po where po.host_id = x.host_id and po.status = 'pago'), 0)::text else '' end,
             case when exists (select 1 from public.account_deletion_requests d where d.user_id = x.host_id and d.processed_at is null) then 'sim' else 'não' end),
           E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;

  elsif p_aba = 'convidados' then
    if p_filter is not null and p_filter not in ('ativos', 'bloqueados', 'organizadores') then raise exception 'invalid' using errcode = 'MM005'; end if;
    if p_filter is not null then filt := jsonb_build_object('f', p_filter); end if;
    header := public.csv_line('"nome"', '"evento"', '"entrou_em"', '"fotos"', '"situacao"');
    with b as (
      select p.event_id, p.user_id, p.name, e.title, p.joined_at,
             case when p.blocked_at is not null then 'bloqueado' when p.user_id = e.host_id then 'organizador' else 'ativo' end as situation
        from public.participants p join public.events e on e.id = p.event_id
    ), x as (
      select b.*, row_number() over (order by b.joined_at desc, b.event_id, b.user_id) as rn from b
       where (p_q is null or strpos(lower(b.name), lower(p_q)) > 0 or strpos(lower(b.title), lower(p_q)) > 0)
         and (p_filter is null or (p_filter = 'ativos' and b.situation = 'ativo') or (p_filter = 'bloqueados' and b.situation = 'bloqueado')
              or (p_filter = 'organizadores' and b.situation = 'organizador'))
       limit cap + 1
    )
    select string_agg(public.csv_line(public.csv_cell(x.name), public.csv_cell(x.title), public.csv_ts(x.joined_at),
             (select count(*) from public.photos ph where ph.event_id = x.event_id and ph.author_id = x.user_id and ph.upload_status = 'pronta' and ph.deleted_at is null)::text,
             public.csv_cell(x.situation)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;

  elsif p_aba = 'convites' then
    if p_filter is not null and p_filter not in ('ativos', 'expirados', 'esgotados', 'revogados') then raise exception 'invalid' using errcode = 'MM005'; end if;
    if p_filter is not null then filt := jsonb_build_object('f', p_filter); end if;
    header := public.csv_line('"evento"', '"rotulo"', '"usos"', '"limite_de_usos"', '"expira_em"', '"estado"', '"criado_em"');
    with b as (
      select i.id, e.title, i.label, i.uses, i.max_uses, i.expires_at, i.created_at,
             case when i.revoked_at is not null then 'revogado' when i.expires_at <= now() then 'expirado'
                  when i.max_uses is not null and i.uses >= i.max_uses then 'esgotado' else 'ativo' end as state
        from public.invitations i join public.events e on e.id = i.event_id
    ), x as (
      select b.*, row_number() over (order by b.created_at desc, b.id) as rn from b
       where (p_q is null or strpos(lower(b.label), lower(p_q)) > 0 or strpos(lower(b.title), lower(p_q)) > 0)
         and (p_filter is null or (p_filter = 'ativos' and b.state = 'ativo') or (p_filter = 'expirados' and b.state = 'expirado')
              or (p_filter = 'esgotados' and b.state = 'esgotado') or (p_filter = 'revogados' and b.state = 'revogado'))
       limit cap + 1
    )
    select string_agg(public.csv_line(public.csv_cell(x.title), public.csv_cell(x.label), x.uses::text, coalesce(x.max_uses::text, ''),
             public.csv_ts(x.expires_at), public.csv_cell(x.state), public.csv_ts(x.created_at)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;

  else -- equipe
    header := public.csv_line('"email"', '"papel"', '"desde"');
    with x as (
      select r.role, r.granted_at, u.email, row_number() over (order by r.granted_at, r.id) as rn
        from public.platform_roles r join auth.users u on u.id = r.user_id where r.revoked_at is null
       limit cap + 1
    )
    select string_agg(public.csv_line(public.csv_cell(case when p_master then x.email else regexp_replace(x.email, '^(.).*(@.*)$', '\1***\2') end),
             public.csv_cell(x.role), public.csv_ts(x.granted_at)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;
  end if;
  return jsonb_build_object('header', header, 'body', body, 'total', total, 'filters', filt);
end $$;

revoke all on function public.admin_export_people(text, text, text, boolean, int) from public, anon, authenticated;

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
  q text; pat text; flt text; aba text; dias int; role text; clean jsonb := '{}'::jsonb; ov jsonb; px jsonb;
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
    if aba not in ('contas', 'organizadores', 'convidados', 'convites', 'equipe') then raise exception 'invalid' using errcode = 'MM005'; end if;
    px := public.admin_export_people(aba, q, nullif(f ->> 'f', ''), master, cap);
    header := px ->> 'header'; body := px ->> 'body'; total := (px ->> 'total')::bigint;
    clean := clean || jsonb_build_object('aba', aba) || coalesce(px -> 'filters', '{}'::jsonb);
    if aba = 'equipe' then clean := clean - 'q'; end if;

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
