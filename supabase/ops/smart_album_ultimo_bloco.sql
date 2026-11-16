-- Smart Album · ÚLTIMO BLOCO para o SQL Editor do projeto newmemocuiaba (asyaegeodyttttaubvxh).
-- Em 16/11/2026 já foram aplicados em produção: parte 1, tabelas face_*, bucket, política de upload, funções de leitura e a ativação
-- (termo v1 + rollout all). Este arquivo cria só as funções que alteram dados, as permissões finais e registra as versões.
-- Rodar UMA vez. Se falhar no meio, nada é aplicado (transação).
begin;
create function public.face_consents_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null
     or new.id <> old.id or new.event_id <> old.event_id or new.user_id <> old.user_id or new.purpose <> old.purpose
     or new.consent_version <> old.consent_version or new.retention_policy_version <> old.retention_policy_version
     or new.source <> old.source or new.method <> old.method or new.self_attested <> old.self_attested or new.granted_at <> old.granted_at
     or new.revoked_at is null then
    raise exception 'append-only' using errcode = 'MM005';
  end if;
  return new;
end $$;
create trigger face_consents_append_only before update on public.face_consents for each row execute function public.face_consents_append_only();
create function public.smart_album_erase(p_event uuid, p_user uuid, p_reason text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; touched int := 0; c int; r record;
begin
  update public.face_search_jobs set status = 'cancelled', completed_at = now(), locked_until = null
    where event_id = p_event and user_id = p_user and status in ('queued', 'processing');
  get diagnostics c = row_count; touched := touched + c;
  delete from public.face_photo_matches where event_id = p_event and user_id = p_user;
  get diagnostics c = row_count; touched := touched + c;
  for r in select id, reference_storage_path from public.face_profiles where event_id = p_event and user_id = p_user and status <> 'erased' for update loop
    if r.reference_storage_path is not null then
      insert into public.storage_purge_queue (path, bucket) values (r.reference_storage_path, 'face-references') on conflict do nothing;
      n := n + 1;
    end if;
    update public.face_profiles set status = 'erased', reference_storage_path = null, updated_at = now() where id = r.id;
    touched := touched + 1;
  end loop;
  if touched > 0 then -- nada a apagar = nada a auditar (revogar em evento qualquer não polui a trilha)
    perform public.smart_album_audit(p_event, 'smart_album.face_erased', jsonb_build_object('reason', p_reason, 'objects_queued', n));
  end if;
  return n;
end $$;
create function public.smart_album_grant_face_consent(p_event uuid, p_version text, p_source text, p_self_attested boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cur text; existing public.face_consents; nid uuid;
begin
  if not public.smart_album_can_use(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.smart_album_face_enabled(p_event) then raise exception 'facedisabled' using errcode = 'MM019'; end if;
  if public.is_anonymous() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  cur := public.smart_album_face_consent_version();
  if p_version is distinct from cur or p_source is null or p_source not in ('google', 'upload', 'camera') or p_self_attested is not true then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  perform public.check_rate_limit('sa_consent:' || uid::text, 10, interval '1 hour');
  select * into existing from public.face_consents where event_id = p_event and user_id = uid and revoked_at is null for update;
  if existing.id is not null then
    if existing.consent_version = cur then return existing.id; end if;
    update public.face_consents set revoked_at = now(), revoked_reason = 'versao' where id = existing.id; -- nova versão exige novo aceite
  end if;
  begin
    insert into public.face_consents (event_id, user_id, consent_version, source, self_attested) values (p_event, uid, cur, p_source, true) returning id into nid;
  exception when unique_violation then -- chamada concorrente: devolve o consentimento que ganhou
    select id into nid from public.face_consents where event_id = p_event and user_id = uid and revoked_at is null;
    return nid;
  end;
  perform public.smart_album_audit(p_event, 'smart_album.consent_granted', jsonb_build_object('version', cur, 'source', p_source));
  return nid;
end $$;
create function public.smart_album_begin_reference(p_event uuid, p_source text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.face_consents; pid uuid := gen_random_uuid(); path text; ev public.events;
begin
  if not public.smart_album_can_use(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.smart_album_face_enabled(p_event) then raise exception 'facedisabled' using errcode = 'MM019'; end if;
  if p_source is null or p_source not in ('google', 'upload', 'camera') then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into c from public.face_consents where event_id = p_event and user_id = uid and revoked_at is null;
  if c.id is null or c.consent_version is distinct from public.smart_album_face_consent_version() then
    raise exception 'faceconsent' using errcode = 'MM020';
  end if;
  perform public.check_rate_limit('sa_ref:' || uid::text, 10, interval '1 hour');
  if exists (select 1 from public.face_profiles where event_id = p_event and user_id = uid and status <> 'erased') then
    perform public.smart_album_erase(p_event, uid, 'troca');
  end if;
  select * into ev from public.events where id = p_event;
  path := p_event::text || '/' || uid::text || '/' || pid::text;
  begin
    insert into public.face_profiles (id, event_id, user_id, consent_id, reference_source, reference_storage_path, status, expires_at)
    values (pid, p_event, uid, c.id, p_source, path, 'pending',
            least(now() + interval '30 days', public.event_end(ev.start_at, ev.duration_hours, ev.ended_at) + interval '30 days'));
  exception when unique_violation then raise exception 'conflict' using errcode = 'MM005'; -- outra troca simultânea venceu; repetir
  end;
  perform public.smart_album_audit(p_event, 'smart_album.reference_started', jsonb_build_object('source', p_source));
  return jsonb_build_object('profileId', pid, 'bucket', 'face-references', 'path', path);
end $$;
create function public.smart_album_request_search(p_event uuid, p_idempotency text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.face_consents; fp public.face_profiles; j public.face_search_jobs;
begin
  if not public.smart_album_can_use(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.smart_album_face_enabled(p_event) then raise exception 'facedisabled' using errcode = 'MM019'; end if;
  if p_idempotency is null or p_idempotency !~ '^[A-Za-z0-9_-]{8,80}$' then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into c from public.face_consents where event_id = p_event and user_id = uid and revoked_at is null;
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
  select * into fp from public.face_profiles where event_id = p_event and user_id = uid and status in ('pending', 'ready');
  if fp.id is null or not exists (select 1 from storage.objects o where o.bucket_id = 'face-references' and o.name = fp.reference_storage_path) then
    raise exception 'invalid' using errcode = 'MM005'; -- sem referência enviada
  end if;
  perform public.check_rate_limit('sa_search:' || uid::text, 6, interval '1 hour');
  begin
    insert into public.face_search_jobs (event_id, user_id, face_profile_id, idempotency_key) values (p_event, uid, fp.id, p_idempotency) returning * into j;
  exception when unique_violation then -- mesma chave ou outro job ativo criado ao mesmo tempo
    select * into j from public.face_search_jobs where (user_id = uid and idempotency_key = p_idempotency)
      or (event_id = p_event and user_id = uid and status in ('queued', 'processing')) order by created_at desc limit 1;
    return jsonb_build_object('jobId', j.id, 'status', j.status);
  end;
  perform public.smart_album_audit(p_event, 'smart_album.job_started', '{}'::jsonb);
  return jsonb_build_object('jobId', j.id, 'status', j.status);
end $$;
create function public.smart_album_hide_match(p_event uuid, p_photo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if not public.smart_album_can_use(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  update public.face_photo_matches set hidden_by_user = true where event_id = p_event and user_id = uid and photo_id = p_photo;
  if found then perform public.smart_album_audit(p_event, 'smart_album.match_hidden', '{}'::jsonb); end if;
end $$;
create function public.smart_album_revoke_face(p_event uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int; q int;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform public.check_rate_limit('sa_revoke:' || uid::text, 60, interval '1 hour'); -- folgado: revogar nunca deve travar quem usa
  update public.face_consents set revoked_at = now(), revoked_reason = 'usuario' where event_id = p_event and user_id = uid and revoked_at is null;
  get diagnostics n = row_count;
  q := public.smart_album_erase(p_event, uid, 'revogacao');
  if n > 0 then perform public.smart_album_audit(p_event, 'smart_album.consent_revoked', '{}'::jsonb); end if;
  return jsonb_build_object('revoked', n, 'purgeQueued', q, 'status', case when q > 0 then 'purge_queued' else 'done' end);
end $$;
create function public.smart_album_worker_claim(p_limit int default 5) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; out jsonb := '[]'::jsonb; ids uuid[];
begin
  update public.face_search_jobs set status = 'queued', locked_until = null
    where status = 'processing' and locked_until < now() and attempts < 3;
  update public.face_search_jobs set status = 'failed', error_code = 'timeout', completed_at = now(), locked_until = null
    where status = 'processing' and locked_until < now() and attempts >= 3;
  for r in
    select j.*, fp.reference_storage_path, fp.status as profile_status from public.face_search_jobs j join public.face_profiles fp on fp.id = j.face_profile_id
    where j.status = 'queued' order by j.created_at limit greatest(1, least(coalesce(p_limit, 5), 20)) for update of j skip locked
  loop
    if not public.smart_album_face_enabled(r.event_id) or r.profile_status not in ('pending', 'ready') or r.reference_storage_path is null
       or not exists (select 1 from public.face_consents c where c.event_id = r.event_id and c.user_id = r.user_id and c.revoked_at is null) then
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
create function public.smart_album_worker_complete(p_job uuid, p_matches jsonb, p_processed int, p_engine text) returns int
language plpgsql security definer set search_path = '' as $$
declare j public.face_search_jobs; ids uuid[]; n int;
begin
  select * into j from public.face_search_jobs where id = p_job for update;
  if j.id is null or j.status <> 'processing' then raise exception 'invalid' using errcode = 'MM005'; end if;
  if p_engine is null or p_engine !~ '^[a-z0-9._-]{1,40}$' or jsonb_typeof(coalesce(p_matches, '[]')) <> 'array' then raise exception 'invalid' using errcode = 'MM005'; end if;
  if not public.smart_album_face_enabled(j.event_id)
     or not exists (select 1 from public.face_consents c where c.event_id = j.event_id and c.user_id = j.user_id and c.revoked_at is null) then
    update public.face_search_jobs set status = 'cancelled', error_code = 'gate_closed', completed_at = now(), locked_until = null where id = j.id;
    return 0;
  end if;
  ids := public.smart_album_eligible_photo_ids(j.event_id, j.user_id);
  insert into public.face_photo_matches (event_id, user_id, photo_id, face_profile_id, job_id, confidence_band)
    select j.event_id, j.user_id, (m ->> 'photoId')::uuid, j.face_profile_id, j.id, m ->> 'band'
    from jsonb_array_elements(coalesce(p_matches, '[]')) m
    where (m ->> 'band') in ('probable', 'review') and (m ->> 'photoId') ~ '^[0-9a-f-]{36}$' and (m ->> 'photoId')::uuid = any (ids)
  on conflict (event_id, user_id, photo_id) do update set job_id = excluded.job_id, face_profile_id = excluded.face_profile_id,
    confidence_band = excluded.confidence_band -- hidden_by_user preservado: o que a pessoa ocultou não volta
  ;
  get diagnostics n = row_count;
  update public.face_profiles set status = 'ready', engine_version = p_engine, updated_at = now() where id = j.face_profile_id and status = 'pending';
  update public.face_search_jobs set status = 'completed', processed_count = greatest(0, coalesce(p_processed, 0)), matches_count = n,
    engine_version = p_engine, completed_at = now(), locked_until = null where id = j.id;
  return n;
end $$;
create function public.smart_album_worker_fail(p_job uuid, p_error text, p_reference_invalid boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare j public.face_search_jobs; st text;
begin
  if p_error is null or p_error !~ '^[a-z_]{1,40}$' then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into j from public.face_search_jobs where id = p_job for update;
  if j.id is null or j.status <> 'processing' then raise exception 'invalid' using errcode = 'MM005'; end if;
  if coalesce(p_reference_invalid, false) then
    insert into public.storage_purge_queue (path, bucket)
      select fp.reference_storage_path, 'face-references' from public.face_profiles fp where fp.id = j.face_profile_id and fp.reference_storage_path is not null
      on conflict do nothing;
    update public.face_profiles set status = 'error', error_code = p_error, reference_storage_path = null, updated_at = now() where id = j.face_profile_id;
    st := 'failed';
  else
    st := case when j.attempts < 3 then 'queued' else 'failed' end;
  end if;
  update public.face_search_jobs set status = st, error_code = p_error, locked_until = null,
    completed_at = case when st = 'failed' then now() end where id = j.id;
  return st;
end $$;
create function public.smart_album_expire() returns int
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
           or (p.user_id is null and e.host_id is distinct from fp.user_id)) -- saiu do evento / conta excluída / evento excluído
  loop
    update public.face_consents set revoked_at = now(), revoked_reason = r.why where event_id = r.event_id and user_id = r.user_id and revoked_at is null;
    perform public.smart_album_erase(r.event_id, r.user_id, r.why);
    n := n + 1;
  end loop;
  delete from public.face_search_jobs where expires_at < now() and status in ('completed', 'failed', 'cancelled')
    and not exists (select 1 from public.face_photo_matches m where m.job_id = face_search_jobs.id);
  return n;
end $$;
create function public.face_profiles_purge_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.reference_storage_path is not null then
    insert into public.storage_purge_queue (path, bucket) values (old.reference_storage_path, 'face-references') on conflict do nothing;
  end if;
  return old;
end $$;
create trigger face_profiles_purge_on_delete before delete on public.face_profiles for each row execute function public.face_profiles_purge_on_delete();
revoke execute on function public.smart_album_ui_enabled(uuid), public.smart_album_legal_gate(), public.smart_album_face_consent_version(),
  public.smart_album_face_enabled(uuid), public.smart_album_set_item(uuid, text, boolean), public.smart_album_my_items(uuid),
  public.face_consents_append_only(), public.can_upload_face_reference(text), public.smart_album_can_use(uuid),
  public.smart_album_erase(uuid, uuid, text), public.smart_album_state(uuid), public.smart_album_grant_face_consent(uuid, text, text, boolean),
  public.smart_album_begin_reference(uuid, text), public.smart_album_request_search(uuid, text),
  public.smart_album_list_matches(uuid, int, timestamptz), public.smart_album_hide_match(uuid, uuid), public.smart_album_revoke_face(uuid),
  public.smart_album_eligible_photo_ids(uuid, uuid), public.smart_album_worker_claim(int), public.smart_album_worker_complete(uuid, jsonb, int, text),
  public.smart_album_worker_fail(uuid, text, boolean), public.smart_album_expire(), public.smart_album_audit(uuid, text, jsonb),
  public.face_profiles_purge_on_delete()
  from public, anon;
revoke execute on function public.smart_album_erase(uuid, uuid, text), public.smart_album_eligible_photo_ids(uuid, uuid),
  public.smart_album_worker_claim(int), public.smart_album_worker_complete(uuid, jsonb, int, text),
  public.smart_album_worker_fail(uuid, text, boolean), public.smart_album_expire(), public.face_consents_append_only(),
  public.smart_album_audit(uuid, text, jsonb), public.face_profiles_purge_on_delete()
  from authenticated;
grant execute on function public.smart_album_ui_enabled(uuid), public.smart_album_face_enabled(uuid), public.smart_album_set_item(uuid, text, boolean),
  public.smart_album_my_items(uuid), public.can_upload_face_reference(text), public.smart_album_can_use(uuid), public.smart_album_state(uuid),
  public.smart_album_grant_face_consent(uuid, text, text, boolean), public.smart_album_begin_reference(uuid, text),
  public.smart_album_request_search(uuid, text), public.smart_album_list_matches(uuid, int, timestamptz), public.smart_album_hide_match(uuid, uuid),
  public.smart_album_revoke_face(uuid)
  to authenticated;
grant execute on function public.smart_album_worker_claim(int), public.smart_album_worker_complete(uuid, jsonb, int, text),
  public.smart_album_worker_fail(uuid, text, boolean), public.smart_album_expire(), public.smart_album_eligible_photo_ids(uuid, uuid)
  to service_role;
insert into supabase_migrations.schema_migrations (version, name) values ('20261116000200', 'smart_album'), ('20261116000300', 'smart_album_activation') on conflict (version) do nothing;
commit;
