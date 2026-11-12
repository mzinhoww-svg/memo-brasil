-- M14: configurações do desenho com consumidores reais. Ausência de chave preserva a política vigente.
-- platform_settings e feature_flags já têm RLS staff-only e auditoria por trigger.
create function public.get_revela_features() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'commentsEnabled',coalesce((select enabled from public.feature_flags where key='photo_comments'),true),
  'revealEmailsEnabled',coalesce((select enabled from public.feature_flags where key='reveal_emails'),true),
  'maxPhotoBytes',(select file_size_limit from storage.buckets where id='event-photos'))
$$;
create function public.admin_master_config() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_platform_staff() then raise exception 'forbidden' using errcode='MM004'; end if;
 return public.get_revela_features()||jsonb_build_object(
  'maxPhotosPerEvent',(select value from public.platform_settings where key='max_photos_per_event'),
  'senderEmail',(select value from public.platform_settings where key='reveal_email_sender'));
end $$;
create function public.admin_set_master_config(p_changes jsonb,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare k text; v jsonb; why text; sender text; n bigint;
begin
 if not public.is_master() then raise exception 'forbidden' using errcode='MM004'; end if;
 why:=public.admin_reason(p_reason);
 if p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then raise exception 'invalid' using errcode='MM005'; end if;
 -- Valida tudo antes de gravar; uma falha reverte o lote inteiro.
 for k,v in select * from jsonb_each(p_changes) loop
  if k='maxPhotosPerEvent' then
   if v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or v::text!~'^[0-9]+$') then raise exception 'invalid' using errcode='MM005'; end if;
   if v<>'null'::jsonb and (v::numeric<1 or v::numeric>100000) then raise exception 'invalid' using errcode='MM005'; end if;
  elsif k='maxPhotoBytes' then
   if jsonb_typeof(v)<>'number' or v::text!~'^[0-9]+$' then raise exception 'invalid' using errcode='MM005'; end if;
   if v::numeric<1 or v::numeric>8388608 then raise exception 'invalid' using errcode='MM005'; end if;
  elsif k='senderEmail' then
   if v<>'null'::jsonb then
    if jsonb_typeof(v)<>'string' then raise exception 'invalid' using errcode='MM005'; end if;
    sender:=lower(btrim(v#>>'{}'));
    if char_length(sender)>254 or sender!~'^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid' using errcode='MM005'; end if;
   end if;
  elsif k in ('commentsEnabled','revealEmailsEnabled') then
   if jsonb_typeof(v)<>'boolean' then raise exception 'invalid' using errcode='MM005'; end if;
  else raise exception 'invalid' using errcode='MM005'; end if;
 end loop;
 perform set_config('mm.audit_reason',why,true);
 for k,v in select * from jsonb_each(p_changes) loop
  if k='maxPhotoBytes' then
   n:=(v::text)::bigint;
   update storage.buckets set file_size_limit=n where id='event-photos';
   if not found then raise exception 'invalid' using errcode='MM005'; end if;
   perform public.admin_log('admin.photo_size_changed','storage','event-photos',why,null);
  elsif k in ('commentsEnabled','revealEmailsEnabled') then
   insert into public.feature_flags(key,enabled,updated_by) values(case k when 'commentsEnabled' then 'photo_comments' else 'reveal_emails' end,(v::text)::boolean,auth.uid())
   on conflict(key) do update set enabled=excluded.enabled,updated_by=excluded.updated_by;
  else
   insert into public.platform_settings(key,value,updated_by) values(case k when 'maxPhotosPerEvent' then 'max_photos_per_event' else 'reveal_email_sender' end,
    case when k='senderEmail' and v<>'null'::jsonb then to_jsonb(lower(btrim(v#>>'{}'))) else v end,auth.uid())
   on conflict(key) do update set value=excluded.value,updated_by=excluded.updated_by;
  end if;
 end loop;
end $$;

-- Só o worker pode ler o remetente; a leitura pública contém apenas limites e chaves.
create function public.reveal_email_delivery_config() returns jsonb
language sql stable security definer set search_path='' as $$
 select public.get_revela_features()||jsonb_build_object('senderEmail',(select value from public.platform_settings where key='reveal_email_sender'))
$$;

create function public.revela_photo_cap_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare cap integer;
begin
 if new.deleted_at is not null or new.status='removida' or new.upload_status not in ('enviando','pronta') then return new; end if;
 if tg_op='UPDATE' then
  if old.event_id=new.event_id and old.deleted_at is null and old.status<>'removida' and old.upload_status in ('enviando','pronta') then return new; end if;
 end if;
 cap:=(select (value#>>'{}')::integer from public.platform_settings where key='max_photos_per_event' and value<>'null'::jsonb);
 if cap is null then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended('revela-cap:'||new.event_id::text,0));
 if (select count(*) from public.photos where event_id=new.event_id and deleted_at is null and status<>'removida' and upload_status in ('enviando','pronta'))>=cap then
  raise exception 'photoeventlimit' using errcode='MM020';
 end if;
 return new;
end $$;
create trigger revela_photo_cap_guard before insert or update on public.photos for each row execute function public.revela_photo_cap_guard();

create function public.revela_comments_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.feature_flags where key='photo_comments' and not enabled) then raise exception 'commentsdisabled' using errcode='MM019'; end if;
 return new;
end $$;
create trigger revela_comments_guard before insert on public.photo_comments for each row execute function public.revela_comments_guard();

-- Desligar pausa tanto novas inscrições na fila quanto a reivindicação pelo contrato antigo.
create function public.revela_email_queue_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.feature_flags where key='reveal_emails' and not enabled) then
  if tg_op='INSERT' then return null; end if;
  if new.claimed_at is not null and new.attempts>old.attempts then return null; end if;
 end if;
 return new;
end $$;
create trigger revela_email_queue_guard before insert or update on public.reveal_email_queue for each row execute function public.revela_email_queue_guard();

revoke all on function public.get_revela_features(),public.admin_master_config(),public.admin_set_master_config(jsonb,text),public.reveal_email_delivery_config(),public.revela_photo_cap_guard(),public.revela_comments_guard(),public.revela_email_queue_guard() from public,anon,authenticated;
grant execute on function public.get_revela_features(),public.admin_master_config(),public.admin_set_master_config(jsonb,text) to authenticated;
grant execute on function public.reveal_email_delivery_config() to service_role;
