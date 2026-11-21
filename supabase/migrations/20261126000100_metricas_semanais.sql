-- Consulta semanal de conversão (Master e bot pelo MCP): por semana de criação do evento (fuso de Cuiabá, semana começa na segunda).
-- Números: anfitriões com avisos no WhatsApp, ativação (evento com ≥1 convidado), eventos no limite do grátis, ofertas de desconto
-- (criadas, abertas = pedido aberto com a oferta, pagas), conversão grátis → pago e expiração de pedidos. Sem equipe, teste e contas
-- do dono (metrics_counts_host). Somente leitura (STABLE).

create function public.admin_conversion_weekly(p_weeks int default 8) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  w int := least(greatest(coalesce(p_weeks, 8), 1), 52);
  tz constant text := 'America/Cuiaba';
  first_week date := (date_trunc('week', now() at time zone tz) - make_interval(weeks => w - 1))::date;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return (
    with weeks as (
      select g::date as week from generate_series(first_week, (now() at time zone tz)::date, interval '7 days') g
    ), ev as (
      select e.id, e.host_id, date_trunc('week', e.created_at at time zone tz)::date as week,
             exists (select 1 from public.participants p where p.event_id = e.id and p.user_id <> e.host_id) as activated,
             exists (select 1 from public.upgrade_offers o where o.event_id = e.id) or public.event_near_free_limit(e.id) as at_limit,
             exists (select 1 from public.payment_orders o where o.event_id = e.id and o.status = 'pago' and o.provider_env = 'production') as paid
      from public.events e
      where e.created_at at time zone tz >= first_week and e.deleted_at is null and not e.is_test and public.metrics_counts_host(e.host_id)
    ), offers as (
      select date_trunc('week', o.created_at at time zone tz)::date as week, o.id, o.redeemed_at,
             exists (select 1 from public.payment_orders po where po.offer_id = o.id) as opened
      from public.upgrade_offers o join public.events e on e.id = o.event_id
      where o.created_at at time zone tz >= first_week and not e.is_test and public.metrics_counts_host(e.host_id)
    ), orders as (
      select date_trunc('week', o.created_at at time zone tz)::date as week, o.status
      from public.payment_orders o
      where o.provider_env = 'production' and o.created_at at time zone tz >= first_week and public.metrics_counts_host(o.host_id)
    )
    select jsonb_build_object('weeks', w, 'generatedAt', now(), 'rows', coalesce(jsonb_agg(jsonb_build_object(
      'week', wk.week,
      'events', (select count(*) from ev where ev.week = wk.week),
      'activated', (select count(*) from ev where ev.week = wk.week and ev.activated),
      'hosts', (select count(distinct host_id) from ev where ev.week = wk.week),
      'hostsWhatsapp', (select count(distinct ev.host_id) from ev join public.host_whatsapp h on h.user_id = ev.host_id and h.whatsapp_optin where ev.week = wk.week),
      'atLimit', (select count(*) from ev where ev.week = wk.week and ev.at_limit),
      'offersCreated', (select count(*) from offers where offers.week = wk.week),
      'offersOpened', (select count(*) from offers where offers.week = wk.week and offers.opened),
      'offersPaid', (select count(*) from offers where offers.week = wk.week and offers.redeemed_at is not null),
      'paid', (select count(*) from ev where ev.week = wk.week and ev.paid),
      'orders', (select count(*) from orders where orders.week = wk.week),
      'ordersExpired', (select count(*) from orders where orders.week = wk.week and orders.status = 'expirado')
    ) order by wk.week desc), '[]'::jsonb))
    from weeks wk
  );
end $$;
revoke all on function public.admin_conversion_weekly(int) from public, anon;
grant execute on function public.admin_conversion_weekly(int) to authenticated;

-- ---------------------------------------------------------------- MCP do bot: conversao_semanal e conversao_origem (somente leitura)
create or replace function public.mcp_read_functions() returns text[]
language sql immutable set search_path = '' as $$
  select array['admin_overview', 'admin_dashboard_metrics', 'admin_access_stats', 'admin_events_board', 'admin_event_detail',
    'admin_list_events', 'admin_people_counts', 'admin_list_organizers', 'admin_list_users', 'admin_search_users',
    'admin_list_participants', 'admin_search_participants_v2', 'admin_list_invites', 'admin_list_team', 'admin_list_payments',
    'admin_payments_summary', 'admin_payment_divergences', 'admin_moderation_queue', 'admin_reveals_board', 'admin_list_reveals',
    'admin_health', 'admin_health_history', 'admin_storage_breakdown', 'admin_list_audit', 'admin_audit_events',
    'admin_lgpd_requests', 'admin_print_orders', 'admin_print_order_detail', 'admin_list_plans', 'admin_config_overview',
    'admin_search', 'admin_conversion_weekly', 'admin_conversion_by_origin']
$$;


create or replace function public.mcp_tools() returns text[]
language sql immutable set search_path = '' as $$
  select array['visao_geral', 'metricas', 'acessos', 'eventos', 'evento_detalhe', 'eventos_lista', 'pessoas_contagens', 'organizadores', 'usuarios', 'buscar_usuarios', 'participantes', 'buscar_participantes', 'convites', 'equipe', 'pagamentos', 'pagamentos_resumo', 'pagamentos_divergencias', 'moderacao_fila', 'revelacoes', 'revelacoes_lista', 'saude', 'saude_historico', 'armazenamento', 'auditoria', 'auditoria_eventos', 'lgpd', 'impressoes', 'impressao_detalhe', 'planos', 'configuracoes', 'buscar', 'conversao_semanal', 'conversao_origem']
$$;


create or replace function public.mcp_read(p_token text, p_tool text, p_args jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid;
  a jsonb := coalesce(p_args, '{}');
  lim int := least(greatest(coalesce((a ->> 'limite')::int, 25), 1), 200);
  off int := greatest(coalesce((a ->> 'deslocamento')::int, 0), 0);
  q text := nullif(btrim(coalesce(a ->> 'texto', '')), '');
begin
  select t.actor_id into actor from public.mcp_tokens t
  where t.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and t.revoked_at is null;
  if actor is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_tool is null or not (p_tool = any (public.mcp_tools())) then raise exception 'unknowntool' using errcode = 'MM005'; end if;

  -- daqui em diante, nada escreve: nem esta função nem as que ela chama
  perform set_config('transaction_read_only', 'on', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated', 'aal', 'aal2',
    'is_anonymous', false, 'app_metadata', jsonb_build_object('role', 'master'))::text, true);

  return case p_tool
    when 'visao_geral' then public.admin_overview(coalesce((a ->> 'dias')::int, 30), coalesce((a ->> 'incluir_testes')::boolean, false))
    when 'metricas' then public.admin_dashboard_metrics(coalesce((a ->> 'de')::timestamptz, now() - interval '30 days'),
      coalesce((a ->> 'ate')::timestamptz, now()), coalesce(a ->> 'fuso', 'America/Cuiaba'), coalesce((a ->> 'incluir_testes')::boolean, false))
    when 'acessos' then public.admin_access_stats(coalesce((a ->> 'dias')::int, 30))
    when 'eventos' then public.admin_events_board(a ->> 'filtro', q, lim, off)
    when 'evento_detalhe' then public.admin_event_detail((a ->> 'evento_id')::uuid)
    when 'eventos_lista' then public.admin_list_events(lim, off, q, a ->> 'status', coalesce((a ->> 'incluir_apagados')::boolean, false))
    when 'pessoas_contagens' then public.admin_people_counts()
    when 'organizadores' then public.admin_list_organizers(lim, off, q)
    when 'usuarios' then public.admin_list_users(lim, off)
    when 'buscar_usuarios' then public.admin_search_users(lim, off, q)
    when 'participantes' then public.admin_list_participants((a ->> 'evento_id')::uuid, lim, off)
    when 'buscar_participantes' then public.admin_search_participants_v2(lim, off, q, a ->> 'situacao')
    when 'convites' then public.admin_list_invites((a ->> 'evento_id')::uuid, lim, off)
    when 'equipe' then public.admin_list_team()
    when 'pagamentos' then (select coalesce(jsonb_agg(x), '[]') from public.admin_list_payments(a ->> 'status', lim) x)
    when 'pagamentos_resumo' then public.admin_payments_summary()
    when 'pagamentos_divergencias' then (select coalesce(jsonb_agg(x), '[]') from public.admin_payment_divergences() x)
    when 'moderacao_fila' then public.admin_moderation_queue()
    when 'revelacoes' then public.admin_reveals_board(lim)
    when 'revelacoes_lista' then public.admin_list_reveals(lim, off, q)
    when 'saude' then public.admin_health()
    when 'saude_historico' then public.admin_health_history(lim)
    when 'armazenamento' then public.admin_storage_breakdown()
    when 'auditoria' then public.admin_list_audit(lim, off, a ->> 'acao')
    when 'auditoria_eventos' then public.admin_audit_events(lim)
    when 'lgpd' then public.admin_lgpd_requests(lim, off)
    when 'impressoes' then public.admin_print_orders(a ->> 'filtro', q, lim, off)
    when 'impressao_detalhe' then public.admin_print_order_detail((a ->> 'pedido_id')::uuid)
    when 'planos' then (select coalesce(jsonb_agg(x), '[]') from public.admin_list_plans() x)
    when 'configuracoes' then public.admin_config_overview()
    when 'buscar' then public.admin_search(coalesce(q, ''))
    when 'conversao_semanal' then public.admin_conversion_weekly(coalesce((a ->> 'semanas')::int, 8))
    when 'conversao_origem' then public.admin_conversion_by_origin(coalesce((a ->> 'dias')::int, 30))
  end;
end $$;
revoke all on function public.mcp_read(text, text, jsonb) from public;
grant execute on function public.mcp_read(text, text, jsonb) to anon, authenticated, service_role;
