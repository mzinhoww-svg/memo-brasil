-- Endurecimento da auditoria (SCV-005). Aditiva: só funções e triggers novos, nenhuma linha alterada.
-- Códigos: MM010 imutável · MM009 último master · MM005 ação inválida

-- (1) Prefixos reservados: a trilha emitida pelo sistema não pode ser forjada por um master via admin_log.
create or replace function public.admin_log(p_action text, p_target_type text, p_target_id text, p_reason text, p_event uuid default null)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  why text := btrim(coalesce(p_reason, ''));
  new_id bigint;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_action is null or p_action !~ '^[a-z][a-z0-9_.]{2,63}$' then raise exception 'invalid' using errcode = 'MM005'; end if;
  if p_action ~ '^(platform_role|audit|system|lgpd)\.' then raise exception 'reservedaction' using errcode = 'MM005'; end if;
  if public.admin_action_is_sensitive(p_action) and char_length(why) < 10 then
    raise exception 'reasonrequired' using errcode = 'MM011';
  end if;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', p_event, p_action, left(p_target_type, 40), left(p_target_id, 80), nullif(left(why, 500), ''), '{}')
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.admin_log(text, text, text, text, uuid) from public, anon;
grant execute on function public.admin_log(text, text, text, text, uuid) to authenticated;

-- (2) Último master protegido em qualquer caminho (SQL direto, script, service_role), não só pela RPC.
create function public.platform_roles_keep_last_master() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'master' and old.revoked_at is null and new.revoked_at is not null
     and not exists (select 1 from public.platform_roles r where r.role = 'master' and r.revoked_at is null and r.id <> old.id) then
    raise exception 'último master não pode ser revogado' using errcode = 'MM009';
  end if;
  return new;
end $$;
create trigger platform_roles_keep_last_master before update on public.platform_roles for each row execute function public.platform_roles_keep_last_master();
alter table public.platform_roles enable always trigger platform_roles_keep_last_master;
revoke execute on function public.platform_roles_keep_last_master() from public, anon, authenticated;
-- a trilha de papéis também vale com session_replication_role = replica
alter table public.platform_roles enable always trigger platform_roles_guard_iud;
alter table public.platform_roles enable always trigger platform_roles_guard_del;

-- (3) Event trigger: nenhuma DDL (DISABLE/DROP TRIGGER, DROP TABLE) pode desligar a imutabilidade da trilha sem abortar.
create function public.guard_audit_ddl() returns event_trigger
language plpgsql security definer set search_path = '' as $$
declare r record; off int;
begin
  if tg_event = 'sql_drop' then
    for r in select object_type, object_identity from pg_event_trigger_dropped_objects() loop
      if r.object_identity ~ '^public\.(audit_logs|platform_roles)$'
         or (r.object_type = 'trigger' and r.object_identity ~ '^(audit_logs_no_|platform_roles_guard|platform_roles_keep_last_master).* on public\.(audit_logs|platform_roles)$') then
        raise exception 'DDL bloqueada: % % protege a trilha de auditoria', r.object_type, r.object_identity using errcode = 'MM010';
      end if;
    end loop;
  else -- ddl_command_end de ALTER TABLE: os triggers de proteção precisam continuar ENABLE ALWAYS
    select count(*) into off from pg_trigger t
     where not t.tgisinternal
       and ((t.tgrelid = 'public.audit_logs'::regclass and t.tgname like 'audit_logs_no_%')
         or (t.tgrelid = 'public.platform_roles'::regclass and t.tgname in ('platform_roles_guard_iud', 'platform_roles_guard_del', 'platform_roles_keep_last_master')))
       and t.tgenabled <> 'A';
    if off > 0 then raise exception 'DDL bloqueada: triggers de auditoria precisam ficar ENABLE ALWAYS' using errcode = 'MM010'; end if;
  end if;
end $$;
-- Troca de ENABLE/DISABLE exige superusuário ou dono; a função roda como o dono da migration. Se o papel não puder criar event trigger
-- (ambiente gerenciado), a migration segue e avisa em vez de falhar: o resto do endurecimento continua valendo.
do $$ begin
  create event trigger audit_ddl_end on ddl_command_end when tag in ('ALTER TABLE') execute function public.guard_audit_ddl();
  create event trigger audit_ddl_drop on sql_drop execute function public.guard_audit_ddl();
exception when insufficient_privilege then
  raise warning 'event trigger de auditoria NÃO criado (privilégio insuficiente): criar manualmente como superusuário';
end $$;

-- (4) Uploads de logo/capa abandonados: agenda expire_pending_assets() (a função já existia, sem job). Mesmo padrão tolerante da migration de jobs.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('mm-expire-assets', '*/15 * * * *', 'select public.expire_pending_assets()');
  else
    raise notice 'pg_cron indisponível: agende expire_pending_assets() a cada 15 min por outro meio';
  end if;
end $$;
