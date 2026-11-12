-- M08: observações do agendador NATIVO já existente, enquanto o navegador está aberto.
-- Não há Web Push, telefone ou token. Uma linha só nasce com permissão nativa concedida;
-- shown_at é relatado apenas no evento `show`, nunca ao abrir o álbum ou planejar o relógio.
create table public.reveal_native_notices (
 event_id uuid not null references public.events on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 enrolled_at timestamptz not null default now(),
 shown_at timestamptz,
 primary key(event_id,user_id)
);
alter table public.reveal_native_notices enable row level security;
revoke all on public.reveal_native_notices from public,anon,authenticated;
grant select on public.reveal_native_notices to authenticated;
create policy reveal_native_notices_own on public.reveal_native_notices for select to authenticated using(user_id=auth.uid());
create function public.record_reveal_native_notice(p_event uuid,p_shown boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not exists(select 1 from public.events e where e.id=p_event and e.deleted_at is null and e.reveal_enabled
  and (e.host_id=uid or exists(select 1 from public.participants p where p.event_id=e.id and p.user_id=uid and p.blocked_at is null))) then
  raise exception 'forbidden' using errcode='MM004';
 end if;
 if p_shown is null or (p_shown and not public.is_revealed(p_event)) then raise exception 'invalid' using errcode='MM005'; end if;
 insert into public.reveal_native_notices(event_id,user_id,shown_at) values(p_event,uid,case when p_shown then now() end)
 on conflict(event_id,user_id) do update set shown_at=coalesce(reveal_native_notices.shown_at,excluded.shown_at);
end $$;
create function public.admin_master_native_notice_counts(p_events uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_platform_staff() then raise exception 'forbidden' using errcode='MM004'; end if;
 if p_events is null or cardinality(p_events)>200 then raise exception 'invalid' using errcode='MM005'; end if;
 select coalesce(jsonb_object_agg(x.event_id::text,jsonb_build_object('enrolled',x.enrolled,'shown',x.shown)),'{}'::jsonb) into result
 from(select n.event_id,count(*) enrolled,count(n.shown_at) shown from public.reveal_native_notices n join public.events e on e.id=n.event_id
  where n.event_id=any(p_events) and e.deleted_at is null and not e.is_test group by n.event_id)x;
 return result;
end $$;
revoke all on function public.record_reveal_native_notice(uuid,boolean),public.admin_master_native_notice_counts(uuid[]) from public,anon;
grant execute on function public.record_reveal_native_notice(uuid,boolean),public.admin_master_native_notice_counts(uuid[]) to authenticated;
