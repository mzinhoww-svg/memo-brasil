-- Expõe somente os prazos efetivamente definidos pela política, sem alterar a política nem RPCs existentes.
create function public.admin_master_retention() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_platform_staff() then raise exception 'forbidden' using errcode='MM004'; end if;
 return jsonb_build_object('policy','2026-10-22-v1','photosAfterEndDays',90,'unrevealedAfterEndDays',90,
 'ipHashDays',(select value from public.platform_settings where key='ip_hash_retention_days'),
 'backupDays',(select value from public.platform_settings where key='backup_retention_days'));
end $$;
revoke all on function public.admin_master_retention() from public,anon;
grant execute on function public.admin_master_retention() to authenticated;
