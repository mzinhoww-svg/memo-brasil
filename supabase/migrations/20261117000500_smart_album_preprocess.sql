-- Revela Smart Album · pré-processamento durante o evento. ADITIVA.
--
-- Antes: cada pessoa que ativava a busca fazia o motor reanalisar todas as fotos do evento, depois da revelação (N pessoas × M fotos).
-- Agora: cada foto é analisada UMA vez, quando fica pronta, contra as selfies de quem autorizou (consentimento de conta vigente) e
-- participa do evento. Só o resultado (foto, titular, faixa) é gravado; rostos de quem não autorizou são comparados em memória e
-- descartados pelo motor, como antes. Nada de embedding no banco.
--   * As sugestões continuam fechadas até a revelação e filtradas por can_see_photo NA LEITURA (smart_album_list_matches/state).
--   * Na mesma passada o motor classifica a foto sem identificar ninguém: quantidade de rostos (retrato/grupo/sem pessoas) e nitidez.
--   * Quem envia a selfie (ou entra no evento) depois de fotos já analisadas recebe uma busca de recuperação pelo fluxo de jobs.

-- ===================================================================================================================== esquema
create table public.photo_analysis (
  photo_id uuid primary key references public.photos on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  attempts int not null default 0 check (attempts between 0 and 10),
  locked_until timestamptz,
  queued_at timestamptz not null default now(),
  processed_at timestamptz,
  engine_version text check (engine_version is null or engine_version ~ '^[a-z0-9._-]{1,40}$'),
  faces_count int check (faces_count is null or faces_count between 0 and 500),
  kind text check (kind is null or kind in ('retrato', 'grupo', 'sem_pessoas')),
  sharpness real check (sharpness is null or sharpness >= 0)
);
create index photo_analysis_queue_idx on public.photo_analysis (queued_at) where status = 'queued';
create index photo_analysis_event_idx on public.photo_analysis (event_id, status);
alter table public.photo_analysis enable row level security;
revoke all on public.photo_analysis from anon, authenticated;

-- resultado do pré-processamento não nasce de um job
alter table public.face_photo_matches alter column job_id drop not null;

-- foto pronta entra na fila (só em evento com a busca liberada: chave + gate jurídico + termo + organizador)
create function public.photo_analysis_enqueue() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.upload_status = 'pronta' and (tg_op = 'INSERT' or old.upload_status is distinct from new.upload_status)
     and public.smart_album_face_enabled(new.event_id) then
    insert into public.photo_analysis (photo_id, event_id) values (new.id, new.event_id) on conflict (photo_id) do nothing;
  end if;
  return new;
end $$;
create trigger photo_analysis_enqueue after insert or update of upload_status on public.photos
  for each row execute function public.photo_analysis_enqueue();

-- ===================================================================================================================== worker
-- selfies que valem para um evento: consentimento de conta vigente, perfil utilizável com objeto enviado, titular participante (não
-- bloqueado) ou anfitrião
create function public.smart_album_event_references(p_event uuid) returns table (profile_id uuid, user_id uuid, reference_path text)
language sql stable security definer set search_path = '' as $$
  select fp.id, fp.user_id, fp.reference_storage_path
  from public.face_profiles fp
  join public.face_consents c on c.id = fp.consent_id and c.revoked_at is null and c.event_id is null
       and c.consent_version = public.smart_album_face_consent_version()
  join public.events e on e.id = p_event and e.deleted_at is null
  where fp.event_id is null and fp.status in ('pending', 'ready') and fp.reference_storage_path is not null
    and exists (select 1 from storage.objects o where o.bucket_id = 'face-references' and o.name = fp.reference_storage_path)
    and (e.host_id = fp.user_id
         or exists (select 1 from public.participants p where p.event_id = p_event and p.user_id = fp.user_id and p.blocked_at is null))
$$;

create function public.smart_album_worker_claim_photos(p_limit int default 8) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; photos jsonb := '[]'::jsonb; refs jsonb := '[]'::jsonb; evs uuid[] := '{}';
begin
  update public.photo_analysis set status = 'queued', locked_until = null where status = 'processing' and locked_until < now() and attempts < 3;
  update public.photo_analysis set status = 'failed', locked_until = null, processed_at = now() where status = 'processing' and locked_until < now() and attempts >= 3;
  for r in
    select a.photo_id, a.event_id from public.photo_analysis a join public.photos ph on ph.id = a.photo_id
    where a.status = 'queued' and ph.upload_status = 'pronta' and ph.status <> 'removida' and ph.deleted_at is null
      and public.smart_album_face_enabled(a.event_id)
    order by a.queued_at limit greatest(1, least(coalesce(p_limit, 8), 24)) for update of a skip locked
  loop
    update public.photo_analysis set status = 'processing', attempts = attempts + 1, locked_until = now() + interval '10 minutes' where photo_id = r.photo_id;
    photos := photos || jsonb_build_array(jsonb_build_object('photoId', r.photo_id, 'eventId', r.event_id));
    if not r.event_id = any (evs) then
      evs := evs || r.event_id;
      refs := refs || coalesce((select jsonb_agg(jsonb_build_object('eventId', r.event_id, 'profileId', x.profile_id, 'referencePath', x.reference_path))
                                from public.smart_album_event_references(r.event_id) x), '[]'::jsonb);
    end if;
  end loop;
  return jsonb_build_object('photos', photos, 'refs', refs);
end $$;

-- p_results: [{"photoId", "faces", "sharpness", "matches": [{"profileId", "band"}]}]; p_failed: [photoId] (não deu para baixar/abrir);
-- p_ref_errors: [{"profileId", "error"}] (selfie sem rosto / várias pessoas / baixa qualidade). Tudo é revalidado aqui.
create function public.smart_album_worker_complete_photos(p_results jsonb, p_failed jsonb, p_ref_errors jsonb, p_engine text) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb; m jsonb; a public.photo_analysis; fp public.face_profiles; n int := 0; faces int; pid uuid;
begin
  if p_engine is null or p_engine !~ '^[a-z0-9._-]{1,40}$' or jsonb_typeof(coalesce(p_results, '[]')) <> 'array'
     or jsonb_typeof(coalesce(p_failed, '[]')) <> 'array' or jsonb_typeof(coalesce(p_ref_errors, '[]')) <> 'array' then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]')) loop
    if (r ->> 'photoId') !~ '^[0-9a-f-]{36}$' then continue; end if;
    select * into a from public.photo_analysis where photo_id = (r ->> 'photoId')::uuid and status = 'processing' for update;
    if a.photo_id is null then continue; end if;
    faces := least(500, greatest(0, coalesce((r ->> 'faces')::int, 0)));
    update public.photo_analysis set status = 'done', processed_at = now(), locked_until = null, engine_version = p_engine,
      faces_count = faces, kind = case when faces = 0 then 'sem_pessoas' when faces = 1 then 'retrato' else 'grupo' end,
      sharpness = greatest(0, coalesce((r ->> 'sharpness')::real, 0))
      where photo_id = a.photo_id;
    if not public.smart_album_face_enabled(a.event_id) or jsonb_typeof(coalesce(r -> 'matches', '[]')) <> 'array' then continue; end if;
    for m in select * from jsonb_array_elements(coalesce(r -> 'matches', '[]')) loop
      if (m ->> 'band') not in ('probable', 'review') or (m ->> 'profileId') !~ '^[0-9a-f-]{36}$' then continue; end if;
      pid := (m ->> 'profileId')::uuid;
      -- o perfil precisa continuar valendo para ESTE evento agora (consentimento, participação, não bloqueado)
      select f.* into fp from public.face_profiles f join public.smart_album_event_references(a.event_id) x on x.profile_id = f.id where f.id = pid;
      if fp.id is null then continue; end if;
      insert into public.face_photo_matches (event_id, user_id, photo_id, face_profile_id, job_id, confidence_band)
      values (a.event_id, fp.user_id, a.photo_id, fp.id, null, m ->> 'band')
      on conflict (event_id, user_id, photo_id) do update set face_profile_id = excluded.face_profile_id, confidence_band = excluded.confidence_band;
      update public.face_profiles set status = 'ready', engine_version = p_engine, updated_at = now() where id = fp.id and status = 'pending';
      n := n + 1;
    end loop;
  end loop;
  -- foto que não abriu: tenta de novo até 3 vezes
  update public.photo_analysis set status = case when attempts < 3 then 'queued' else 'failed' end, locked_until = null,
      processed_at = case when attempts < 3 then null else now() end
    where status = 'processing' and photo_id in (select (v #>> '{}')::uuid from jsonb_array_elements(coalesce(p_failed, '[]')) v where (v #>> '{}') ~ '^[0-9a-f-]{36}$');
  -- selfie que não serve (ainda nunca usada): a pessoa é avisada em Minhas Fotos e troca a foto
  for m in select * from jsonb_array_elements(coalesce(p_ref_errors, '[]')) loop
    if (m ->> 'profileId') !~ '^[0-9a-f-]{36}$' or (m ->> 'error') not in ('no_face', 'multiple_faces', 'low_quality') then continue; end if;
    select * into fp from public.face_profiles where id = (m ->> 'profileId')::uuid and status = 'pending' and event_id is null for update;
    if fp.id is null then continue; end if;
    if fp.reference_storage_path is not null then
      insert into public.storage_purge_queue (path, bucket) values (fp.reference_storage_path, 'face-references') on conflict do nothing;
    end if;
    update public.face_profiles set status = 'error', error_code = m ->> 'error', reference_storage_path = null, updated_at = now() where id = fp.id;
  end loop;
  return n;
end $$;

-- busca de recuperação (job): só quando existe foto do evento que NÃO foi comparada com esta selfie — analisada antes de a selfie existir
-- ou de a pessoa entrar no evento, ou anterior ao pré-processamento. Foto nova não gera job: entra na fila de análise.
create or replace function public.smart_album_enqueue_auto(p_limit int default 5) returns int
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
    left join public.participants p on p.event_id = e.id and p.user_id = fp.user_id and p.blocked_at is null
    cross join lateral (select greatest(fp.created_at, coalesce(p.joined_at, e.created_at)) as since) s
    where fp.event_id is null and fp.status in ('pending', 'ready') and fp.reference_storage_path is not null
      and (e.host_id = fp.user_id or p.user_id is not null)
      and exists (select 1 from storage.objects o where o.bucket_id = 'face-references' and o.name = fp.reference_storage_path)
      and public.is_revealed(e.id)
      and not exists (select 1 from public.face_search_jobs j where j.event_id = e.id and j.user_id = fp.user_id and j.status in ('queued', 'processing'))
      and exists (
        select 1 from public.photos ph left join public.photo_analysis a on a.photo_id = ph.id
        where ph.event_id = e.id and ph.upload_status = 'pronta' and ph.status <> 'removida' and ph.deleted_at is null
          and (a.photo_id is null or a.status = 'failed' or (a.status = 'done' and a.processed_at < s.since))
          and not exists (select 1 from public.face_search_jobs j where j.event_id = e.id and j.face_profile_id = fp.id and j.created_at >= ph.created_at))
    limit greatest(1, least(coalesce(p_limit, 5), 50))
  loop
    begin
      insert into public.face_search_jobs (event_id, user_id, face_profile_id, idempotency_key)
      values (r.event_id, r.user_id, r.profile_id, 'auto-' || replace(gen_random_uuid()::text, '-', ''));
      n := n + 1;
    exception when unique_violation then null;
    end;
  end loop;
  return n;
end $$;

-- ===================================================================================================================== permissões
revoke execute on function public.photo_analysis_enqueue(), public.smart_album_event_references(uuid), public.smart_album_worker_claim_photos(int),
  public.smart_album_worker_complete_photos(jsonb, jsonb, jsonb, text), public.smart_album_enqueue_auto(int)
  from public, anon, authenticated;
grant execute on function public.smart_album_worker_claim_photos(int), public.smart_album_worker_complete_photos(jsonb, jsonb, jsonb, text),
  public.smart_album_enqueue_auto(int) to service_role;
