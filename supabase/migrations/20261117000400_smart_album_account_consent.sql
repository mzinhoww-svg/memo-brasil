-- Revela Smart Album · consentimento único por CONTA (termo 2026-11-16-v2, aprovado pelo proprietário em 16/11/2026). ADITIVA.
--
-- Antes: consentimento, selfie e busca por evento (a pessoa repetia tudo em cada evento).
-- Agora: um aceite específico e destacado (caixa separada, desmarcada) vale para todos os eventos da conta; uma selfie de conta vale até
-- 12 meses, troca ou revogação; a busca é disparada pelo servidor quando o evento revela ou chegam fotos novas.
--   * face_consents / face_profiles com event_id NULO = escopo de conta. Linhas por evento (termo v1) continuam válidas para leitura e
--     revogação; ações novas exigem a versão vigente (v2), então quem usava v1 aceita uma vez de novo, já no escopo de conta.
--   * O organizador pode desligar a busca no evento (events.face_search_enabled). Nada muda na regra de acesso: can_see_photo decide.
--   * Gates mantidos: chave smart_album_face_matching, gate jurídico, versão aprovada, conta não anônima, membro/anfitrião, revelado.

-- ===================================================================================================================== esquema
alter table public.events add column if not exists face_search_enabled boolean not null default true;

alter table public.face_consents alter column event_id drop not null;
alter table public.face_consents drop constraint if exists face_consents_source_check;
alter table public.face_consents add constraint face_consents_source_check check (source in ('google', 'upload', 'camera', 'entrada'));
create unique index if not exists face_consents_account_active on public.face_consents (user_id) where event_id is null and revoked_at is null;

-- append-only: event_id nulo não pode virar evento (nem o contrário)
create or replace function public.face_consents_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null
     or new.id <> old.id or new.event_id is distinct from old.event_id or new.user_id <> old.user_id or new.purpose <> old.purpose
     or new.consent_version <> old.consent_version or new.retention_policy_version <> old.retention_policy_version
     or new.source <> old.source or new.method <> old.method or new.self_attested <> old.self_attested or new.granted_at <> old.granted_at
     or new.revoked_at is null then
    raise exception 'append-only' using errcode = 'MM005';
  end if;
  return new;
end $$;

alter table public.face_profiles alter column event_id drop not null;
alter table public.face_profiles drop constraint if exists face_profiles_path;
alter table public.face_profiles add constraint face_profiles_path check (reference_storage_path is null
  or (event_id is not null and reference_storage_path = event_id::text || '/' || user_id::text || '/' || id::text)
  or (event_id is null and reference_storage_path = 'conta/' || user_id::text || '/' || id::text));
create unique index if not exists face_profiles_account_active on public.face_profiles (user_id) where event_id is null and status in ('pending', 'ready');

insert into public.face_consent_documents (version, approved) values ('2026-11-16-v2', true) on conflict (version) do update set approved = true;

-- ===================================================================================================================== gates e helpers
create or replace function public.smart_album_face_enabled(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.feature_flags f
      where f.key = 'smart_album_face_matching' and f.enabled
        and ((f.rollout ->> 'all') = 'true' or (f.rollout -> 'events') ? p_event::text))
    and public.smart_album_legal_gate()
    and public.smart_album_face_consent_version() is not null
    and exists (select 1 from public.events e where e.id = p_event and e.deleted_at is null and e.face_search_enabled)
$$;

-- aceite de conta só existe com a busca liberada no app inteiro (rollout all)
create function public.smart_album_face_enabled_any() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.feature_flags f where f.key = 'smart_album_face_matching' and f.enabled and (f.rollout ->> 'all') = 'true')
    and public.smart_album_legal_gate()
    and public.smart_album_face_consent_version() is not null
$$;

create function public.smart_album_account_consent(p_user uuid) returns public.face_consents
language sql stable security definer set search_path = '' as $$
  select * from public.face_consents where event_id is null and user_id = p_user and revoked_at is null limit 1
$$;

-- consentimento efetivo em (evento, titular): o de conta vale em qualquer evento; o de evento (legado v1) só no próprio evento
create function public.smart_album_effective_consent(p_event uuid, p_user uuid) returns public.face_consents
language sql stable security definer set search_path = '' as $$
  select * from public.face_consents
  where user_id = p_user and revoked_at is null and (event_id is null or event_id = p_event)
  order by (event_id is null) desc, granted_at desc limit 1
$$;

-- perfil efetivo: o da conta quando o consentimento é de conta; senão o do evento
create function public.smart_album_effective_profile(p_event uuid, p_user uuid) returns public.face_profiles
language sql stable security definer set search_path = '' as $$
  select fp.* from public.face_profiles fp
  where fp.user_id = p_user and fp.status in ('pending', 'ready', 'error')
    and (fp.event_id = p_event or fp.event_id is null)
    and fp.consent_id = (public.smart_album_effective_consent(p_event, p_user)).id
  order by fp.created_at desc limit 1
$$;

-- o perfil ainda tem consentimento válido para ser usado (job antigo de perfil revogado é cancelado)
create function public.smart_album_profile_consented(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.face_profiles fp join public.face_consents c on c.id = fp.consent_id
                 where fp.id = p_profile and c.revoked_at is null)
$$;

-- ===================================================================================================================== storage
create or replace function public.can_upload_face_reference(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.face_profiles fp join public.face_consents c on c.id = fp.consent_id
    where fp.reference_storage_path = p_name and fp.user_id = auth.uid() and fp.status = 'pending' and c.revoked_at is null
      and not exists (select 1 from storage.objects o where o.bucket_id = 'face-references' and o.name = p_name)
      and ((fp.event_id is not null and public.smart_album_face_enabled(fp.event_id)
             and (public.is_member(fp.event_id) or public.is_host(fp.event_id)))
        or (fp.event_id is null and c.event_id is null and public.smart_album_face_enabled_any())))
$$;

-- ===================================================================================================================== conta
-- apaga o que a selfie de conta produziu em todos os eventos: jobs ativos, resultados e a referência (purga assíncrona)
create function public.smart_album_erase_account(p_user uuid, p_reason text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; touched int := 0; c int; r record;
begin
  update public.face_search_jobs set status = 'cancelled', completed_at = now(), locked_until = null
    where user_id = p_user and status in ('queued', 'processing')
      and face_profile_id in (select id from public.face_profiles where user_id = p_user and event_id is null);
  get diagnostics c = row_count; touched := touched + c;
  delete from public.face_photo_matches
    where user_id = p_user and face_profile_id in (select id from public.face_profiles where user_id = p_user and event_id is null);
  get diagnostics c = row_count; touched := touched + c;
  for r in select id, reference_storage_path from public.face_profiles where event_id is null and user_id = p_user and status <> 'erased' for update loop
    if r.reference_storage_path is not null then
      insert into public.storage_purge_queue (path, bucket) values (r.reference_storage_path, 'face-references') on conflict do nothing;
      n := n + 1;
    end if;
    update public.face_profiles set status = 'erased', reference_storage_path = null, updated_at = now() where id = r.id;
    touched := touched + 1;
  end loop;
  if touched > 0 then
    perform public.smart_album_audit(null, 'smart_album.face_erased', jsonb_build_object('scope', 'conta', 'reason', p_reason, 'objects_queued', n));
  end if;
  return n;
end $$;

create function public.smart_album_account_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.face_consents; fp public.face_profiles; avail boolean;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  avail := public.smart_album_face_enabled_any();
  c := public.smart_album_account_consent(uid);
  select * into fp from public.face_profiles where event_id is null and user_id = uid and status in ('pending', 'ready', 'error')
    order by created_at desc limit 1;
  return jsonb_build_object(
    'available', avail,
    'account', not public.is_anonymous(),
    'consentVersion', case when avail then public.smart_album_face_consent_version() end,
    'consented', c.id is not null,
    'consentOutdated', c.id is not null and c.consent_version is distinct from public.smart_album_face_consent_version(),
    'consentedAt', c.granted_at,
    'profile', fp.status,
    'profileError', fp.error_code,
    'referenceAt', fp.created_at,
    'expiresAt', fp.expires_at);
end $$;

create function public.smart_album_grant_account_consent(p_version text, p_source text, p_self_attested boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cur text; existing public.face_consents; nid uuid;
begin
  if uid is null or public.is_anonymous() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.smart_album_face_enabled_any() then raise exception 'facedisabled' using errcode = 'MM019'; end if;
  cur := public.smart_album_face_consent_version();
  if p_version is distinct from cur or p_source is null or p_source not in ('google', 'upload', 'camera', 'entrada') or p_self_attested is not true then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  perform public.check_rate_limit('sa_consent:' || uid::text, 10, interval '1 hour');
  select * into existing from public.face_consents where event_id is null and user_id = uid and revoked_at is null for update;
  if existing.id is not null then
    if existing.consent_version = cur then return existing.id; end if;
    update public.face_consents set revoked_at = now(), revoked_reason = 'versao' where id = existing.id;
    perform public.smart_album_erase_account(uid, 'versao');
  end if;
  begin
    insert into public.face_consents (event_id, user_id, consent_version, retention_policy_version, source, self_attested)
    values (null, uid, cur, 'smart-album-conta-12m', p_source, true) returning id into nid;
  exception when unique_violation then
    select id into nid from public.face_consents where event_id is null and user_id = uid and revoked_at is null;
    return nid;
  end;
  perform public.smart_album_audit(null, 'smart_album.consent_granted', jsonb_build_object('scope', 'conta', 'version', cur, 'source', p_source));
  return nid;
end $$;

-- selfie de conta: caminho privado conta/<titular>/<perfil>; trocar apaga a anterior e os resultados dela
create function public.smart_album_begin_account_reference(p_source text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.face_consents; pid uuid := gen_random_uuid(); path text;
begin
  if uid is null or public.is_anonymous() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.smart_album_face_enabled_any() then raise exception 'facedisabled' using errcode = 'MM019'; end if;
  if p_source is null or p_source not in ('google', 'upload', 'camera') then raise exception 'invalid' using errcode = 'MM005'; end if;
  c := public.smart_album_account_consent(uid);
  if c.id is null or c.consent_version is distinct from public.smart_album_face_consent_version() then
    raise exception 'faceconsent' using errcode = 'MM020';
  end if;
  perform public.check_rate_limit('sa_ref:' || uid::text, 10, interval '1 hour');
  if exists (select 1 from public.face_profiles where event_id is null and user_id = uid and status <> 'erased') then
    perform public.smart_album_erase_account(uid, 'troca');
  end if;
  path := 'conta/' || uid::text || '/' || pid::text;
  begin
    insert into public.face_profiles (id, event_id, user_id, consent_id, reference_source, reference_storage_path, status, expires_at)
    values (pid, null, uid, c.id, p_source, path, 'pending', now() + interval '12 months');
  exception when unique_violation then raise exception 'conflict' using errcode = 'MM005';
  end;
  perform public.smart_album_audit(null, 'smart_album.reference_started', jsonb_build_object('scope', 'conta', 'source', p_source));
  return jsonb_build_object('profileId', pid, 'bucket', 'face-references', 'path', path);
end $$;

-- desligar de vez: retira o consentimento de conta (e os legados por evento), apaga selfie e resultados em todos os eventos
create function public.smart_album_revoke_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int; q int; r record;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform public.check_rate_limit('sa_revoke:' || uid::text, 60, interval '1 hour');
  update public.face_consents set revoked_at = now(), revoked_reason = 'usuario' where user_id = uid and revoked_at is null;
  get diagnostics n = row_count;
  q := public.smart_album_erase_account(uid, 'revogacao');
  for r in select distinct event_id from public.face_profiles where user_id = uid and event_id is not null and status <> 'erased' loop
    q := q + public.smart_album_erase(r.event_id, uid, 'revogacao');
  end loop;
  if n > 0 then perform public.smart_album_audit(null, 'smart_album.consent_revoked', jsonb_build_object('scope', 'conta')); end if;
  return jsonb_build_object('revoked', n, 'purgeQueued', q, 'status', case when q > 0 then 'purge_queued' else 'done' end);
end $$;

-- ===================================================================================================================== por evento
create or replace function public.smart_album_state(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); face boolean; c public.face_consents; fp public.face_profiles; j public.face_search_jobs; revealed boolean; n int := null;
begin
  if not public.smart_album_can_use(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  face := public.smart_album_face_enabled(p_event);
  revealed := public.is_revealed(p_event);
  c := public.smart_album_effective_consent(p_event, uid);
  fp := public.smart_album_effective_profile(p_event, uid);
  select * into j from public.face_search_jobs where event_id = p_event and user_id = uid order by created_at desc limit 1;
  if face and revealed and c.id is not null then
    select count(*)::int into n from public.face_photo_matches m
      where m.event_id = p_event and m.user_id = uid and not m.hidden_by_user and public.can_see_photo(m.photo_id);
  end if;
  return jsonb_build_object(
    'ui', public.smart_album_ui_enabled(p_event),
    'revealed', revealed,
    'face', jsonb_build_object(
      'available', face,
      'account', not public.is_anonymous(),
      'consentVersion', case when face then public.smart_album_face_consent_version() end,
      'consented', c.id is not null,
      'consentOutdated', c.id is not null and c.consent_version is distinct from public.smart_album_face_consent_version(),
      'scope', case when c.id is null then null when c.event_id is null then 'account' else 'event' end,
      'consentedAt', c.granted_at,
      'referenceAt', fp.created_at,
      'hostDisabled', not coalesce((select e.face_search_enabled from public.events e where e.id = p_event), true),
      'profile', fp.status,
      'source', fp.reference_source,
      'job', case when j.id is null then null else jsonb_build_object('id', j.id, 'status', j.status, 'processed', j.processed_count,
               'eligible', case when revealed then j.eligible_photos_count end, 'errorCode', j.error_code) end,
      'matches', n));
end $$;

create or replace function public.smart_album_request_search(p_event uuid, p_idempotency text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.face_consents; fp public.face_profiles; j public.face_search_jobs;
begin
  if not public.smart_album_can_use(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.smart_album_face_enabled(p_event) then raise exception 'facedisabled' using errcode = 'MM019'; end if;
  if p_idempotency is null or p_idempotency !~ '^[A-Za-z0-9_-]{8,80}$' then raise exception 'invalid' using errcode = 'MM005'; end if;
  c := public.smart_album_effective_consent(p_event, uid);
  if c.id is null or c.consent_version is distinct from public.smart_album_face_consent_version() then
    raise exception 'faceconsent' using errcode = 'MM020';
  end if;
  if not public.is_revealed(p_event) then raise exception 'notrevealed' using errcode = 'MM017'; end if;
  select * into j from public.face_search_jobs where user_id = uid and idempotency_key = p_idempotency;
  if j.id is not null then
    if j.event_id <> p_event then raise exception 'invalid' using errcode = 'MM005'; end if;
    return jsonb_build_object('jobId', j.id, 'status', j.status);
  end if;
  select * into j from public.face_search_jobs where event_id = p_event and user_id = uid and status in ('queued', 'processing');
  if j.id is not null then return jsonb_build_object('jobId', j.id, 'status', j.status); end if;
  fp := public.smart_album_effective_profile(p_event, uid);
  if fp.id is null or fp.status not in ('pending', 'ready')
     or not exists (select 1 from storage.objects o where o.bucket_id = 'face-references' and o.name = fp.reference_storage_path) then
    raise exception 'invalid' using errcode = 'MM005'; -- sem referência enviada
  end if;
  perform public.check_rate_limit('sa_search:' || uid::text, 6, interval '1 hour');
  begin
    insert into public.face_search_jobs (event_id, user_id, face_profile_id, idempotency_key) values (p_event, uid, fp.id, p_idempotency) returning * into j;
  exception when unique_violation then
    select * into j from public.face_search_jobs where (user_id = uid and idempotency_key = p_idempotency)
      or (event_id = p_event and user_id = uid and status in ('queued', 'processing')) order by created_at desc limit 1;
    return jsonb_build_object('jobId', j.id, 'status', j.status);
  end;
  perform public.smart_album_audit(p_event, 'smart_album.job_started', '{}'::jsonb);
  return jsonb_build_object('jobId', j.id, 'status', j.status);
end $$;

create or replace function public.smart_album_list_matches(p_event uuid, p_limit int default 30, p_before timestamptz default null)
returns table (photo_id uuid, band text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if not public.smart_album_can_use(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.smart_album_face_enabled(p_event) then raise exception 'facedisabled' using errcode = 'MM019'; end if;
  if (public.smart_album_effective_consent(p_event, uid)).id is null then raise exception 'faceconsent' using errcode = 'MM020'; end if;
  if not public.is_revealed(p_event) then raise exception 'notrevealed' using errcode = 'MM017'; end if;
  return query
    select m.photo_id, m.confidence_band, m.created_at from public.face_photo_matches m
    where m.event_id = p_event and m.user_id = uid and not m.hidden_by_user
      and (p_before is null or m.created_at < p_before) and public.can_see_photo(m.photo_id)
    order by m.created_at desc, m.photo_id
    limit greatest(1, least(coalesce(p_limit, 30), 100));
end $$;

-- organizador liga/desliga a busca facial no evento dele (desligar cancela as buscas em andamento; resultados somem da tela pelo gate)
create function public.set_event_face_search(p_event uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_enabled is null or not public.is_host(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  update public.events set face_search_enabled = p_enabled where id = p_event and deleted_at is null;
  if not p_enabled then
    update public.face_search_jobs set status = 'cancelled', error_code = 'gate_closed', completed_at = now(), locked_until = null
      where event_id = p_event and status in ('queued', 'processing');
  end if;
  insert into public.audit_logs (actor_id, event_id, action, detail)
    values (auth.uid(), p_event, 'event.face_search_' || case when p_enabled then 'enabled' else 'disabled' end, '{}'::jsonb);
end $$;

-- ===================================================================================================================== worker
-- busca automática: selfie de conta pronta + evento revelado com fotos + nenhuma busca desta selfie depois da última foto
create function public.smart_album_enqueue_auto(p_limit int default 5) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if not public.smart_album_face_enabled_any() then return 0; end if;
  for r in
    select e.id as event_id, fp.user_id, fp.id as profile_id
    from public.face_profiles fp
    join public.face_consents c on c.id = fp.consent_id and c.revoked_at is null and c.event_id is null
         and c.consent_version = public.smart_album_face_consent_version()
    join public.events e on e.deleted_at is null and e.face_search_enabled
         and (e.host_id = fp.user_id or exists (select 1 from public.participants p where p.event_id = e.id and p.user_id = fp.user_id and p.blocked_at is null))
    cross join lateral (select max(ph.created_at) as last_photo from public.photos ph where ph.event_id = e.id and ph.upload_status = 'pronta') lp
    where fp.event_id is null and fp.status in ('pending', 'ready') and fp.reference_storage_path is not null
      and exists (select 1 from storage.objects o where o.bucket_id = 'face-references' and o.name = fp.reference_storage_path)
      and lp.last_photo is not null and public.is_revealed(e.id)
      and not exists (select 1 from public.face_search_jobs j where j.event_id = e.id and j.user_id = fp.user_id
                        and (j.status in ('queued', 'processing') or (j.face_profile_id = fp.id and j.created_at >= lp.last_photo)))
    limit greatest(1, least(coalesce(p_limit, 5), 50))
  loop
    begin
      insert into public.face_search_jobs (event_id, user_id, face_profile_id, idempotency_key)
      values (r.event_id, r.user_id, r.profile_id, 'auto-' || replace(gen_random_uuid()::text, '-', ''));
      n := n + 1;
    exception when unique_violation then null; -- outro job ativo surgiu ao mesmo tempo
    end;
  end loop;
  return n;
end $$;

create or replace function public.smart_album_worker_claim(p_limit int default 5) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; out jsonb := '[]'::jsonb; ids uuid[];
begin
  update public.face_search_jobs set status = 'queued', locked_until = null
    where status = 'processing' and locked_until < now() and attempts < 3;
  update public.face_search_jobs set status = 'failed', error_code = 'timeout', completed_at = now(), locked_until = null
    where status = 'processing' and locked_until < now() and attempts >= 3;
  perform public.smart_album_enqueue_auto(5);
  for r in
    select j.*, fp.reference_storage_path, fp.status as profile_status from public.face_search_jobs j join public.face_profiles fp on fp.id = j.face_profile_id
    where j.status = 'queued' order by j.created_at limit greatest(1, least(coalesce(p_limit, 5), 20)) for update of j skip locked
  loop
    if not public.smart_album_face_enabled(r.event_id) or r.profile_status not in ('pending', 'ready') or r.reference_storage_path is null
       or not public.smart_album_profile_consented(r.face_profile_id) then
      update public.face_search_jobs set status = 'cancelled', error_code = 'gate_closed', completed_at = now() where id = r.id;
      continue;
    end if;
    ids := public.smart_album_eligible_photo_ids(r.event_id, r.user_id);
    update public.face_search_jobs set status = 'processing', attempts = attempts + 1, started_at = coalesce(started_at, now()),
      locked_until = now() + interval '10 minutes', eligible_photos_count = cardinality(ids) where id = r.id;
    out := out || jsonb_build_array(jsonb_build_object('jobId', r.id, 'eventId', r.event_id, 'profileId', r.face_profile_id,
      'referencePath', r.reference_storage_path, 'photoIds', to_jsonb(ids)));
  end loop;
  return out;
end $$;

create or replace function public.smart_album_worker_complete(p_job uuid, p_matches jsonb, p_processed int, p_engine text) returns int
language plpgsql security definer set search_path = '' as $$
declare j public.face_search_jobs; ids uuid[]; n int;
begin
  select * into j from public.face_search_jobs where id = p_job for update;
  if j.id is null or j.status <> 'processing' then raise exception 'invalid' using errcode = 'MM005'; end if;
  if p_engine is null or p_engine !~ '^[a-z0-9._-]{1,40}$' or jsonb_typeof(coalesce(p_matches, '[]')) <> 'array' then raise exception 'invalid' using errcode = 'MM005'; end if;
  if not public.smart_album_face_enabled(j.event_id) or not public.smart_album_profile_consented(j.face_profile_id) then
    update public.face_search_jobs set status = 'cancelled', error_code = 'gate_closed', completed_at = now(), locked_until = null where id = j.id;
    return 0;
  end if;
  ids := public.smart_album_eligible_photo_ids(j.event_id, j.user_id);
  insert into public.face_photo_matches (event_id, user_id, photo_id, face_profile_id, job_id, confidence_band)
    select j.event_id, j.user_id, (m ->> 'photoId')::uuid, j.face_profile_id, j.id, m ->> 'band'
    from jsonb_array_elements(coalesce(p_matches, '[]')) m
    where (m ->> 'band') in ('probable', 'review') and (m ->> 'photoId') ~ '^[0-9a-f-]{36}$' and (m ->> 'photoId')::uuid = any (ids)
  on conflict (event_id, user_id, photo_id) do update set job_id = excluded.job_id, face_profile_id = excluded.face_profile_id,
    confidence_band = excluded.confidence_band;
  get diagnostics n = row_count;
  update public.face_profiles set status = 'ready', engine_version = p_engine, updated_at = now() where id = j.face_profile_id and status = 'pending';
  update public.face_search_jobs set status = 'completed', processed_count = greatest(0, coalesce(p_processed, 0)), matches_count = n,
    engine_version = p_engine, completed_at = now(), locked_until = null where id = j.id;
  return n;
end $$;

create or replace function public.smart_album_expire() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in
    select distinct fp.event_id, fp.user_id, case when p.blocked_at is not null then 'bloqueado' else 'expirado' end as why
    from public.face_profiles fp
    join public.events e on e.id = fp.event_id
    left join public.participants p on p.event_id = fp.event_id and p.user_id = fp.user_id
    where fp.status <> 'erased'
      and (fp.expires_at < now() or p.blocked_at is not null or e.deleted_at is not null
           or (p.user_id is null and e.host_id is distinct from fp.user_id))
  loop
    update public.face_consents set revoked_at = now(), revoked_reason = r.why where event_id = r.event_id and user_id = r.user_id and revoked_at is null;
    perform public.smart_album_erase(r.event_id, r.user_id, r.why);
    n := n + 1;
  end loop;
  -- selfie de conta vencida (12 meses): o aceite vence junto; a pessoa decide de novo se quer
  for r in select distinct fp.user_id from public.face_profiles fp where fp.event_id is null and fp.status <> 'erased' and fp.expires_at < now() loop
    update public.face_consents set revoked_at = now(), revoked_reason = 'expirado' where event_id is null and user_id = r.user_id and revoked_at is null;
    perform public.smart_album_erase_account(r.user_id, 'expirado');
    n := n + 1;
  end loop;
  delete from public.face_search_jobs where expires_at < now() and status in ('completed', 'failed', 'cancelled')
    and not exists (select 1 from public.face_photo_matches m where m.job_id = face_search_jobs.id);
  return n;
end $$;

-- ===================================================================================================================== permissões
revoke execute on function public.smart_album_face_enabled_any(), public.smart_album_account_consent(uuid),
  public.smart_album_effective_consent(uuid, uuid), public.smart_album_effective_profile(uuid, uuid), public.smart_album_profile_consented(uuid),
  public.smart_album_erase_account(uuid, text), public.smart_album_enqueue_auto(int)
  from public, anon, authenticated;
revoke execute on function public.smart_album_account_status(), public.smart_album_grant_account_consent(text, text, boolean),
  public.smart_album_begin_account_reference(text), public.smart_album_revoke_account(), public.set_event_face_search(uuid, boolean)
  from public, anon;
grant execute on function public.smart_album_account_status(), public.smart_album_grant_account_consent(text, text, boolean),
  public.smart_album_begin_account_reference(text), public.smart_album_revoke_account(), public.set_event_face_search(uuid, boolean)
  to authenticated;
grant execute on function public.smart_album_erase_account(uuid, text), public.smart_album_enqueue_auto(int) to service_role;
-- as recriadas mantêm as permissões originais (create or replace não altera grants); reforço explícito:
revoke execute on function public.smart_album_face_enabled(uuid), public.smart_album_state(uuid), public.smart_album_request_search(uuid, text),
  public.smart_album_list_matches(uuid, int, timestamptz), public.can_upload_face_reference(text) from public, anon;
revoke execute on function public.smart_album_worker_claim(int), public.smart_album_worker_complete(uuid, jsonb, int, text), public.smart_album_expire()
  from public, anon, authenticated;
