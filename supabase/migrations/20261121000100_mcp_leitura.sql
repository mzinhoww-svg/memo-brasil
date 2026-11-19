-- MCP somente leitura para o bot do dono (design docs/superpowers/specs/2026-11-19-mcp-leitura-design.md).
-- O app (/api/mcp) só repassa o token; quem decide é o banco:
--   * mcp_tokens guarda só o SHA-256 do token (o token em claro aparece uma vez, em mcp_issue_token);
--   * mcp_read confere o token, liga transaction_read_only (QUALQUER escrita, em qualquer função chamada, é recusada pelo Postgres),
--     assume a identidade do bot só dentro desta transação e despacha para uma lista FECHADA de funções admin_* de leitura (STABLE);
--   * o bot é um usuário sem senha (não entra no app) com papel master, porque a visão geral, pagamentos, moderação e o detalhe de
--     evento exigem master. Fora da lista: códigos de cortesia (credenciais), exportações e tudo que escreve.

-- ---------------------------------------------------------------- tokens
create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 60),
  token_hash text not null unique,
  actor_id uuid not null references auth.users on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.mcp_tokens enable row level security; -- sem policies: nenhum cliente lê ou escreve
revoke all on public.mcp_tokens from public, anon, authenticated;

-- ---------------------------------------------------------------- lista fechada (ferramenta → função)
create or replace function public.mcp_read_functions() returns text[]
language sql immutable set search_path = '' as $$
  select array['admin_overview', 'admin_dashboard_metrics', 'admin_access_stats', 'admin_events_board', 'admin_event_detail',
    'admin_list_events', 'admin_people_counts', 'admin_list_organizers', 'admin_list_users', 'admin_search_users',
    'admin_list_participants', 'admin_search_participants_v2', 'admin_list_invites', 'admin_list_team', 'admin_list_payments',
    'admin_payments_summary', 'admin_payment_divergences', 'admin_moderation_queue', 'admin_reveals_board', 'admin_list_reveals',
    'admin_health', 'admin_health_history', 'admin_storage_breakdown', 'admin_list_audit', 'admin_audit_events',
    'admin_lgpd_requests', 'admin_print_orders', 'admin_print_order_detail', 'admin_list_plans', 'admin_config_overview',
    'admin_search']
$$;

-- nomes das ferramentas (o app lista as mesmas; teste em web/src/features/mcp/tools.test.ts)
create or replace function public.mcp_tools() returns text[]
language sql immutable set search_path = '' as $$
  select array['visao_geral', 'metricas', 'acessos', 'eventos', 'evento_detalhe', 'eventos_lista', 'pessoas_contagens', 'organizadores', 'usuarios', 'buscar_usuarios', 'participantes', 'buscar_participantes', 'convites', 'equipe', 'pagamentos', 'pagamentos_resumo', 'pagamentos_divergencias', 'moderacao_fila', 'revelacoes', 'revelacoes_lista', 'saude', 'saude_historico', 'armazenamento', 'auditoria', 'auditoria_eventos', 'lgpd', 'impressoes', 'impressao_detalhe', 'planos', 'configuracoes', 'buscar']
$$;

-- ---------------------------------------------------------------- entrada única do bot
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
  end;
end $$;
revoke all on function public.mcp_read(text, text, jsonb) from public;
grant execute on function public.mcp_read(text, text, jsonb) to anon, authenticated, service_role;
revoke all on function public.mcp_read_functions(), public.mcp_tools() from public;
grant execute on function public.mcp_read_functions(), public.mcp_tools() to authenticated, service_role;

-- ---------------------------------------------------------------- operador (SQL editor do Supabase): emitir e revogar
-- identidade do bot (sem senha: não há como entrar com ela), criada só na primeira emissão de token, para não aparecer em bases
-- que nunca usaram o MCP (testes, ambientes de prévia)
create or replace function public.mcp_ensure_bot() returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare bot constant uuid := '00000000-0000-4000-8000-00000000b07a';
begin
  insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (bot, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mcp-bot@fotosdocasamento.online', false,
          '{"role": "master", "mcp": true}', '{"name": "Bot MCP (somente leitura)"}', now(), now())
  on conflict (id) do nothing;
  insert into public.profiles (id) values (bot) on conflict do nothing;
  if not exists (select 1 from public.platform_roles where user_id = bot and role = 'master' and revoked_at is null) then
    perform set_config('mm.audit_reason', 'Bot MCP somente leitura: identidade usada só por mcp_read, sem senha', true);
    insert into public.platform_roles (user_id, role) values (bot, 'master');
  end if;
  return bot;
end $$;

create or replace function public.mcp_issue_token(p_name text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare tok text := 'mcp_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into public.mcp_tokens (name, token_hash, actor_id)
  values (btrim(p_name), encode(extensions.digest(tok, 'sha256'), 'hex'), public.mcp_ensure_bot());
  return tok; -- única vez em que o token aparece em claro
end $$;
create or replace function public.mcp_revoke_token(p_name text) returns boolean
language sql volatile security definer set search_path = '' as $$
  update public.mcp_tokens set revoked_at = now() where name = btrim(p_name) and revoked_at is null returning true
$$;
revoke all on function public.mcp_issue_token(text), public.mcp_revoke_token(text), public.mcp_ensure_bot() from public, anon, authenticated, service_role;
