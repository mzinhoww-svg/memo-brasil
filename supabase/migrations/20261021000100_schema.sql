-- MemoriesMT · 1/6 · schema, tipos, funções de autorização e triggers de integridade.
-- Segue docs/supabase/INTEGRATION-PLAN.md (v2) e DECISIONS.md. Códigos de erro de domínio (SQLSTATE próprio):
--   MM001 shotlimitreached · MM002 eventended · MM003 capacityfull · MM004 forbidden · MM005 invalid
--   MM006 ratelimited · MM007 invalidinvite · MM008 revealed (revelação já aconteceu) · MM009 reopenforbidden

create type public.reveal_status as enum ('desativada', 'pendente', 'revelada');
create type public.photo_status as enum ('visivel', 'oculta', 'removida');
create type public.upload_status as enum ('enviando', 'pronta', 'falhou');
create type public.reaction_kind as enum ('amei', 'esse-momento', 'risada', 'uau');

-- ---------------------------------------------------------------- funções puras
create function public.gen_share_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- sem 0 O 1 I L (AC-02)
  bytes bytea := extensions.gen_random_bytes(8);
  out text := '';
begin
  for i in 0..7 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return out;
end $$;

-- fim efetivo do evento: "Encerrar agora" só antecipa, nunca estende além do planejado
create function public.event_end(p_start timestamptz, p_hours numeric, p_ended timestamptz) returns timestamptz
language sql immutable set search_path = '' as $$
  select least(coalesce(p_ended, p_start + p_hours * interval '1 hour'), p_start + p_hours * interval '1 hour')
$$;

-- ---------------------------------------------------------------- tabelas
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.gen_share_code() check (code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  category text not null check (category in ('casamento', 'aniversario', 'formatura', 'corporativo', 'outro')),
  host_id uuid not null references public.profiles,
  host_name text not null default '',
  start_at timestamptz not null default now(),
  duration_hours numeric not null check (duration_hours >= 0.5 and duration_hours <= 24 * 30),
  ended_at timestamptz,
  camera_style text not null default 'original',
  reveal_enabled boolean not null default false,
  reveal_at timestamptz,
  reveal_anchor text not null default 'fim' check (reveal_anchor in ('fim', 'data')),
  reveal_offset_days int not null default 0 check (reveal_offset_days between 0 and 30),
  timezone text not null default 'America/Cuiaba',
  reveal_status public.reveal_status not null default 'desativada',
  revealed_at timestamptz,
  capacity int check (capacity is null or capacity between 1 and 1000),
  shots_per_person int check (shots_per_person is null or shots_per_person between 1 and 1000),
  everyone_sees_all boolean not null default true,
  reactions_enabled boolean not null default true,
  palette text not null default 'salvia',
  event_font text not null default 'birthstone',
  place text check (place is null or char_length(place) <= 120),
  moments text[] not null default '{}',
  tables int not null default 0 check (tables between 0 and 200),
  notice jsonb,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint reveal_needs_date check (not reveal_enabled or reveal_at is not null)
);
create index events_host_idx on public.events (host_id) where deleted_at is null;
create index events_reveal_due_idx on public.events (reveal_at) where reveal_enabled and revealed_at is null and deleted_at is null;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  token_hash text not null unique, -- sha256 do token; o token em claro só é mostrado uma vez
  expires_at timestamptz,
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_event_idx on public.invitations (event_id);

create table public.participants (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  table_label text check (table_label is null or char_length(table_label) <= 60),
  invitation_id uuid references public.invitations on delete set null,
  joined_at timestamptz not null default now(),
  blocked_at timestamptz,
  primary key (event_id, user_id)
);
create index participants_user_idx on public.participants (user_id);

create table public.photos (
  id uuid primary key,
  event_id uuid not null references public.events on delete cascade,
  author_id uuid references public.profiles on delete set null, -- nullable: importação e exclusão de conta
  author_name text not null check (char_length(author_name) <= 80),
  moment text not null default 'Agora' check (char_length(moment) <= 60),
  caption text check (caption is null or char_length(caption) <= 280),
  table_label text check (table_label is null or char_length(table_label) <= 60),
  status public.photo_status not null default 'visivel',
  reports int not null default 0,
  highlighted boolean not null default false,
  upload_status public.upload_status not null default 'enviando',
  captured_at timestamptz,
  created_at timestamptz not null default now(), -- horário do servidor
  storage_path text not null,
  mime text,
  bytes int check (bytes is null or bytes between 1 and 8388608),
  version int not null default 1,
  deleted_at timestamptz,
  constraint photos_path_matches check (storage_path = event_id::text || '/' || id::text)
);
create index photos_feed_idx on public.photos (event_id, created_at desc, id desc) where deleted_at is null;
create index photos_author_idx on public.photos (event_id, author_id) where deleted_at is null;
create index photos_pending_idx on public.photos (created_at) where upload_status <> 'pronta';

create table public.photo_reports (
  photo_id uuid not null references public.photos on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

create table public.reactions (
  photo_id uuid not null references public.photos on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  kind public.reaction_kind not null,
  primary key (photo_id, author_id)
);
create index reactions_event_idx on public.reactions (event_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  event_id uuid,
  action text not null,
  detail jsonb not null default '{}'
);
create index audit_logs_event_idx on public.audit_logs (event_id, at desc);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);

create table public.account_deletion_requests (
  user_id uuid primary key,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.storage_purge_queue (
  path text primary key,
  queued_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- autorização (security definer, search_path fixo)
create function public.is_master() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'master'
$$;

create function public.is_anonymous() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create function public.is_host(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event and e.host_id = auth.uid() and e.deleted_at is null)
$$;

create function public.is_member(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants p join public.events e on e.id = p.event_id
    where p.event_id = p_event and p.user_id = auth.uid() and p.blocked_at is null and e.deleted_at is null)
$$;

-- revelação monotônica: revealed_at uma vez gravado vale para sempre; o espelho reveal_status NUNCA decide acesso
create function public.is_revealed(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event and (not e.reveal_enabled or e.revealed_at is not null or now() >= e.reveal_at))
$$;

-- a mesma regra da interface (visiblePhotos): host vê todas não removidas; membro só visíveis e reveladas
create function public.can_see_photo(p_photo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.photos ph join public.events e on e.id = ph.event_id
    where ph.id = p_photo and ph.deleted_at is null and ph.upload_status = 'pronta' and ph.status <> 'removida' and e.deleted_at is null
      and (
        e.host_id = auth.uid()
        or (ph.status = 'visivel' and public.is_member(e.id) and public.is_revealed(e.id)
            and (e.everyone_sees_all or ph.author_id = auth.uid()))))
$$;

-- ---------------------------------------------------------------- auditoria e limites
-- audit e enqueue_purge são SECURITY INVOKER de propósito: o INSERT passa pela RLS da tabela, e as policies só aceitam
-- escrita com pg_trigger_depth() > 0 (ou pelo dono, nas RPCs definer). Chamada direta do cliente é negada pela RLS.
create function public.audit(p_event uuid, p_action text, p_detail jsonb default '{}') returns void
language sql set search_path = '' as $$
  insert into public.audit_logs (actor_id, event_id, action, detail) values (auth.uid(), p_event, p_action, coalesce(p_detail, '{}'))
$$;

create function public.enqueue_purge(p_path text) returns void
language sql set search_path = '' as $$
  insert into public.storage_purge_queue (path) values (p_path), (p_path || '.thumb') on conflict do nothing
$$;

create function public.check_rate_limit(p_key text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.rate_limits;
begin
  insert into public.rate_limits as t (key) values (p_key)
  on conflict (key) do update
    set window_start = case when t.window_start < now() - p_window then now() else t.window_start end,
        hits = case when t.window_start < now() - p_window then 1 else t.hits + 1 end
  returning * into r;
  if r.hits > p_max then
    raise exception 'ratelimited' using errcode = 'MM006';
  end if;
end $$;

-- ---------------------------------------------------------------- perfil automático
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- eventos: integridade e autoridade do servidor
create function public.events_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  privileged boolean := current_user not in ('authenticated', 'anon');
  was_revealed boolean;
  new_end timestamptz := public.event_end(new.start_at, new.duration_hours, new.ended_at);
begin
  if tg_op = 'INSERT' then
    new.version := 1; new.created_at := now(); new.updated_at := now();
    if not privileged then new.revealed_at := null; new.deleted_at := null; end if;
    if new.reveal_enabled and new.reveal_anchor = 'fim' then
      new.reveal_at := new_end + new.reveal_offset_days * interval '1 day';
    end if;
    if not new.reveal_enabled then new.reveal_at := null; end if;
    new.reveal_status := case when not new.reveal_enabled then 'desativada' else 'pendente' end;
    return new;
  end if;

  -- imutáveis para o cliente
  if not privileged then
    new.host_id := old.host_id; new.created_at := old.created_at; new.code := old.code; new.deleted_at := old.deleted_at;
    new.revealed_at := old.revealed_at; new.reveal_status := old.reveal_status;
  end if;
  if new.revealed_at is distinct from old.revealed_at and old.revealed_at is not null then
    new.revealed_at := old.revealed_at; -- monotônico: nunca volta a null (BG-102)
  end if;

  was_revealed := old.reveal_enabled and (old.revealed_at is not null or now() >= old.reveal_at);
  -- ligar a revelação com fotos já visíveis esconderia o que já foi visto (regra canEditReveal do domínio)
  if not old.reveal_enabled and new.reveal_enabled and exists (select 1 from public.photos p where p.event_id = old.id and p.status <> 'removida') then
    raise exception 'revealed' using errcode = 'MM008';
  end if;
  if was_revealed and (new.reveal_enabled is distinct from old.reveal_enabled or new.reveal_at is distinct from old.reveal_at
      or new.reveal_anchor is distinct from old.reveal_anchor or new.reveal_offset_days is distinct from old.reveal_offset_days) then
    raise exception 'revealed' using errcode = 'MM008'; -- não esconde de novo o que já foi visto
  end if;

  -- álbum encerrado com fotos não reabre (AC-11)
  if now() >= public.event_end(old.start_at, old.duration_hours, old.ended_at) and new_end > public.event_end(old.start_at, old.duration_hours, old.ended_at)
     and exists (select 1 from public.photos p where p.event_id = old.id and p.status <> 'removida') then
    raise exception 'reopenforbidden' using errcode = 'MM009';
  end if;

  if new.reveal_enabled and not was_revealed then
    if new.reveal_anchor = 'fim' then
      new.reveal_at := new_end + new.reveal_offset_days * interval '1 day'; -- relativo ao fim: o servidor recalcula (BG-101)
    elsif new.reveal_at is distinct from old.reveal_at and new.reveal_at < now() + interval '1 minute' then
      raise exception 'invalid' using errcode = 'MM005';
    end if;
  end if;
  if not new.reveal_enabled then new.reveal_at := null; end if;
  if privileged then null; else
    new.reveal_status := case when not new.reveal_enabled then 'desativada' when new.revealed_at is not null then 'revelada' else 'pendente' end;
  end if;

  if new.reveal_at is distinct from old.reveal_at or new.reveal_enabled is distinct from old.reveal_enabled then
    perform public.audit(old.id, 'reveal.configured', jsonb_build_object('enabled', new.reveal_enabled, 'at', new.reveal_at, 'anchor', new.reveal_anchor));
  end if;
  new.version := old.version + 1; new.updated_at := now();
  return new;
end $$;
create trigger events_guard_ins before insert on public.events for each row execute function public.events_guard();
create trigger events_guard_upd before update on public.events for each row execute function public.events_guard();

-- ---------------------------------------------------------------- fotos: rolo, encerramento, imutabilidade
create function public.photos_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  e public.events;
  privileged boolean := current_user not in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    select * into e from public.events where id = new.event_id and deleted_at is null;
    if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
    if not privileged then
      if new.author_id is distinct from auth.uid() then raise exception 'forbidden' using errcode = 'MM004'; end if;
      new.status := 'visivel'; new.upload_status := 'enviando'; new.reports := 0; new.highlighted := false; new.mime := null; new.bytes := null; new.deleted_at := null;
    end if;
    new.created_at := now(); new.version := 1;
    if now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then
      raise exception 'eventended' using errcode = 'MM002';
    end if;
    if e.shots_per_person is not null and new.author_id is not null then
      perform pg_advisory_xact_lock(hashtextextended(new.event_id::text || new.author_id::text, 0)); -- serializa o rolo da pessoa
      if (select count(*) from public.photos p
          where p.event_id = new.event_id and p.author_id = new.author_id and p.status <> 'removida' and p.upload_status in ('enviando', 'pronta')) >= e.shots_per_person then
        raise exception 'shotlimitreached' using errcode = 'MM001';
      end if;
    end if;
    return new;
  end if;

  if not privileged then
    -- cliente só muda moderação (host); todo o resto é imutável
    new.id := old.id; new.event_id := old.event_id; new.author_id := old.author_id; new.author_name := old.author_name; new.moment := old.moment;
    new.caption := old.caption; new.table_label := old.table_label; new.created_at := old.created_at; new.captured_at := old.captured_at;
    new.storage_path := old.storage_path; new.mime := old.mime; new.bytes := old.bytes; new.upload_status := old.upload_status;
    new.reports := old.reports; new.deleted_at := old.deleted_at;
  end if;
  if new.status is distinct from old.status or new.highlighted is distinct from old.highlighted then
    perform public.audit(old.event_id, 'photo.moderated', jsonb_build_object('photo', old.id, 'from', old.status, 'to', new.status, 'highlighted', new.highlighted));
  end if;
  if new.status = 'removida' and old.status <> 'removida' then
    new.deleted_at := now();
    perform public.enqueue_purge(old.storage_path);
  end if;
  new.version := old.version + 1;
  return new;
end $$;
create trigger photos_guard_ins before insert on public.photos for each row execute function public.photos_guard();
create trigger photos_guard_upd before update on public.photos for each row execute function public.photos_guard();

-- reação: o evento vem sempre da foto (cliente não escolhe) e só com reações ligadas
create function public.reactions_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e public.events;
begin
  select ev.* into e from public.photos ph join public.events ev on ev.id = ph.event_id where ph.id = new.photo_id;
  if not found or not e.reactions_enabled then raise exception 'forbidden' using errcode = 'MM004'; end if;
  new.event_id := e.id;
  return new;
end $$;
create trigger reactions_guard_ins before insert or update on public.reactions for each row execute function public.reactions_guard();

-- participante: o cliente nunca mexe em blocked_at nem na origem da entrada
create function public.participants_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and tg_op = 'UPDATE' then
    new.event_id := old.event_id; new.user_id := old.user_id; new.joined_at := old.joined_at; new.invitation_id := old.invitation_id;
    if not public.is_host(old.event_id) then new.blocked_at := old.blocked_at; end if;
    if new.blocked_at is distinct from old.blocked_at then
      perform public.audit(old.event_id, case when new.blocked_at is null then 'participant.unblocked' else 'participant.blocked' end, jsonb_build_object('user', old.user_id));
    end if;
  end if;
  return new;
end $$;
create trigger participants_guard_upd before update on public.participants for each row execute function public.participants_guard();
