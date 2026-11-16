-- Endurecimento dos limites de tentativas e do preço do catálogo (achados S2, S3, S4, S6, S7, S8 da auditoria). ADITIVA.
--
-- S7 · check_rate_limit nascia com hits = 0: a primeira chamada de cada janela passava "de graça" (N+1 por janela) e, passada a
--      janela, o reset gravava hits = 1 > 0, de modo que um limite 0 (admin_request_reconcile) só funcionava UMA vez na vida.
--      Agora a linha nasce com hits = 1 (N chamadas por janela) e o reconcile usa limite 1 por minuto.
-- S2 · join_event contava a tentativa e em seguida dava `raise` na mesma transação: o rollback desfazia o contador e adivinhar
--      código de evento/convite ficava sem limite. Agora esses caminhos DEVOLVEM {error} (o contador persiste) e o cliente converte.
-- S3 · peek_code era stable, aberta a anon e sem limite: um oráculo de códigos de cortesia. Agora é volatile, conta tentativas por
--      origem (cabeçalho do gateway) e devolve status 'muitas_tentativas' sem `raise`.
-- S6 · descadastro de e-mail sem sessão usava um balde global ('anon'): qualquer pessoa bloqueava todos. Agora o balde é o token.
-- S4 · admin_set_plan muda preço sem segundo fator; passa a exigir aal2 (MM016), como admin_publish_plans.
-- S8 · o organizador deixa de ler, na trilha do próprio evento, as ações da equipe da plataforma (motivo, detalhe, autor).

create or replace function public.check_rate_limit(p_key text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.rate_limits;
begin
  insert into public.rate_limits as t (key, hits) values (p_key, 1)
  on conflict (key) do update
    set window_start = case when t.window_start < now() - p_window then now() else t.window_start end,
        hits = case when t.window_start < now() - p_window then 1 else t.hits + 1 end
  returning * into r;
  if r.hits > p_max then
    raise exception 'ratelimited' using errcode = 'MM006';
  end if;
end $$;

-- Versão que NÃO levanta erro: conta a tentativa e diz se passou do limite. Serve a quem precisa que o contador sobreviva
-- (um `raise` na mesma transação desfaria o incremento).
create function public.rate_limit_exceeded(p_key text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = '' as $$
declare r public.rate_limits;
begin
  insert into public.rate_limits as t (key, hits) values (p_key, 1)
  on conflict (key) do update
    set window_start = case when t.window_start < now() - p_window then now() else t.window_start end,
        hits = case when t.window_start < now() - p_window then 1 else t.hits + 1 end
  returning * into r;
  return r.hits > p_max;
end $$;

-- Só olha (não conta): a chave já estourou o limite dentro da janela?
create function public.rate_limit_blocked(p_key text, p_max int, p_window interval) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select hits >= p_max and window_start >= now() - p_window from public.rate_limits where key = p_key), false)
$$;
revoke all on function public.rate_limit_exceeded(text, int, interval), public.rate_limit_blocked(text, int, interval) from public, anon, authenticated, service_role;

-- S7 · conciliação manual: no máximo uma por minuto (limite 1; com a linha nascendo em 1 o limite 0 nunca mais passaria).
create or replace function public.admin_request_reconcile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then raise exception 'stepup' using errcode = 'MM016'; end if;
  perform public.check_rate_limit('reconcile:' || uid, 1, interval '1 minute');
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, detail)
  values (uid, 'master', 'payments.reconcile_requested', 'payments', 'validapay', '{}');
  return jsonb_build_object('requestedAt', now());
end $$;

-- S2 · join_event: tentativas inválidas persistem no contador e a função devolve {error} em vez de `raise`.
create or replace function public.join_event(p_code text, p_name text, p_table text default null, p_token text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  e public.events;
  inv public.invitations;
  existing public.participants;
  clean text := btrim(coalesce(p_name, ''));
  n int;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform public.check_rate_limit('join:' || uid, 20, interval '10 minutes');
  if clean = '' or char_length(clean) > 40 then raise exception 'invalid' using errcode = 'MM005'; end if;

  select * into e from public.events where code = upper(btrim(p_code)) and deleted_at is null for update;
  if not found then
    -- tentativa de adivinhar código: devolve (não levanta) para o contador persistir
    if public.rate_limit_exceeded('badcode:' || uid, 8, interval '10 minutes') then return jsonb_build_object('error', 'MM006'); end if;
    return jsonb_build_object('error', 'MM005');
  end if;
  if e.host_id = uid then return jsonb_build_object('role', 'organizador', 'eventId', e.id); end if;

  select * into existing from public.participants where event_id = e.id and user_id = uid for update;
  if found then
    if existing.blocked_at is not null then raise exception 'blocked' using errcode = 'MM015'; end if;
    update public.participants set name = clean, table_label = coalesce(p_table, table_label) where event_id = e.id and user_id = uid;
    return jsonb_build_object('role', 'membro', 'eventId', e.id);
  end if;

  if now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then raise exception 'eventended' using errcode = 'MM002'; end if;
  if e.capacity is not null then
    select count(*) into n from public.participants where event_id = e.id; -- serializado pelo FOR UPDATE do evento
    if n >= e.capacity + public.capacity_grace_slots(e.capacity) then
      raise exception 'capacityfull' using errcode = 'MM003';
    end if;
  end if;

  if p_token is not null then
    select * into inv from public.invitations
      where event_id = e.id and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
    if not found or inv.revoked_at is not null or (inv.expires_at is not null and inv.expires_at < now())
       or (inv.max_uses is not null and inv.uses >= inv.max_uses) then
      if public.rate_limit_exceeded('badinvite:' || uid, 8, interval '10 minutes') then return jsonb_build_object('error', 'MM006'); end if;
      return jsonb_build_object('error', 'MM007');
    end if;
    update public.invitations set uses = uses + 1 where id = inv.id;
  end if;

  insert into public.participants (event_id, user_id, name, table_label, invitation_id)
  values (e.id, uid, clean, coalesce(p_table, inv.label), inv.id);
  perform public.audit(e.id, 'participant.joined', jsonb_build_object('user', uid, 'invitation', inv.id));
  if e.capacity is not null and n + 1 > e.capacity then
    perform public.audit(e.id, 'capacity.grace_used', jsonb_build_object('count', n + 1));
  end if;
  return jsonb_build_object('role', 'membro', 'eventId', e.id);
end $$;

-- S3 · peek_code com limite. Sem sessão a origem vem do cabeçalho do gateway; sem ele, um balde único ('anon').
create or replace function public.peek_code(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.courtesy_codes;
  pl public.plans;
  hdr json := nullif(coalesce(current_setting('request.headers', true), ''), '')::json;
  k text := left(coalesce(split_part(hdr ->> 'x-forwarded-for', ',', 1), hdr ->> 'cf-connecting-ip', 'anon'), 64);
begin
  if public.rate_limit_exceeded('peek:' || k, 30, interval '10 minutes')
     or public.rate_limit_blocked('peekbad:' || k, 10, interval '10 minutes')
     or public.rate_limit_blocked('peekbad:*', 300, interval '10 minutes') then
    return jsonb_build_object('status', 'muitas_tentativas');
  end if;
  select * into c from public.courtesy_codes where code_hash = public.courtesy_code_hash(p_code);
  if not found then
    perform public.rate_limit_exceeded('peekbad:' || k, 10, interval '10 minutes');
    perform public.rate_limit_exceeded('peekbad:*', 300, interval '10 minutes');
    return jsonb_build_object('status', 'invalido');
  end if;
  select * into pl from public.plans where code = c.plan_code;
  return jsonb_build_object(
    'status', case when c.revoked_at is not null then 'revogado'
                   when c.uses >= c.max_uses then 'usado'
                   when c.expires_at <= now() then 'expirado'
                   else 'ativo' end,
    'planCode', c.plan_code, 'planName', pl.name, 'maxGuests', pl.max_guests, 'maxShots', pl.max_shots,
    'expiresAt', c.expires_at);
end $$;
revoke execute on function public.peek_code(text) from public, anon, authenticated, service_role;
grant execute on function public.peek_code(text) to anon, authenticated;

-- S6 · descadastro de e-mail: o balde é o token do link (UUID imprevisível), não 'anon'.
create or replace function public.email_opt_out_preview(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  perform public.check_rate_limit('optoutview:' || p_token, 300, interval '1 hour');
  select pe.email, pe.opt_out_at, e.title, e.code into r
    from public.participant_emails pe join public.events e on e.id = pe.event_id
   where pe.optout_token = p_token and e.deleted_at is null;
  if not found then return null; end if;
  return jsonb_build_object('title', r.title, 'code', r.code, 'email', r.email, 'optedOut', r.opt_out_at is not null);
end $$;
create or replace function public.email_resubscribe(p_token uuid, p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare em text := lower(btrim(coalesce(p_email, '')));
begin
  perform public.check_rate_limit('optin:' || p_token, 60, interval '1 hour');
  if char_length(em) > 254 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.participant_emails set email = em, consent_at = now(), opt_out_at = null
   where optout_token = p_token and opt_out_at is not null;
  return found;
end $$;
create or replace function public.email_opt_out(p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_rate_limit('optout:' || p_token, 60, interval '1 hour');
  update public.participant_emails set opt_out_at = coalesce(opt_out_at, now()), email = null, consent_at = null
   where optout_token = p_token;
  return found;
end $$;

-- S4 · preço do catálogo exige segundo fator.
create or replace function public.admin_set_plan(p_code text, p_price_cents int, p_sandbox_active boolean, p_production_active boolean,
                                      p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare why text; pl public.plans;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then raise exception 'stepup' using errcode = 'MM016'; end if;
  why := public.admin_reason(p_reason);
  if p_price_cents is null or p_sandbox_active is null or p_production_active is null then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  select * into pl from public.plans where code = p_code for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  if pl.is_free then
    if p_price_cents <> pl.price_cents or p_sandbox_active <> pl.sandbox_active or p_production_active <> pl.production_active then
      raise exception 'invalid' using errcode = 'MM005';
    end if;
  elsif p_price_cents < 100 or p_price_cents > 10000000 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  update public.plans set price_cents = p_price_cents, sandbox_active = p_sandbox_active, production_active = p_production_active
   where code = pl.code;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', 'plan.updated', 'plan', pl.code, why, jsonb_build_object(
    'old', jsonb_build_object('priceCents', pl.price_cents, 'sandboxActive', pl.sandbox_active, 'productionActive', pl.production_active),
    'new', jsonb_build_object('priceCents', p_price_cents, 'sandboxActive', p_sandbox_active, 'productionActive', p_production_active)));
end $$;

-- Todos os planos (ativos ou não), com updated_at e as 10 últimas alterações auditadas de cada um (M2).
create or replace function public.admin_list_plans() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return query
    select jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'sandboxActive', p.sandbox_active, 'productionActive', p.production_active,
      'features', p.features, 'updatedAt', p.updated_at,
      'history', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'actorId', a.actor_id, 'actorRole', a.actor_role,
                                                               'reason', a.reason, 'old', a.detail -> 'old', 'new', a.detail -> 'new')
                                            order by a.at desc, a.id desc), '[]')
                    from (select * from public.audit_logs l
                           where l.target_type = 'plan' and l.target_id = p.code and l.action = 'plan.updated'
                           order by l.at desc, l.id desc limit 10) a))
    from public.plans p
    order by p.sort, p.code;
end $$;

-- ---------------------------------------------------------------- públicas
-- Allowlist fixa (Ruling 1 inclui capacity_grace_pct, número, normalizado como em capacity_grace_slots: 0 a 100).
create or replace function public.get_public_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'support_email', coalesce((select s.value from public.platform_settings s where s.key = 'support_email'), 'null'::jsonb),
    'support_phone', coalesce((select s.value from public.platform_settings s where s.key = 'support_phone'), 'null'::jsonb),
    'company_legal_name', coalesce((select s.value from public.platform_settings s where s.key = 'company_legal_name'), 'null'::jsonb),
    'company_cnpj', coalesce((select s.value from public.platform_settings s where s.key = 'company_cnpj'), 'null'::jsonb),
    'payments_env', public.payments_env(),
    'capacity_grace_pct', coalesce((select least(greatest((s.value #>> '{}')::numeric, 0), 100) from public.platform_settings s
                                     where s.key = 'capacity_grace_pct' and jsonb_typeof(s.value) = 'number'), 0))
$$;

-- S8 · o organizador não lê a ação da equipe da plataforma na trilha do próprio evento.
drop policy audit_host_select on public.audit_logs;
create policy audit_host_select on public.audit_logs for select to authenticated
  using ((public.is_host(event_id) and (actor_role is null or actor_role not in ('master', 'support', 'auditor', 'operador')))
         or public.is_master() or public.is_platform_role('auditor'));
