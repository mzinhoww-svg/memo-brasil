-- Códigos novos desta fase: MM016 stepup (ação exige segundo fator) · MM017 notrevealed (antes da revelação) · MM018 consentrequired.
-- Revela 2.0 · 3/4 · comentários nas fotos. ADITIVA, com RLS.
-- Regras: texto de 1 a 280 caracteres; só depois da revelação; respeita everyone_sees_all (quem não vê a foto não comenta nem lê);
-- curtida de comentário; denúncia (3 denúncias de pessoas diferentes escondem o comentário); moderação pelo anfitrião e pelo Master;
-- limite de frequência por pessoa.
create table public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  author_id uuid references public.profiles on delete set null, -- nulo na exclusão de conta
  author_name text not null check (char_length(author_name) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 280),
  likes int not null default 0 check (likes >= 0),
  reports int not null default 0 check (reports >= 0),
  hidden_at timestamptz,        -- escondido (3 denúncias ou moderação)
  hidden_by text check (hidden_by is null or hidden_by in ('denuncias', 'anfitriao', 'master')),
  deleted_at timestamptz,       -- removido pelo autor, anfitrião ou Master
  created_at timestamptz not null default now()
);
create index photo_comments_photo_idx on public.photo_comments (photo_id, created_at) where deleted_at is null;
create index photo_comments_event_idx on public.photo_comments (event_id) where deleted_at is null;

create table public.comment_likes (
  comment_id uuid not null references public.photo_comments on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  primary key (comment_id, user_id)
);
create table public.comment_reports (
  comment_id uuid not null references public.photo_comments on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.photo_comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.comment_reports enable row level security;
revoke all on public.photo_comments, public.comment_likes, public.comment_reports from public, anon, authenticated;
grant select on public.photo_comments to authenticated;           -- escrita só por RPC
grant select on public.comment_likes to authenticated;            -- cada pessoa só enxerga as próprias curtidas (policy)

-- Quem pode ler: vê a foto (can_see_photo já exige membro, revelação e everyone_sees_all) e o evento está revelado;
-- comentário escondido só aparece para o anfitrião do evento e para o Master.
create function public.can_see_comment(p_comment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.photo_comments c join public.events e on e.id = c.event_id
    where c.id = p_comment and c.deleted_at is null and e.deleted_at is null and public.is_revealed(e.id)
      and (public.is_master()
           or e.host_id = auth.uid()
           or (c.hidden_at is null and public.can_see_photo(c.photo_id))))
$$;
create policy photo_comments_select on public.photo_comments for select to authenticated
  using (public.can_see_comment(id));
create policy comment_likes_select on public.comment_likes for select to authenticated using (user_id = (select auth.uid()));

-- Publicar. Só membro ativo (ou anfitrião), evento revelado, foto visível para quem comenta.
create function public.post_comment(p_photo uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ph public.photos; e public.events; nm text; b text := btrim(coalesce(p_body, '')); cid uuid;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into ph from public.photos where id = p_photo and deleted_at is null;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into e from public.events where id = ph.event_id and deleted_at is null;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  if not (e.host_id = uid or public.is_member(e.id)) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if not public.is_revealed(e.id) then raise exception 'notrevealed' using errcode = 'MM017'; end if;
  if not public.can_see_photo(p_photo) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(b) < 1 or char_length(b) > 280 then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform public.check_rate_limit('comment:' || uid, 20, interval '10 minutes');
  select coalesce(
           (select p.name from public.participants p where p.event_id = e.id and p.user_id = uid),
           case when e.host_id = uid then e.host_name end, 'Convidado') into nm;
  insert into public.photo_comments (photo_id, event_id, author_id, author_name, body)
  values (p_photo, e.id, uid, left(nm, 80), b) returning id into cid;
  return jsonb_build_object('id', cid);
end $$;

-- Lista os comentários de uma foto (curtidas e se eu curti). Escondidos só para anfitrião e Master.
create function public.list_photo_comments(p_photo uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ph public.photos; e public.events; staff boolean;
begin
  select * into ph from public.photos where id = p_photo and deleted_at is null;
  if not found then return '[]'::jsonb; end if;
  select * into e from public.events where id = ph.event_id and deleted_at is null;
  if not found or not public.is_revealed(e.id) then return '[]'::jsonb; end if;
  staff := e.host_id = uid or public.is_master();
  if not (staff or public.can_see_photo(p_photo)) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'photoId', c.photo_id, 'authorId', c.author_id, 'authorName', c.author_name, 'body', c.body, 'likes', c.likes,
      'likedByMe', exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = uid),
      'reportedByMe', exists (select 1 from public.comment_reports r where r.comment_id = c.id and r.user_id = uid),
      'mine', c.author_id = uid, 'hidden', c.hidden_at is not null, 'hiddenBy', c.hidden_by,
      'reports', case when staff then c.reports end, 'createdAt', c.created_at) order by c.created_at, c.id)
    from public.photo_comments c
    where c.photo_id = p_photo and c.deleted_at is null and (staff or c.hidden_at is null)), '[]'::jsonb);
end $$;

-- Contagem de comentários visíveis por foto do evento (feed).
create function public.comment_counts(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); e public.events; staff boolean;
begin
  select * into e from public.events where id = p_event and deleted_at is null;
  if not found or not public.is_revealed(e.id) then return '{}'::jsonb; end if;
  staff := e.host_id = uid or public.is_master();
  if not (staff or public.is_member(e.id)) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return coalesce((select jsonb_object_agg(x.photo_id, x.n) from (
    select c.photo_id, count(*) n from public.photo_comments c
    where c.event_id = p_event and c.deleted_at is null and (staff or c.hidden_at is null) and (staff or public.can_see_photo(c.photo_id))
    group by c.photo_id) x), '{}'::jsonb);
end $$;

create function public.toggle_comment_like(p_comment uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); liked boolean; n int;
begin
  if uid is null or not public.can_see_comment(p_comment) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform public.check_rate_limit('commentlike:' || uid, 120, interval '10 minutes');
  delete from public.comment_likes where comment_id = p_comment and user_id = uid;
  if found then liked := false;
  else insert into public.comment_likes (comment_id, user_id) values (p_comment, uid); liked := true; end if;
  update public.photo_comments set likes = (select count(*) from public.comment_likes where comment_id = p_comment)
   where id = p_comment returning likes into n;
  return jsonb_build_object('liked', liked, 'likes', n);
end $$;

-- Denunciar: uma por pessoa; na 3ª denúncia de pessoas diferentes o comentário some para os convidados.
create function public.report_comment(p_comment uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null or not public.can_see_comment(p_comment) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if exists (select 1 from public.photo_comments where id = p_comment and author_id = uid) then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform public.check_rate_limit('commentreport:' || uid, 30, interval '1 hour');
  insert into public.comment_reports (comment_id, user_id) values (p_comment, uid) on conflict do nothing;
  select count(*) into n from public.comment_reports where comment_id = p_comment;
  update public.photo_comments set reports = n,
         hidden_at = case when n >= 3 and hidden_at is null then now() else hidden_at end,
         hidden_by = case when n >= 3 and hidden_at is null then 'denuncias' else hidden_by end
   where id = p_comment;
  return jsonb_build_object('reports', n, 'hidden', n >= 3);
end $$;

-- Moderação do anfitrião (esconder, mostrar, remover) e do Master (mesmas ações, com justificativa).
create function public.moderate_comment(p_comment uuid, p_action text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.photo_comments; e public.events; by_master boolean; actor text; why text;
begin
  select * into c from public.photo_comments where id = p_comment and deleted_at is null for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into e from public.events where id = c.event_id;
  by_master := public.is_master();
  if not (e.host_id = uid or by_master) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_action not in ('esconder', 'mostrar', 'remover') then raise exception 'invalid' using errcode = 'MM005'; end if;
  actor := case when e.host_id = uid then 'anfitriao' else 'master' end;
  if by_master and actor = 'master' then why := public.admin_reason(p_reason); end if;
  if p_action = 'esconder' then update public.photo_comments set hidden_at = coalesce(hidden_at, now()), hidden_by = actor where id = p_comment;
  elsif p_action = 'mostrar' then update public.photo_comments set hidden_at = null, hidden_by = null, reports = 0 where id = p_comment;
    delete from public.comment_reports where comment_id = p_comment;
  else update public.photo_comments set deleted_at = now() where id = p_comment; end if;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (uid, case when actor = 'master' then 'master' else 'organizador' end, e.id, 'comment.' || p_action, 'comment', p_comment::text, why, jsonb_build_object('photo', c.photo_id));
end $$;

-- O autor apaga o próprio comentário.
create function public.delete_my_comment(p_comment uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.photo_comments set deleted_at = now() where id = p_comment and author_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'forbidden' using errcode = 'MM004'; end if;
end $$;

-- Lista de moderação do anfitrião / Master: comentários com denúncias ou escondidos de um evento.
create function public.list_comments_for_moderation(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_host(p_event) or public.is_master()) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'photoId', c.photo_id, 'authorName', c.author_name, 'body', c.body,
      'reports', c.reports, 'hidden', c.hidden_at is not null, 'hiddenBy', c.hidden_by, 'createdAt', c.created_at) order by c.reports desc, c.created_at desc)
    from public.photo_comments c where c.event_id = p_event and c.deleted_at is null and (c.reports > 0 or c.hidden_at is not null)), '[]'::jsonb);
end $$;

-- Exclusão de conta: comentários continuam, sem autor (como as fotos); curtidas e denúncias da pessoa saem.
create or replace function public.process_account_deletion(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.photos set author_id = null, author_name = 'Participante removido' where author_id = p_user;
  update public.photo_comments set author_id = null, author_name = 'Participante removido' where author_id = p_user;
  delete from public.comment_likes where user_id = p_user;
  delete from public.comment_reports where user_id = p_user;
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

revoke all on function public.can_see_comment(uuid), public.post_comment(uuid, text), public.list_photo_comments(uuid), public.comment_counts(uuid),
  public.toggle_comment_like(uuid), public.report_comment(uuid), public.moderate_comment(uuid, text, text), public.delete_my_comment(uuid),
  public.list_comments_for_moderation(uuid) from public, anon;
grant execute on function public.can_see_comment(uuid), public.post_comment(uuid, text), public.list_photo_comments(uuid), public.comment_counts(uuid),
  public.toggle_comment_like(uuid), public.report_comment(uuid), public.moderate_comment(uuid, text, text), public.delete_my_comment(uuid),
  public.list_comments_for_moderation(uuid) to authenticated;
