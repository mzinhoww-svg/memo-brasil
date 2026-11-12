-- Revela 2.0 · Master: Pessoas (M15 a M19). ADITIVA (funções novas; create or replace só com a MESMA assinatura e campos a mais no JSON).
--
-- admin_people_counts()                  contagem das cinco abas (Contas, Organizadores, Convidados, Convites, Equipe). Qualquer papel de equipe.
-- admin_list_users_v2 (substituída)      + filtro p_kind = 'team' (contas com papel ativo), + summary.team e busca por INÍCIO do id (o desenho mostra 8 caracteres).
-- admin_list_organizers (substituída)    + provider (entrou com), spendCents (gasto total somado NO SERVIDOR, sem o limite de 500 pedidos; só master, nulo para os
--                                          demais papéis: Pagamentos é área do master), summary.deletionPending (selo LGPD). Os campos que já existiam seguem iguais.
-- admin_search_participants_v2            convidados: situação (ativos | bloqueados | organizadores), fotos prontas do participante e contagens por situação.
-- admin_search_invites_v2                 convites: estado (ativos | expirados | esgotados | revogados) e contagens. NUNCA devolve token nem hash.
-- admin_list_team()                       equipe: papel ativo, quem concedeu, quando, e se é o último master. SÓ master (MM004 para os demais).
-- admin_grant_platform_role_by_email      conceder pelo e-mail da conta (a pessoa já precisa ter conta no Revela). SÓ master. Motivo de 10 a 500 caracteres.
-- admin_grant_platform_role / admin_revoke_platform_role (substituídas) agora recusam motivo com MAIS de 500 caracteres (antes só conferiam o mínimo de 10);
--                                          a revogação do master é serializada (lock) para que duas revogações ao mesmo tempo nunca deixem a plataforma sem master.
-- Erros: MM004 forbidden · MM005 invalid | notfound | duplicate · MM009 último master · MM011 reasonrequired (motivo fora de 10 a 500).

-- ---------------------------------------------------------------- contagem das abas
create function public.admin_people_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return jsonb_build_object(
    'accounts', (select count(*) from auth.users u left join public.profiles pr on pr.id = u.id where not coalesce(pr.is_test, false)),
    'organizers', (select count(*) from (select e.host_id from public.events e where e.deleted_at is null group by e.host_id) o
                    join public.profiles pr on pr.id = o.host_id),
    'guests', (select count(*) from public.participants p join public.events e on e.id = p.event_id),
    'invites', (select count(*) from public.invitations i join public.events e on e.id = i.event_id),
    'team', (select count(distinct r.user_id) from public.platform_roles r where r.revoked_at is null));
end $$;

-- ---------------------------------------------------------------- contas (admin_list_users_v2 com 'team' e busca por início do id)
create or replace function public.admin_list_users_v2(p_limit int default 50, p_offset int default 0, p_kind text default null,
                                                      p_include_tests boolean default false, p_search text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
        inc boolean := coalesce(p_include_tests, false); master boolean := public.is_master();
        q text := nullif(left(btrim(coalesce(p_search, '')), 80), '');
        pat text; idpat text; total bigint; items jsonb; summary jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_kind is not null and p_kind not in ('google', 'email', 'anon', 'team') then raise exception 'invalid' using errcode = 'MM005'; end if;
  pat := case when q is null then null else '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
  idpat := case when q is null then null else replace(replace(replace(lower(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  with base as (
    select u.id, u.created_at, coalesce(u.is_anonymous, false) as anon, coalesce(u.raw_app_meta_data ->> 'provider', 'anonymous') as provider,
           u.email, u.last_sign_in_at, pr.display_name, coalesce(pr.is_test, false) as is_test,
           coalesce(u.is_anonymous, false) and not exists (select 1 from public.participants p where p.user_id = u.id) as orphan,
           exists (select 1 from public.platform_roles r where r.user_id = u.id and r.revoked_at is null) as team
      from auth.users u left join public.profiles pr on pr.id = u.id
     where inc or not coalesce(pr.is_test, false)
  ), f as (
    select * from base b
     where (p_kind is null or (p_kind = 'anon' and b.anon) or (p_kind = 'google' and not b.anon and b.provider = 'google')
            or (p_kind = 'email' and not b.anon and b.provider = 'email') or (p_kind = 'team' and b.team))
       and (q is null or b.id::text like idpat or b.display_name ilike pat or (master and b.email ilike pat))
  )
  select (select count(*) from f),
         (select jsonb_build_object('google', count(*) filter (where not anon and provider = 'google'),
                                    'email', count(*) filter (where not anon and provider = 'email'),
                                    'anon', count(*) filter (where anon), 'orphanAnon', count(*) filter (where orphan),
                                    'team', count(*) filter (where team)) from base),
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
end $$;

-- ---------------------------------------------------------------- organizadores (+ entrou com, gasto total, selo LGPD agregado)
create or replace function public.admin_list_organizers(p_limit int default 25, p_offset int default 0, p_search text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_search), '') is null then null
                         else '%' || replace(replace(replace(left(btrim(p_search), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
        full_pii boolean := public.is_master(); total bigint; items jsonb; pending bigint;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with org as (
    select e.host_id, count(*) as events_count,
           count(*) filter (where now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)) as active_events,
           min(e.created_at) as first_event_at, max(e.created_at) as last_event_at
    from public.events e where e.deleted_at is null group by e.host_id
  ), f as (
    select o.*, pr.display_name, u.email, coalesce(u.raw_app_meta_data ->> 'provider', 'anonymous') as provider,
           exists (select 1 from public.account_deletion_requests d where d.user_id = o.host_id and d.processed_at is null) as deletion
      from org o join public.profiles pr on pr.id = o.host_id left join auth.users u on u.id = o.host_id
     where pat is null or pr.display_name ilike pat or (full_pii and u.email ilike pat)
  )
  select (select count(*) from f), (select count(*) from f where deletion), coalesce(jsonb_agg(jsonb_build_object(
      'userId', p.host_id, 'displayName', p.display_name,
      'email', case when full_pii then p.email else regexp_replace(p.email, '^(.).*(@.*)$', '\1***\2') end,
      'provider', p.provider,
      'eventsCount', p.events_count, 'activeEvents', p.active_events, 'firstEventAt', p.first_event_at, 'lastEventAt', p.last_event_at,
      'photos', (select count(*) from public.photos ph join public.events e on e.id = ph.event_id
                 where e.host_id = p.host_id and e.deleted_at is null and ph.upload_status = 'pronta' and ph.deleted_at is null),
      'spendCents', case when full_pii then (select coalesce(sum(po.amount_cents), 0) from public.payment_orders po where po.host_id = p.host_id and po.status = 'pago') end,
      'deletionRequested', p.deletion)
    order by p.last_event_at desc, p.host_id), '[]')
  into total, pending, items
  from (select * from f order by last_event_at desc, host_id limit lim offset off) p;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items, 'summary', jsonb_build_object('deletionPending', pending));
end $$;

-- ---------------------------------------------------------------- convidados
create function public.admin_search_participants_v2(p_limit int default 25, p_offset int default 0, p_search text default null,
                                                    p_situation text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        term text := lower(left(nullif(btrim(p_search), ''), 80)); total bigint; items jsonb; summary jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_situation is not null and p_situation not in ('ativos', 'bloqueados', 'organizadores') then raise exception 'invalid' using errcode = 'MM005'; end if;
  with base as (
    select p.event_id, p.user_id, p.name, p.joined_at, e.title,
           case when p.blocked_at is not null then 'bloqueado' when p.user_id = e.host_id then 'organizador' else 'ativo' end as situation
      from public.participants p join public.events e on e.id = p.event_id
  ), f as (
    select * from base b
     where (term is null or strpos(lower(b.name), term) > 0 or strpos(lower(b.title), term) > 0)
       and (p_situation is null or (p_situation = 'ativos' and b.situation = 'ativo') or (p_situation = 'bloqueados' and b.situation = 'bloqueado')
            or (p_situation = 'organizadores' and b.situation = 'organizador'))
  ), page as (select * from f order by joined_at desc, event_id, user_id limit lim offset off)
  select (select count(*) from f),
         (select jsonb_build_object('total', count(*), 'ativos', count(*) filter (where situation = 'ativo'),
                                    'bloqueados', count(*) filter (where situation = 'bloqueado'), 'organizadores', count(*) filter (where situation = 'organizador')) from base),
         coalesce(jsonb_agg(jsonb_build_object(
    'eventId', p.event_id, 'eventTitle', p.title, 'name', p.name, 'joinedAt', p.joined_at, 'situation', p.situation,
    'photos', (select count(*) from public.photos ph where ph.event_id = p.event_id and ph.author_id = p.user_id and ph.upload_status = 'pronta' and ph.deleted_at is null)
  ) order by p.joined_at desc, p.event_id, p.user_id), '[]'::jsonb)
    into total, summary, items from page p;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items, 'summary', summary);
end $$;

-- ---------------------------------------------------------------- convites (sem token, sem hash)
create function public.admin_search_invites_v2(p_limit int default 25, p_offset int default 0, p_search text default null,
                                               p_state text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        term text := lower(left(nullif(btrim(p_search), ''), 80)); total bigint; items jsonb; summary jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_state is not null and p_state not in ('ativos', 'expirados', 'esgotados', 'revogados') then raise exception 'invalid' using errcode = 'MM005'; end if;
  with base as (
    select i.id, i.event_id, e.title, i.label, i.uses, i.max_uses, i.expires_at, i.revoked_at, i.created_at,
           case when i.revoked_at is not null then 'revogado' when i.expires_at <= now() then 'expirado'
                when i.max_uses is not null and i.uses >= i.max_uses then 'esgotado' else 'ativo' end as state
      from public.invitations i join public.events e on e.id = i.event_id
  ), f as (
    select * from base b
     where (term is null or strpos(lower(b.label), term) > 0 or strpos(lower(b.title), term) > 0)
       and (p_state is null or (p_state = 'ativos' and b.state = 'ativo') or (p_state = 'expirados' and b.state = 'expirado')
            or (p_state = 'esgotados' and b.state = 'esgotado') or (p_state = 'revogados' and b.state = 'revogado'))
  ), page as (select * from f order by created_at desc, id limit lim offset off)
  select (select count(*) from f),
         (select jsonb_build_object('total', count(*), 'ativos', count(*) filter (where state = 'ativo'), 'expirados', count(*) filter (where state = 'expirado'),
                                    'esgotados', count(*) filter (where state = 'esgotado'), 'revogados', count(*) filter (where state = 'revogado')) from base),
         coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'eventId', i.event_id, 'eventTitle', i.title, 'label', i.label, 'uses', i.uses, 'maxUses', i.max_uses,
    'expiresAt', i.expires_at, 'revokedAt', i.revoked_at, 'createdAt', i.created_at, 'state', i.state
  ) order by i.created_at desc, i.id), '[]'::jsonb)
    into total, summary, items from page i;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items, 'summary', summary);
end $$;

-- ---------------------------------------------------------------- equipe (só master)
create function public.admin_list_team() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare masters bigint;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select count(*) into masters from public.platform_roles where role = 'master' and revoked_at is null;
  return jsonb_build_object('items', (
    select coalesce(jsonb_agg(jsonb_build_object(
        'userId', r.user_id, 'email', u.email, 'role', r.role, 'grantedAt', r.granted_at,
        'grantedBy', r.granted_by, 'grantedByEmail', g.email, 'installation', r.granted_by is null,
        'lastMaster', r.role = 'master' and masters <= 1) order by r.granted_at, r.id), '[]')
      from public.platform_roles r join auth.users u on u.id = r.user_id left join auth.users g on g.id = r.granted_by
     where r.revoked_at is null));
end $$;

-- ---------------------------------------------------------------- conceder e revogar (motivo 10 a 500 NO SERVIDOR; último master protegido)
create or replace function public.admin_grant_platform_role(p_user uuid, p_role text, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare new_id bigint; n int := char_length(btrim(coalesce(p_reason, '')));
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if n < 10 or n > 500 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if not exists (select 1 from auth.users where id = p_user and not coalesce(is_anonymous, false)) then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform set_config('mm.audit_reason', btrim(p_reason), true);
  insert into public.platform_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid()) returning id into new_id;
  return new_id;
end $$;

create or replace function public.admin_revoke_platform_role(p_user uuid, p_role text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare n int := char_length(btrim(coalesce(p_reason, '')));
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if n < 10 or n > 500 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if p_role = 'master' then
    perform pg_advisory_xact_lock(hashtext('platform_roles:master'));
    if (select count(*) from public.platform_roles where role = 'master' and revoked_at is null) <= 1 then
      raise exception 'último master não pode ser revogado' using errcode = 'MM009';
    end if;
  end if;
  perform set_config('mm.audit_reason', btrim(p_reason), true);
  update public.platform_roles set revoked_at = now() where user_id = p_user and role = p_role and revoked_at is null;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
end $$;

create function public.admin_grant_platform_role_by_email(p_email text, p_role text, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare em text := lower(btrim(coalesce(p_email, ''))); uid uuid; n int := char_length(btrim(coalesce(p_reason, '')));
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if n < 10 or n > 500 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if p_role is null or p_role not in ('master', 'support', 'auditor') or em = '' or char_length(em) > 254 then raise exception 'invalid' using errcode = 'MM005'; end if;
  select u.id into uid from auth.users u where lower(u.email) = em and not coalesce(u.is_anonymous, false) order by u.created_at limit 1;
  if uid is null then raise exception 'notfound' using errcode = 'MM005'; end if;
  if exists (select 1 from public.platform_roles r where r.user_id = uid and r.role = p_role and r.revoked_at is null) then raise exception 'duplicate' using errcode = 'MM005'; end if;
  return public.admin_grant_platform_role(uid, p_role, p_reason);
end $$;

-- ---------------------------------------------------------------- execução
revoke all on function public.admin_people_counts(), public.admin_search_participants_v2(int, int, text, text), public.admin_search_invites_v2(int, int, text, text),
  public.admin_list_team(), public.admin_grant_platform_role_by_email(text, text, text) from public, anon;
grant execute on function public.admin_people_counts(), public.admin_search_participants_v2(int, int, text, text), public.admin_search_invites_v2(int, int, text, text),
  public.admin_list_team(), public.admin_grant_platform_role_by_email(text, text, text) to authenticated;
