-- A01/A05: retire only the identified test offer; keep its price and all financial history.
update public.plans set production_active = false
 where code = 'teste1real' and price_cents = 100 and name in ('Teste', 'Teste R$ 1') and production_active;

-- Host and event authorization are checked by the server, never by client metadata.
create or replace function public.block_participant(p_event uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare ev public.events;
begin
  select * into ev from public.events where id = p_event and deleted_at is null for update;
  if not found or auth.uid() is null or ev.host_id is distinct from auth.uid() or p_user = ev.host_id then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  if not exists(select 1 from public.participants where event_id = p_event and user_id = p_user) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  update public.participants set blocked_at = now() where event_id = p_event and user_id = p_user and blocked_at is null;
  if found then perform public.audit(p_event, 'participant.blocked', jsonb_build_object('user', p_user)); end if;
end $$;

create or replace function public.unblock_participant(p_event uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare ev public.events;
begin
  select * into ev from public.events where id = p_event and deleted_at is null for update;
  if not found or auth.uid() is null or ev.host_id is distinct from auth.uid() or p_user = ev.host_id then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  if not exists(select 1 from public.participants where event_id = p_event and user_id = p_user) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  update public.participants set blocked_at = null where event_id = p_event and user_id = p_user and blocked_at is not null;
  if found then perform public.audit(p_event, 'participant.unblocked', jsonb_build_object('user', p_user)); end if;
end $$;
revoke all on function public.block_participant(uuid, uuid), public.unblock_participant(uuid, uuid) from public, anon;
grant execute on function public.block_participant(uuid, uuid), public.unblock_participant(uuid, uuid) to authenticated;

-- A blocked identity cannot erase its tombstone through the existing self-delete policy.
-- Keep unblocked self-leave, privileged account deletion and event cascades available.
create or replace function public.participants_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then
      if old.blocked_at is not null then raise exception 'blocked' using errcode = 'MM015'; end if;
      return old;
    end if;
    if old.blocked_at is not null and not public.is_host(old.event_id) then raise exception 'blocked' using errcode = 'MM015'; end if;
    new.event_id := old.event_id; new.user_id := old.user_id; new.joined_at := old.joined_at; new.invitation_id := old.invitation_id;
    if not public.is_host(old.event_id) then new.blocked_at := old.blocked_at; end if;
    if new.blocked_at is distinct from old.blocked_at then
      perform public.audit(old.event_id, case when new.blocked_at is null then 'participant.unblocked' else 'participant.blocked' end, jsonb_build_object('user', old.user_id));
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create or replace trigger participants_guard_del before delete on public.participants for each row execute function public.participants_guard();

-- Reuse the existing blocked_at column and join entitlement/capacity logic; MM015 is distinct
-- from financial MM013. Lock the participant row to serialize rejoin and moderation.
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
    perform public.check_rate_limit('badcode:' || uid, 8, interval '10 minutes'); -- tentativa de adivinhar código
    raise exception 'invalid' using errcode = 'MM005';
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
      perform public.check_rate_limit('badinvite:' || uid, 8, interval '10 minutes');
      raise exception 'invalidinvite' using errcode = 'MM007';
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

-- A pending upload must not become publishable after its author is blocked.
create or replace function public.begin_photo(p_id uuid, p_event uuid, p_moment text default 'Agora', p_caption text default null,
                                   p_table text default null, p_captured_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); nm text; existing public.photos;
begin
  perform 1 from public.participants where event_id = p_event and user_id = uid for share;
  if exists(select 1 from public.participants where event_id = p_event and user_id = uid and blocked_at is not null) then
    raise exception 'blocked' using errcode = 'MM015';
  end if;
  if uid is null or not (public.is_host(p_event) or public.is_member(p_event)) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into existing from public.photos where id = p_id;
  if found then -- idempotente: reenvio devolve a mesma linha, sem recontar o rolo
    if existing.author_id is distinct from uid then raise exception 'forbidden' using errcode = 'MM004'; end if;
    return jsonb_build_object('id', existing.id, 'storagePath', existing.storage_path, 'uploadStatus', existing.upload_status);
  end if;
  select coalesce(
    (select p.name from public.participants p where p.event_id = p_event and p.user_id = uid),
    (select nullif(pr.display_name, '') from public.profiles pr where pr.id = uid), 'Anfitrião') into nm;
  insert into public.photos (id, event_id, author_id, author_name, moment, caption, table_label, captured_at, storage_path)
  values (p_id, p_event, uid, nm, left(coalesce(p_moment, 'Agora'), 60), left(p_caption, 280), p_table, p_captured_at, p_event::text || '/' || p_id::text);
  return jsonb_build_object('id', p_id, 'storagePath', p_event::text || '/' || p_id::text, 'uploadStatus', 'enviando');
end $$;

create or replace function public.finalize_photo(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ph public.photos; obj record;
begin
  select * into ph from public.photos where id = p_id for update;
  if not found or ph.author_id is distinct from auth.uid() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform 1 from public.participants where event_id = ph.event_id and user_id = auth.uid() for share;
  if exists(select 1 from public.participants where event_id = ph.event_id and user_id = auth.uid() and blocked_at is not null) then
    raise exception 'blocked' using errcode = 'MM015';
  end if;
  if not (public.is_host(ph.event_id) or public.is_member(ph.event_id)) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if ph.upload_status = 'pronta' then return jsonb_build_object('id', ph.id, 'uploadStatus', 'pronta'); end if;
  select (metadata ->> 'size')::int as size, metadata ->> 'mimetype' as mime into obj from storage.objects
    where bucket_id = 'event-photos' and name = ph.storage_path;
  if not found or obj.size is null or obj.size <= 0 or obj.size > 8388608 or obj.mime not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  update public.photos set upload_status = 'pronta', mime = obj.mime, bytes = obj.size, version = version + 1 where id = p_id; -- trigger ignora campos do cliente; este UPDATE roda como dono
  return jsonb_build_object('id', ph.id, 'uploadStatus', 'pronta');
end $$;

