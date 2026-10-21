-- MemoriesMT · 2/6 · RLS (todas as tabelas expostas), privilégios mínimos e RPCs.
-- Princípio: o cliente nunca decide permissão. Escritas sensíveis passam por RPC security definer com search_path fixo.

-- ---------------------------------------------------------------- privilégios mínimos
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.invitations enable row level security;
alter table public.participants enable row level security;
alter table public.photos enable row level security;
alter table public.photo_reports enable row level security;
alter table public.reactions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.storage_purge_queue enable row level security;

grant select, update (display_name) on public.profiles to authenticated;
grant select, insert, update on public.events to authenticated;
grant select on public.invitations to authenticated;
grant select, update, delete on public.participants to authenticated;
grant select, update on public.photos to authenticated;
grant select, insert, update, delete on public.reactions to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant insert on public.storage_purge_queue to authenticated; -- só por trigger (policy abaixo)
-- photo_reports, rate_limits, account_deletion_requests: sem acesso direto (só RPC/serviço)

-- ---------------------------------------------------------------- policies
create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy events_select on public.events for select to authenticated
  using (deleted_at is null and (host_id = (select auth.uid()) or public.is_member(id) or public.is_master()));
-- criar evento exige conta (organizador com Google): convidado anônimo não cria
create policy events_insert on public.events for insert to authenticated
  with check (host_id = (select auth.uid()) and not public.is_anonymous());
create policy events_update on public.events for update to authenticated
  using (host_id = (select auth.uid()) and deleted_at is null) with check (host_id = (select auth.uid()));

create policy invitations_host_select on public.invitations for select to authenticated using (public.is_host(event_id));

create policy participants_select on public.participants for select to authenticated
  using (user_id = (select auth.uid()) or public.is_host(event_id) or public.is_member(event_id) or public.is_master());
create policy participants_update on public.participants for update to authenticated
  using (user_id = (select auth.uid()) or public.is_host(event_id)) with check (user_id = (select auth.uid()) or public.is_host(event_id));
create policy participants_delete on public.participants for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_host(event_id));

-- fotos: sem INSERT direto (begin_photo/finalize_photo); update só do host (moderação), colunas travadas por trigger
create policy photos_select on public.photos for select to authenticated using (public.can_see_photo(id));
create policy photos_host_update on public.photos for update to authenticated
  using (public.is_host(event_id)) with check (public.is_host(event_id));

-- reações: só de fotos que a pessoa pode ver (a mesma regra de photos)
create policy reactions_select on public.reactions for select to authenticated using (public.can_see_photo(photo_id));
create policy reactions_insert on public.reactions for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_see_photo(photo_id));
create policy reactions_update on public.reactions for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()) and public.can_see_photo(photo_id));
create policy reactions_delete on public.reactions for delete to authenticated using (author_id = (select auth.uid()));

-- escrita de auditoria e da fila de limpeza: somente de dentro de triggers do próprio banco (nunca por chamada direta)
create policy audit_trigger_insert on public.audit_logs for insert to authenticated
  with check (pg_trigger_depth() > 0 and actor_id is not distinct from (select auth.uid()));
create policy purge_trigger_insert on public.storage_purge_queue for insert to authenticated with check (pg_trigger_depth() > 0);

create policy audit_host_select on public.audit_logs for select to authenticated using (public.is_host(event_id) or public.is_master());

-- ---------------------------------------------------------------- RPCs
-- prévia do convite: o mínimo, sem pessoas, fotos nem dados de revelação
create function public.event_preview(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events; n int;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into e from public.events where code = upper(btrim(p_code)) and deleted_at is null;
  if not found then return null; end if;
  select count(*) into n from public.participants where event_id = e.id;
  return jsonb_build_object(
    'code', e.code, 'title', e.title, 'category', e.category, 'hostName', e.host_name, 'startAt', e.start_at, 'place', e.place,
    'palette', e.palette, 'eventFont', e.event_font, 'capacity', e.capacity,
    'status', case when now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then 'encerrado' else 'ativo' end,
    'full', e.capacity is not null and n >= e.capacity);
end $$;

-- entrada na festa: código (+ convite opcional), com limite de tentativas, lotação e encerramento no servidor
create function public.join_event(p_code text, p_name text, p_table text default null, p_token text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  e public.events;
  inv public.invitations;
  existing public.participants;
  clean text := btrim(coalesce(p_name, ''));
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

  select * into existing from public.participants where event_id = e.id and user_id = uid;
  if found then
    if existing.blocked_at is not null then raise exception 'forbidden' using errcode = 'MM004'; end if;
    update public.participants set name = clean, table_label = coalesce(p_table, table_label) where event_id = e.id and user_id = uid;
    return jsonb_build_object('role', 'membro', 'eventId', e.id);
  end if;

  if now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then raise exception 'eventended' using errcode = 'MM002'; end if;
  if e.capacity is not null and (select count(*) from public.participants where event_id = e.id) >= e.capacity then
    raise exception 'capacityfull' using errcode = 'MM003';
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
  return jsonb_build_object('role', 'membro', 'eventId', e.id);
end $$;

-- convites do organizador: token imprevisível, só o hash fica guardado
create function public.create_invitation(p_event uuid, p_label text, p_expires timestamptz default null, p_max_uses int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare token text := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'); inv public.invitations;
begin
  if not public.is_host(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  insert into public.invitations (event_id, label, token_hash, expires_at, max_uses)
  values (p_event, left(btrim(p_label), 60), encode(extensions.digest(token, 'sha256'), 'hex'), p_expires, p_max_uses) returning * into inv;
  perform public.audit(p_event, 'invitation.created', jsonb_build_object('invitation', inv.id));
  return jsonb_build_object('id', inv.id, 'token', token); -- o token em claro só existe aqui
end $$;

create function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare inv public.invitations;
begin
  select * into inv from public.invitations where id = p_invitation;
  if not found or not public.is_host(inv.event_id) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  update public.invitations set revoked_at = coalesce(revoked_at, now()) where id = p_invitation;
  perform public.audit(inv.event_id, 'invitation.revoked', jsonb_build_object('invitation', p_invitation));
end $$;

-- rotação do código: o código antigo deixa de valer na hora; quem já entrou continua dentro
create function public.rotate_event_code(p_event uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare new_code text := public.gen_share_code();
begin
  if not public.is_host(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  update public.events set code = new_code where id = p_event;
  perform public.audit(p_event, 'event.code_rotated', '{}');
  return new_code;
end $$;

-- ciclo de vida da foto: begin (linha 'enviando', rolo reservado) → upload no Storage → finalize
create function public.begin_photo(p_id uuid, p_event uuid, p_moment text default 'Agora', p_caption text default null,
                                   p_table text default null, p_captured_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); nm text; existing public.photos;
begin
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

create function public.finalize_photo(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ph public.photos; obj record;
begin
  select * into ph from public.photos where id = p_id for update;
  if not found or ph.author_id is distinct from auth.uid() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if ph.upload_status = 'pronta' then return jsonb_build_object('id', ph.id, 'uploadStatus', 'pronta'); end if;
  select (metadata ->> 'size')::int as size, metadata ->> 'mimetype' as mime into obj from storage.objects
    where bucket_id = 'event-photos' and name = ph.storage_path;
  if not found or obj.size is null or obj.size <= 0 or obj.size > 8388608 or obj.mime not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  update public.photos set upload_status = 'pronta', mime = obj.mime, bytes = obj.size, version = version + 1 where id = p_id; -- trigger ignora campos do cliente; este UPDATE roda como dono
  return jsonb_build_object('id', ph.id, 'uploadStatus', 'pronta');
end $$;

-- denúncia: uma por pessoa e foto
create function public.report_photo(p_photo uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_see_photo(p_photo) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  insert into public.photo_reports (photo_id, user_id) values (p_photo, auth.uid()) on conflict do nothing;
  if found then update public.photos set reports = reports + 1 where id = p_photo; end if;
end $$;

-- contagens sem conteúdo (rolo e espera). O total do convidado não inclui fotos ocultas.
create function public.event_counts(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); host boolean := public.is_host(p_event);
begin
  if not (host or public.is_member(p_event)) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return jsonb_build_object(
    'mine', (select count(*) from public.photos where event_id = p_event and author_id = uid and status <> 'removida' and upload_status in ('enviando', 'pronta')),
    'total', (select count(*) from public.photos where event_id = p_event and upload_status = 'pronta'
              and ((host and status <> 'removida') or (not host and status = 'visivel'))));
end $$;

create function public.delete_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_host(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  insert into public.storage_purge_queue (path)
    select storage_path from public.photos where event_id = p_event
    union all select storage_path || '.thumb' from public.photos where event_id = p_event
  on conflict do nothing;
  update public.photos set deleted_at = now() where event_id = p_event and deleted_at is null;
  update public.events set deleted_at = now() where id = p_event;
  perform public.audit(p_event, 'event.deleted', '{}');
end $$;

-- LGPD: pedido de exclusão (processado pelo serviço, com retenção)
create function public.request_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  insert into public.account_deletion_requests (user_id) values (auth.uid()) on conflict do nothing;
  perform public.audit(null, 'account.deletion_requested', '{}');
end $$;

-- processamento: anonimiza, não apaga indiscriminadamente fotos de outras pessoas (decisão P4)
create function public.process_account_deletion(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.photos set author_id = null, author_name = 'Participante removido' where author_id = p_user;
  delete from public.reactions where author_id = p_user;
  delete from public.participants where user_id = p_user;
  insert into public.storage_purge_queue (path)
    select storage_path from public.photos ph join public.events e on e.id = ph.event_id where e.host_id = p_user
  on conflict do nothing;
  update public.photos set deleted_at = now() where event_id in (select id from public.events where host_id = p_user) and deleted_at is null;
  update public.events set deleted_at = now() where host_id = p_user and deleted_at is null;
  update public.profiles set display_name = '' where id = p_user;
  update public.account_deletion_requests set processed_at = now() where user_id = p_user;
  insert into public.audit_logs (actor_id, event_id, action, detail) values (null, null, 'account.deleted', jsonb_build_object('user', p_user));
end $$;

-- ---------------------------------------------------------------- execução: só o necessário
grant execute on function public.is_master(), public.is_anonymous(), public.is_host(uuid), public.is_member(uuid), public.is_revealed(uuid), public.can_see_photo(uuid) to authenticated;
grant execute on function public.event_preview(text), public.join_event(text, text, text, text), public.create_invitation(uuid, text, timestamptz, int),
  public.revoke_invitation(uuid), public.rotate_event_code(uuid), public.begin_photo(uuid, uuid, text, text, text, timestamptz),
  public.finalize_photo(uuid), public.report_photo(uuid), public.event_counts(uuid), public.delete_event(uuid), public.request_account_deletion() to authenticated;
-- usadas por triggers/defaults que rodam como o usuário; chamada direta é recusada dentro delas
grant execute on function public.audit(uuid, text, jsonb), public.enqueue_purge(text), public.gen_share_code(), public.event_end(timestamptz, numeric, timestamptz) to authenticated;
-- check_rate_limit e process_account_deletion: sem EXECUTE para clientes (só RPCs definer e o serviço)
-- o PUBLIC padrão do Postgres dá EXECUTE a todo mundo em função nova: tira de public e anon (authenticated mantém só os grants acima)
revoke execute on all functions in schema public from public, anon;
