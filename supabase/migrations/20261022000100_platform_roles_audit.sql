-- MemoriesMT v2 · 1/5 · MAD-001 + MAD-002 · papéis de plataforma e auditoria imutável.
-- ADITIVA: cria platform_roles, reescreve is_master() (create or replace), estende audit_logs com colunas novas (nullable)
-- e adiciona triggers de imutabilidade. Nenhuma linha existente é alterada ou apagada.
-- Códigos de erro novos: MM010 imutável (auditoria/histórico) · MM011 justificativa obrigatória/insuficiente

-- ---------------------------------------------------------------- platform_roles
create table public.platform_roles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete restrict, -- papel não some junto com a conta sem revogação explícita
  role text not null check (role in ('master', 'support', 'auditor')),
  granted_by uuid, -- null = provisionamento por operador (service_role/psql); nunca por um cliente
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint platform_roles_revoked_after_grant check (revoked_at is null or revoked_at >= granted_at)
);
-- no máximo uma linha ATIVA por (usuário, papel); o histórico (revogadas) é preservado
create unique index platform_roles_active_uq on public.platform_roles (user_id, role) where revoked_at is null;
create index platform_roles_user_idx on public.platform_roles (user_id) where revoked_at is null;

alter table public.platform_roles enable row level security;
-- cliente nunca escreve (sem INSERT/UPDATE/DELETE concedidos); leitura só pelo master, via policy
revoke all on public.platform_roles from anon, authenticated;
grant select on public.platform_roles to authenticated;
revoke all on sequence public.platform_roles_id_seq from public, anon, authenticated;

-- papel ativo: a claim do JWT (emitida pelo servidor de auth, app_metadata não é editável pelo usuário) E a linha ativa.
-- SECURITY DEFINER para ler platform_roles sem passar pela própria RLS (que usa is_master → recursão).
create or replace function public.is_master() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'master'
    and exists (select 1 from public.platform_roles r
                where r.user_id = auth.uid() and r.role = 'master' and r.revoked_at is null)
$$;

create function public.is_platform_role(p_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_role in ('master', 'support', 'auditor')
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = p_role
    and exists (select 1 from public.platform_roles r
                where r.user_id = auth.uid() and r.role = p_role and r.revoked_at is null)
$$;

-- qualquer papel de plataforma ativo (leitura operacional: master, support, auditor)
create function public.is_platform_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_platform_role('master') or public.is_platform_role('support') or public.is_platform_role('auditor')
$$;

create policy platform_roles_master_select on public.platform_roles for select to authenticated using (public.is_master());

-- ---------------------------------------------------------------- audit_logs: colunas novas + imutabilidade
alter table public.audit_logs
  add column actor_role text check (actor_role is null or actor_role in ('master', 'support', 'auditor', 'organizador', 'convidado', 'operador', 'sistema')),
  add column reason text check (reason is null or char_length(reason) <= 500),
  add column target_type text check (target_type is null or char_length(target_type) <= 40),
  add column target_id text check (target_id is null or char_length(target_id) <= 80);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id, at desc) where target_type is not null;
create index audit_logs_actor_idx on public.audit_logs (actor_id, at desc) where actor_id is not null;

-- sem UPDATE/DELETE/TRUNCATE para ninguém (inclusive service_role e dono): só desabilitar o trigger como superusuário, o que é visível
create function public.audit_logs_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs é imutável (% bloqueado)', tg_op using errcode = 'MM010';
end $$;
create trigger audit_logs_no_update before update on public.audit_logs for each row execute function public.audit_logs_immutable();
create trigger audit_logs_no_delete before delete on public.audit_logs for each row execute function public.audit_logs_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs for each statement execute function public.audit_logs_immutable();
-- ENABLE ALWAYS: continuam valendo com session_replication_role = replica (contorno silencioso)
alter table public.audit_logs enable always trigger audit_logs_no_update;
alter table public.audit_logs enable always trigger audit_logs_no_delete;
alter table public.audit_logs enable always trigger audit_logs_no_truncate;
revoke update, delete, truncate on public.audit_logs from service_role;

-- auditor lê toda a trilha (somente leitura). Uma única policy de SELECT (evita multiple_permissive_policies):
-- host (eventos próprios) · master (via is_master, agora com linha ativa) · auditor
drop policy audit_host_select on public.audit_logs;
create policy audit_host_select on public.audit_logs for select to authenticated
  using (public.is_host(event_id) or public.is_master() or public.is_platform_role('auditor'));

-- ações sensíveis exigem justificativa; só as de consulta ('view.*') dispensam
create function public.admin_action_is_sensitive(p_action text) returns boolean
language sql immutable set search_path = '' as $$
  select p_action !~ '^view\.'
$$;

-- registro administrativo: só master; justificativa obrigatória (≥ 10 caracteres) em ação sensível
create function public.admin_log(p_action text, p_target_type text, p_target_id text, p_reason text, p_event uuid default null)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  why text := btrim(coalesce(p_reason, ''));
  new_id bigint;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_action is null or p_action !~ '^[a-z][a-z0-9_.]{2,63}$' then raise exception 'invalid' using errcode = 'MM005'; end if;
  if public.admin_action_is_sensitive(p_action) and char_length(why) < 10 then
    raise exception 'reasonrequired' using errcode = 'MM011';
  end if;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', p_event, p_action, left(p_target_type, 40), left(p_target_id, 80), nullif(left(why, 500), ''), '{}')
  returning id into new_id;
  return new_id;
end $$;

-- ---------------------------------------------------------------- trilha automática de concessão/revogação de papéis
-- Roda para qualquer caminho (RPC, script de operador, service_role). A justificativa vem de mm.audit_reason (set_config local).
create function public.platform_roles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare why text := nullif(btrim(coalesce(current_setting('mm.audit_reason', true), '')), '');
begin
  if tg_op = 'DELETE' then raise exception 'platform_roles é histórico: revogue em vez de apagar' using errcode = 'MM010'; end if;
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.role is distinct from old.role
       or new.granted_by is distinct from old.granted_by or new.granted_at is distinct from old.granted_at
       or old.revoked_at is not null then
      raise exception 'platform_roles: só é possível revogar uma vez' using errcode = 'MM010';
    end if;
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
    values (auth.uid(), case when public.is_master() then 'master' else 'operador' end, 'platform_role.revoked', 'user', new.user_id::text, left(why, 500),
            jsonb_build_object('role', new.role));
    return new;
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
  values (coalesce(auth.uid(), new.granted_by), case when public.is_master() then 'master' else 'operador' end, 'platform_role.granted', 'user', new.user_id::text, left(why, 500),
          jsonb_build_object('role', new.role, 'granted_by', new.granted_by));
  return new;
end $$;
create trigger platform_roles_guard_iud after insert or update on public.platform_roles for each row execute function public.platform_roles_guard();
create trigger platform_roles_guard_del before delete on public.platform_roles for each row execute function public.platform_roles_guard();

-- concessão/revogação por um master já autenticado (nunca autoconcessão do primeiro: esse vem do script de operador)
create function public.admin_grant_platform_role(p_user uuid, p_role text, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if not exists (select 1 from auth.users where id = p_user and not coalesce(is_anonymous, false)) then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform set_config('mm.audit_reason', btrim(p_reason), true);
  insert into public.platform_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid()) returning id into new_id;
  return new_id;
end $$;

create function public.admin_revoke_platform_role(p_user uuid, p_role text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  if p_role = 'master' and (select count(*) from public.platform_roles where role = 'master' and revoked_at is null) <= 1 then
    raise exception 'último master não pode ser revogado' using errcode = 'MM009';
  end if;
  perform set_config('mm.audit_reason', btrim(p_reason), true);
  update public.platform_roles set revoked_at = now() where user_id = p_user and role = p_role and revoked_at is null;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
end $$;

-- ---------------------------------------------------------------- execução
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.audit_logs_immutable(), public.platform_roles_guard() from authenticated;
grant execute on function public.is_master(), public.is_platform_role(text), public.is_platform_staff(), public.admin_action_is_sensitive(text),
  public.admin_log(text, text, text, text, uuid), public.admin_grant_platform_role(uuid, text, text), public.admin_revoke_platform_role(uuid, text, text) to authenticated;
