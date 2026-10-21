-- MemoriesMT v2 · 4/5 · SCV-001 · configurações da plataforma e feature flags. ADITIVA.
-- Leitura: flags HABILITADAS para qualquer authenticated; tudo o mais só para staff (master/support/auditor).
-- Escrita: somente master, por RPC com justificativa; todo caminho de escrita (RPC, service_role) é auditado por trigger.

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  value jsonb not null check (octet_length(value::text) <= 8192),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  enabled boolean not null default false,
  rollout jsonb not null default '{}' check (jsonb_typeof(rollout) = 'object' and octet_length(rollout::text) <= 2048),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
alter table public.feature_flags enable row level security;
revoke all on public.platform_settings, public.feature_flags from anon, authenticated;
grant select on public.platform_settings, public.feature_flags to authenticated; -- sem escrita direta: só RPC admin_*

create policy platform_settings_staff_select on public.platform_settings for select to authenticated using (public.is_platform_staff());
create policy feature_flags_select on public.feature_flags for select to authenticated using (public.is_platform_staff()); -- `rollout` pode ter alvos de experimento: só staff

create function public.get_enabled_flags() returns table (key text, enabled boolean)
language sql stable security definer set search_path = '' as $$
  select f.key, f.enabled from public.feature_flags f where f.enabled
$$;
revoke execute on function public.get_enabled_flags() from public, anon;
grant execute on function public.get_enabled_flags() to authenticated;

-- auditoria em qualquer caminho de escrita; a justificativa vem de mm.audit_reason (definida pela RPC)
create function public.settings_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  why text := nullif(btrim(coalesce(current_setting('mm.audit_reason', true), '')), '');
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
  values (auth.uid(), case when public.is_master() then 'master' else 'operador' end,
          tg_table_name || '.' || lower(tg_op), tg_table_name, r.key, left(why, 500),
          case when tg_table_name = 'feature_flags'
               then jsonb_build_object('enabled', to_jsonb(r) -> 'enabled', 'rollout', to_jsonb(r) -> 'rollout')
               else jsonb_build_object('value_bytes', octet_length((to_jsonb(r) ->> 'value'))) end); -- valor de configuração não vai para o log
  return r;
end $$;
-- duas fases: BEFORE para carimbar updated_at (retorna NEW), AFTER para auditar o resultado já gravado
create function public.settings_touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger platform_settings_touch before insert or update on public.platform_settings for each row execute function public.settings_touch();
create trigger feature_flags_touch before insert or update on public.feature_flags for each row execute function public.settings_touch();
create trigger platform_settings_audit after insert or update or delete on public.platform_settings for each row execute function public.settings_audit();
create trigger feature_flags_audit after insert or update or delete on public.feature_flags for each row execute function public.settings_audit();

create function public.admin_set_setting(p_key text, p_value jsonb, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if p_value is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform set_config('mm.audit_reason', btrim(p_reason), true);
  insert into public.platform_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by;
end $$;

create function public.admin_set_feature_flag(p_key text, p_enabled boolean, p_rollout jsonb, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if p_enabled is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform set_config('mm.audit_reason', btrim(p_reason), true);
  insert into public.feature_flags (key, enabled, rollout, updated_by) values (p_key, p_enabled, coalesce(p_rollout, '{}'), auth.uid())
  on conflict (key) do update set enabled = excluded.enabled, rollout = excluded.rollout, updated_by = excluded.updated_by;
end $$;

revoke execute on all functions in schema public from public, anon;
revoke execute on function public.settings_audit(), public.settings_touch() from authenticated;
grant execute on function public.admin_set_setting(text, jsonb, text), public.admin_set_feature_flag(text, boolean, jsonb, text) to authenticated;
