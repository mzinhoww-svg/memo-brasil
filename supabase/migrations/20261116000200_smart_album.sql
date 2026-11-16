-- Revela Smart Album · Minhas Fotos. ADITIVA: só cria tabelas, funções, bucket e políticas novas; nenhuma tabela/política existente muda.
--
-- Duas camadas independentes, ambas DESLIGADAS por padrão (sem linha em feature_flags = desligado):
--   1. Álbum pessoal sem biometria (chave `smart_album_ui`): favoritas e seleção manual. A foto só entra/sai pela RPC e só é listada se
--      `can_see_photo` (o mesmo ponto de decisão da galeria, das URLs assinadas e do Storage) ainda valer para quem pergunta.
--   2. Busca facial voluntária (chave `smart_album_face_matching`) — exige TODAS as condições abaixo, verificadas no servidor:
--      a) chave ligada E o evento na allowlist `rollout.events` (o master só inclui eventos adultos e elegíveis);
--      b) gate jurídico `platform_settings['smart_album.legal_gate'].approved = true` com referência do parecer (`opinion_ref`) e aprovador;
--      c) texto de consentimento biométrico em versão APROVADA (`face_consent_documents.approved`), hoje só existe o rascunho → impossível
--         consentir até a revisão jurídica publicar uma versão aprovada;
--      d) conta Google (sessão anônima não consente: sem identidade estável não há revogação/exclusão confiável);
--      e) evento revelado (nada é analisado nem devolvido antes da revelação).
--   O resultado da busca (face_photo_matches) NUNCA concede acesso: toda leitura revalida `can_see_photo` + `is_revealed` com o auth.uid() real.
--
-- Nenhum embedding/template é guardado no banco (estratégia A, on-demand). A imagem de referência vive no bucket privado `face-references`,
-- sem política de leitura/remoção para usuários; só o worker (service_role) lê. Revogação/expiração enfileiram a purga em storage_purge_queue.
-- Códigos novos: MM019 (busca facial indisponível: chave/gate/allowlist/versão), MM020 (consentimento biométrico ausente ou revogado).

-- ===================================================================================================================== chaves
create function public.smart_album_ui_enabled(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.feature_flags f
    where f.key = 'smart_album_ui' and f.enabled
      and (not (f.rollout ? 'events') or (f.rollout -> 'events') ? p_event::text))
$$;

-- gate jurídico: aprovação explícita registrada pelo master (admin_set_setting já exige aal/justificativa e é auditada)
create function public.smart_album_legal_gate() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_settings s
    where s.key = 'smart_album.legal_gate'
      and (s.value ->> 'approved') = 'true'
      and char_length(coalesce(s.value ->> 'opinion_ref', '')) >= 3
      and char_length(coalesce(s.value ->> 'approved_by', '')) >= 3)
$$;

create table public.face_consent_documents (
  version text primary key check (char_length(version) between 1 and 60),
  approved boolean not null default false,
  published_at timestamptz not null default now()
);
-- rascunho para revisão jurídica: NÃO aprovado. Publicar uma versão aprovada é ato do responsável jurídico (via SQL/migração própria).
insert into public.face_consent_documents (version, approved) values ('2026-11-16-rascunho', false);
alter table public.face_consent_documents enable row level security;
revoke all on public.face_consent_documents from anon, authenticated;

create function public.smart_album_face_consent_version() returns text
language sql stable security definer set search_path = '' as $$
  select d.version from public.face_consent_documents d where d.approved order by d.published_at desc, d.version desc limit 1
$$;

create function public.smart_album_face_enabled(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.feature_flags f
      where f.key = 'smart_album_face_matching' and f.enabled and (f.rollout -> 'events') ? p_event::text)
    and public.smart_album_legal_gate()
    and public.smart_album_face_consent_version() is not null
    and exists (select 1 from public.events e where e.id = p_event and e.deleted_at is null)
$$;

-- ===================================================================================================================== álbum pessoal (sem biometria)
create table public.personal_photo_items (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  photo_id uuid not null references public.photos on delete cascade,
  kind text not null check (kind in ('favorite', 'selected')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, photo_id, kind)
);
create index personal_photo_items_user_idx on public.personal_photo_items (user_id, event_id, created_at desc);
alter table public.personal_photo_items enable row level security;
revoke all on public.personal_photo_items from anon, authenticated;
grant select on public.personal_photo_items to authenticated;
create policy personal_photo_items_own_read on public.personal_photo_items for select to authenticated
  using (user_id = (select auth.uid()) and public.can_see_photo(photo_id));
-- sem INSERT/UPDATE/DELETE direto: só smart_album_set_item()

create function public.smart_album_set_item(p_photo uuid, p_kind text, p_on boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ev uuid;
begin
  if uid is null or p_photo is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_kind is null or p_kind not in ('favorite', 'selected') or p_on is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  select ph.event_id into ev from public.photos ph where ph.id = p_photo;
  -- mesma resposta para foto inexistente e foto que a pessoa não vê: não revela a existência
  if ev is null or not public.can_see_photo(p_photo) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.smart_album_ui_enabled(ev) then raise exception 'disabled' using errcode = 'MM019'; end if;
  perform public.check_rate_limit('sa_item:' || uid::text, 240, interval '1 minute');
  if p_on then
    insert into public.personal_photo_items (event_id, user_id, photo_id, kind) values (ev, uid, p_photo, p_kind) on conflict do nothing;
  else
    delete from public.personal_photo_items where event_id = ev and user_id = uid and photo_id = p_photo and kind = p_kind;
  end if;
  return p_on;
end $$;

create function public.smart_album_my_items(p_event uuid) returns table (photo_id uuid, kind text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.photo_id, i.kind, i.created_at from public.personal_photo_items i
  where i.event_id = p_event and i.user_id = auth.uid() and auth.uid() is not null
    and public.smart_album_ui_enabled(p_event) and public.can_see_photo(i.photo_id)
  order by i.created_at desc
$$;

-- ===================================================================================================================== busca facial (infra, desligada)
create table public.face_consents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  purpose text not null default 'smart_album_face_search' check (purpose = 'smart_album_face_search'),
  consent_version text not null references public.face_consent_documents (version),
  retention_policy_version text not null default 'smart-album-retencao-rascunho',
  source text not null check (source in ('google', 'upload', 'camera')),
  method text not null default 'checkbox_explicito' check (method = 'checkbox_explicito'),
  self_attested boolean not null check (self_attested),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason is null or revoked_reason in ('usuario', 'expirado', 'bloqueado', 'versao'))
);
create unique index face_consents_one_active on public.face_consents (event_id, user_id) where revoked_at is null;
create index face_consents_user_idx on public.face_consents (user_id, event_id, granted_at desc);

-- histórico append-only: a única mudança aceita é registrar a revogação (uma vez)
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

create table public.face_profiles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  consent_id uuid not null references public.face_consents on delete cascade,
  reference_source text not null check (reference_source in ('google', 'upload', 'camera')),
  reference_storage_path text,
  engine_version text check (engine_version is null or engine_version ~ '^[a-z0-9._-]{1,40}$'),
  status text not null default 'pending' check (status in ('pending', 'ready', 'disabled', 'erasing', 'erased', 'error')),
  error_code text check (error_code is null or error_code ~ '^[a-z_]{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint face_profiles_path check (reference_storage_path is null
    or reference_storage_path = event_id::text || '/' || user_id::text || '/' || id::text)
);
create unique index face_profiles_one_active on public.face_profiles (event_id, user_id) where status in ('pending', 'ready');

create table public.face_search_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  face_profile_id uuid not null references public.face_profiles on delete cascade,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,80}$'),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  attempts int not null default 0 check (attempts between 0 and 10),
  eligible_photos_count int check (eligible_photos_count is null or eligible_photos_count >= 0),
  processed_count int not null default 0 check (processed_count >= 0),
  matches_count int not null default 0 check (matches_count >= 0),
  engine_version text check (engine_version is null or engine_version ~ '^[a-z0-9._-]{1,40}$'),
  error_code text check (error_code is null or error_code ~ '^[a-z_]{1,40}$'),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  unique (user_id, idempotency_key)
);
create unique index face_search_jobs_one_active on public.face_search_jobs (event_id, user_id) where status in ('queued', 'processing');
create index face_search_jobs_queue_idx on public.face_search_jobs (created_at) where status = 'queued';

create table public.face_photo_matches (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  photo_id uuid not null references public.photos on delete cascade,
  face_profile_id uuid not null references public.face_profiles on delete cascade,
  job_id uuid not null references public.face_search_jobs on delete cascade,
  confidence_band text not null check (confidence_band in ('probable', 'review')),
  hidden_by_user boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, photo_id)
);

-- nenhuma leitura/escrita direta pelos papéis do cliente: o estado sai só pelas RPCs abaixo (sem caminho de storage, sem score)
alter table public.face_consents enable row level security;
alter table public.face_profiles enable row level security;
alter table public.face_search_jobs enable row level security;
alter table public.face_photo_matches enable row level security;
revoke all on public.face_consents, public.face_profiles, public.face_search_jobs, public.face_photo_matches from anon, authenticated;

-- ===================================================================================================================== storage privado da referência
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('face-references', 'face-references', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

-- enviar: só o titular, no caminho exato do próprio perfil pendente, com busca liberada e consentimento ativo. Sem SELECT/UPDATE/DELETE.
create function public.can_upload_face_reference(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.face_profiles fp join public.face_consents c on c.id = fp.consent_id
    where fp.reference_storage_path = p_name and fp.user_id = auth.uid() and fp.status = 'pending'
      and c.revoked_at is null and public.smart_album_face_enabled(fp.event_id)
      and (public.is_member(fp.event_id) or public.is_host(fp.event_id))
      and not exists (select 1 from storage.objects o where o.bucket_id = 'face-references' and o.name = p_name))
$$;
create policy "face_references_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'face-references' and public.can_upload_face_reference(name));

-- ===================================================================================================================== RPCs do titular
-- Auditoria do Smart Album SEM event_id: a política audit_host_select mostra ao anfitrião as linhas do evento, e quem consentiu/revogou
-- a busca facial não é informação do anfitrião. Master/auditor continuam vendo (event_id vai no detalhe).
create function public.smart_album_audit(p_event uuid, p_action text, p_detail jsonb default '{}') returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, event_id, action, detail)
  values (auth.uid(), null, p_action, coalesce(p_detail, '{}') || jsonb_build_object('event', p_event))
$$;

create function public.smart_album_can_use(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (public.is_member(p_event) or public.is_host(p_event))
$$;

-- apaga tudo que a busca facial produziu para (evento, titular): resultados, jobs ativos e referência (purga assíncrona do objeto)
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

create function public.smart_album_state(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); face boolean; c public.face_consents; fp public.face_profiles; j public.face_search_jobs; revealed boolean; n int := null;
begin
  if not public.smart_album_can_use(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  face := public.smart_album_face_enabled(p_event);
  revealed := public.is_revealed(p_event);
  select * into c from public.face_consents where event_id = p_event and user_id = uid and revoked_at is null;
  select * into fp from public.face_profiles where event_id = p_event and user_id = uid and status in ('pending', 'ready', 'error')
    order by created_at desc limit 1;
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
      'profile', fp.status,
      'source', fp.reference_source,
      'job', case when j.id is null then null else jsonb_build_object('id', j.id, 'status', j.status, 'processed', j.processed_count,
               'eligible', case when revealed then j.eligible_photos_count end, 'errorCode', j.error_code) end,
      'matches', n));
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

-- cria o perfil pendente e devolve o caminho privado onde o cliente envia a referência (uma vez; trocar = novo perfil, o antigo é apagado)
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
  -- troca de referência: resultados e referência anteriores deixam de existir antes do novo perfil
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

-- resultados: só com busca liberada, consentimento ativo e evento revelado; cada foto revalidada por can_see_photo NESTA chamada
create function public.smart_album_list_matches(p_event uuid, p_limit int default 30, p_before timestamptz default null)
returns table (photo_id uuid, band text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if not public.smart_album_can_use(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.smart_album_face_enabled(p_event) then raise exception 'facedisabled' using errcode = 'MM019'; end if;
  if not exists (select 1 from public.face_consents where event_id = p_event and user_id = uid and revoked_at is null) then
    raise exception 'faceconsent' using errcode = 'MM020';
  end if;
  if not public.is_revealed(p_event) then raise exception 'notrevealed' using errcode = 'MM017'; end if;
  return query
    select m.photo_id, m.confidence_band, m.created_at from public.face_photo_matches m
    where m.event_id = p_event and m.user_id = uid and not m.hidden_by_user
      and (p_before is null or m.created_at < p_before) and public.can_see_photo(m.photo_id)
    order by m.created_at desc, m.photo_id
    limit greatest(1, least(coalesce(p_limit, 30), 100));
end $$;

create function public.smart_album_hide_match(p_event uuid, p_photo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if not public.smart_album_can_use(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  update public.face_photo_matches set hidden_by_user = true where event_id = p_event and user_id = uid and photo_id = p_photo;
  if found then perform public.smart_album_audit(p_event, 'smart_album.match_hidden', '{}'::jsonb); end if;
end $$;

-- revogar sempre funciona (mesmo com a busca desligada): retira o consentimento, cancela jobs, apaga resultados e enfileira a referência
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

-- ===================================================================================================================== worker (service_role)
-- Executa uma consulta "como" o titular: as funções de autorização existentes (can_see_photo, is_member, is_revealed) leem auth.uid()
-- de request.jwt.claims. Assim o worker usa exatamente a mesma regra da galeria, sem duplicar lógica.
create function public.smart_album_eligible_photo_ids(p_event uuid, p_user uuid) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare prev text := current_setting('request.jwt.claims', true); prev_sub text := current_setting('request.jwt.claim.sub', true); ids uuid[];
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select coalesce(array_agg(ph.id order by ph.created_at), '{}') into ids from public.photos ph
    where ph.event_id = p_event and public.is_revealed(p_event) and (public.is_member(p_event) or public.is_host(p_event))
      and public.can_see_photo(ph.id);
  perform set_config('request.jwt.claims', coalesce(prev, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(prev_sub, ''), true);
  return ids;
end $$;

create function public.smart_album_worker_claim(p_limit int default 5) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; out jsonb := '[]'::jsonb; ids uuid[];
begin
  -- jobs presos (worker caiu) voltam à fila; o limite de tentativas vale
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

-- p_matches: [{"photoId": uuid, "band": "probable"|"review"}]; fotos fora do conjunto elegível NESTE momento são descartadas
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
    -- referência sem rosto/vários rostos/qualidade: não adianta repetir; a pessoa troca a foto
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

-- expiração (agendar com pg_cron só na ativação): referências vencidas e titulares bloqueados são apagados; jobs antigos somem
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

-- exclusão física (cascata de evento/conta, ou limpeza): a referência ainda guardada entra na fila de purga, nunca fica órfã no bucket
create function public.face_profiles_purge_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.reference_storage_path is not null then
    insert into public.storage_purge_queue (path, bucket) values (old.reference_storage_path, 'face-references') on conflict do nothing;
  end if;
  return old;
end $$;
create trigger face_profiles_purge_on_delete before delete on public.face_profiles for each row execute function public.face_profiles_purge_on_delete();

-- ===================================================================================================================== permissões
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
