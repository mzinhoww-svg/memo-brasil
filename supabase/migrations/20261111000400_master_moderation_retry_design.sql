-- M08/M09: ações administrativas só sobre metadados, com motivo e auditoria.
create function public.admin_master_moderate_photo(p_photo uuid,p_action text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare ph public.photos; why text;
begin
 if not public.is_master() then raise exception 'forbidden' using errcode='MM004'; end if;
 why:=public.admin_reason(p_reason);
 if p_action is null or p_action not in ('mostrar','esconder','remover') then raise exception 'invalid' using errcode='MM005'; end if;
 select * into ph from public.photos where id=p_photo and deleted_at is null and status<>'removida' for update;
 if not found then raise exception 'invalid' using errcode='MM005'; end if;
 update public.photos set status=case p_action when 'mostrar' then 'visivel'::public.photo_status when 'esconder' then 'oculta'::public.photo_status else 'removida'::public.photo_status end,
  reports=case when p_action='mostrar' then 0 else reports end,
  deleted_at=case when p_action='remover' then now() else deleted_at end,
  version=version+1 where id=p_photo;
 if p_action='remover' then insert into public.storage_purge_queue(path) values(ph.storage_path) on conflict do nothing; end if;
 perform public.admin_log('admin.photo_'||p_action,'photo',p_photo::text,why,ph.event_id);
end $$;
create function public.admin_master_retry_reveal_emails(p_event uuid,p_reason text) returns integer
language plpgsql security definer set search_path='' as $$
declare why text; changed integer;
begin
 if not public.is_master() then raise exception 'forbidden' using errcode='MM004'; end if;
 why:=public.admin_reason(p_reason);
 if not exists(select 1 from public.events where id=p_event and deleted_at is null and revealed_at is not null) then raise exception 'invalid' using errcode='MM005'; end if;
 update public.reveal_email_queue q set attempts=0,claimed_at=null,last_error=null
 where q.event_id=p_event and q.sent_at is null and q.last_error is not null
  and (q.claimed_at is null or q.claimed_at<now()-interval '10 minutes')
  and exists(select 1 from public.participant_emails pe join public.participants p on p.event_id=pe.event_id and p.user_id=pe.user_id
   where pe.event_id=q.event_id and pe.user_id=q.user_id and pe.email=q.email and pe.email is not null and pe.consent_at is not null and pe.opt_out_at is null and p.blocked_at is null);
 get diagnostics changed=row_count;
 perform public.admin_log('admin.reveal_emails_retried','event',p_event::text,why,p_event);
 return changed;
end $$;
revoke all on function public.admin_master_moderate_photo(uuid,text,text),public.admin_master_retry_reveal_emails(uuid,text) from public,anon;
grant execute on function public.admin_master_moderate_photo(uuid,text,text),public.admin_master_retry_reveal_emails(uuid,text) to authenticated;
