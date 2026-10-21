-- MemoriesMT · provisionamento do PRIMEIRO master (ou de um master adicional) · script de OPERADOR.
--
-- Roda FORA do app, por psql com o papel dono do banco / service_role (nunca por cliente, nunca pela API).
-- NÃO existe credencial padrão: o script não cria usuário nem senha. A pessoa precisa JÁ existir em auth.users
-- (entrou uma vez pelo Google/Auth, e-mail confirmado). O script apenas:
--   1) cria a linha ativa em public.platform_roles (role = 'master', granted_by = null = operador);
--   2) grava a claim app_metadata.role = 'master' em auth.users (a claim só é emitida pelo servidor de auth);
--   3) registra tudo em public.audit_logs (trigger de platform_roles + linha 'master.provisioned' com a origem).
-- Idempotente: reexecutar não duplica a linha nem a claim (apenas registra nova linha de auditoria).
-- Depois de rodar, a pessoa precisa sair e entrar de novo para receber a claim no JWT (is_master exige claim E linha).
--
-- Uso (exatamente um dos dois parâmetros; motivo opcional, mínimo 10 caracteres):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v email='pessoa@empresa.com' -v reason='provisionamento inicial do master' -f supabase/ops/provision_master.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v user_id='00000000-0000-0000-0000-000000000000' -f supabase/ops/provision_master.sql
-- Local:  psql "postgresql://postgres:postgres@127.0.0.1:55422/postgres" ...   (nunca aponte para o remoto sem a janela de mudança aprovada)

\set ON_ERROR_STOP on
\if :{?email}
\else
  \set email ''
\endif
\if :{?user_id}
\else
  \set user_id ''
\endif
\if :{?reason}
\else
  \set reason 'provisionamento de master por operador'
\endif

begin;
select set_config('mm.prov_email', :'email', true), set_config('mm.prov_user', :'user_id', true), set_config('mm.audit_reason', :'reason', true) \gset

do $$
declare
  p_email text := nullif(btrim(current_setting('mm.prov_email', true)), '');
  p_user_txt text := nullif(btrim(current_setting('mm.prov_user', true)), '');
  p_reason text := btrim(coalesce(current_setting('mm.audit_reason', true), ''));
  uid uuid;
  u auth.users;
  created_role boolean := false;
  claim_changed boolean := false;
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'provision_master: rode como operador (dono do banco/service_role), não como cliente';
  end if;
  if (p_email is null) = (p_user_txt is null) then
    raise exception 'provision_master: informe exatamente um parâmetro: -v email=... OU -v user_id=...';
  end if;
  if char_length(p_reason) < 10 then
    raise exception 'provision_master: -v reason=... precisa ter ao menos 10 caracteres';
  end if;

  if p_user_txt is not null then
    begin uid := p_user_txt::uuid; exception when invalid_text_representation then raise exception 'provision_master: user_id não é um UUID'; end;
    select * into u from auth.users where id = uid;
    if not found then raise exception 'provision_master: usuário não encontrado em auth.users (a pessoa precisa entrar uma vez antes; o script não cria contas)'; end if;
  else
    -- e-mail duplicado (ex.: usuário SSO e não-SSO) é erro, nunca "uma linha arbitrária"
    if (select count(*) from auth.users where lower(email) = lower(p_email)) > 1 then raise exception 'provision_master: e-mail ambíguo (mais de uma conta); use -v user_id=...'; end if;
    select * into u from auth.users where lower(email) = lower(p_email);
    if not found then raise exception 'provision_master: usuário não encontrado em auth.users (a pessoa precisa entrar uma vez antes; o script não cria contas)'; end if;
  end if;
  if coalesce(u.is_sso_user, false) then raise exception 'provision_master: conta SSO não é aceita'; end if;
  if u.deleted_at is not null then raise exception 'provision_master: conta apagada'; end if;
  if u.banned_until is not null and u.banned_until > now() then raise exception 'provision_master: conta banida'; end if;
  if coalesce(u.is_anonymous, false) then raise exception 'provision_master: conta anônima não pode ser master'; end if;
  if u.email_confirmed_at is null then raise exception 'provision_master: e-mail ainda não confirmado'; end if;
  -- anti pré-sequestro: a conta precisa ter UMA única identidade, Google, com o mesmo e-mail da conta e verificado; e não pode ter senha
  -- (login e-mail/senha ou vinculação manual criados por terceiro com o mesmo e-mail)
  if (select count(*) from auth.identities i where i.user_id = u.id) <> 1
     or not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google'
                      and lower(coalesce(i.identity_data ->> 'email', '')) = lower(coalesce(u.email, '#'))
                      and coalesce(i.identity_data ->> 'email_verified', 'false') = 'true') then
    raise exception 'provision_master: a conta precisa ter uma única identidade Google, com o mesmo e-mail da conta e verificado';
  end if;
  if coalesce(u.encrypted_password, '') <> '' then
    raise exception 'provision_master: a conta tem senha definida; recusado (use uma conta que entre só pelo Google)';
  end if;
  -- sessões e refresh tokens anteriores não valem para o novo papel: a pessoa entra de novo
  delete from auth.sessions where user_id = u.id;
  delete from auth.refresh_tokens where user_id = u.id::text;

  if not exists (select 1 from public.platform_roles where user_id = u.id and role = 'master' and revoked_at is null) then
    insert into public.platform_roles (user_id, role, granted_by) values (u.id, 'master', null); -- trigger grava platform_role.granted
    created_role := true;
  end if;
  if coalesce(u.raw_app_meta_data ->> 'role', '') is distinct from 'master' then
    update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'master') where id = u.id;
    claim_changed := true;
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
  values (null, 'operador', 'master.provisioned', 'user', u.id::text, left(p_reason, 500),
          jsonb_build_object('source', 'supabase/ops/provision_master.sql', 'role_row_created', created_role, 'claim_changed', claim_changed, 'db_user', current_user));
  raise notice 'master provisionado para o usuário % (linha criada: %, claim alterada: %). Peça para sair e entrar de novo.', u.id, created_role, claim_changed;
end $$;
commit;
