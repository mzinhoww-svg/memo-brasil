-- Revela · publicar: WhatsApp na entrada (20261118000400) + número guardado na conta, Termos v3 e Política v4 (20261118000500).
-- Rodar inteiro no SQL Editor do projeto newmemocuiaba, ANTES do merge do PR #38. Tudo ou nada (uma transação).
begin;

-- Avisos por WhatsApp · pedir o aviso já no formulário de entrada (antes de virar participante). ADITIVA.
--
-- O convidado digita o WhatsApp no lugar do e-mail. Para o toque em "Aceitar" abrir o WhatsApp NA HORA (sem esperar rede), o código do
-- gateway e o token de volta são preparados enquanto ele preenche o formulário, ainda sem ser participante. Garantias:
--   * whatsapp_prejoin_event: só evento existente, não excluído, ainda não revelado, com o recurso ligado; nunca para o anfitrião nem para
--     quem foi bloqueado no evento.
--   * O opt-in só é aplicado se a pessoa de fato entrar: whatsapp_apply_event continua exigindo participante (sem participante =
--     unknown_subject) e a troca do token de volta (whatsapp_consume_return_token) também.
--   * whatsapp_return_tokens deixa de exigir participante na criação (FK para evento e usuário); a troca continua exigindo.

alter table public.whatsapp_return_tokens drop constraint if exists whatsapp_return_tokens_event_id_user_id_fkey;
alter table public.whatsapp_return_tokens
  add constraint whatsapp_return_tokens_event_fkey foreign key (event_id) references public.events on delete cascade,
  add constraint whatsapp_return_tokens_user_fkey foreign key (user_id) references auth.users on delete cascade;
create index if not exists whatsapp_return_tokens_user_idx on public.whatsapp_return_tokens (event_id, user_id);

create or replace function public.whatsapp_issue_return_token(p_event uuid, p_user uuid, p_hash text, p_ttl_minutes int default 120) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_ttl_minutes is null or p_ttl_minutes not between 5 and 1440 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if not exists (select 1 from public.events where id = p_event and deleted_at is null)
     or exists (select 1 from public.participants where event_id = p_event and user_id = p_user and blocked_at is not null) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  delete from public.whatsapp_return_tokens where expires_at < now() - interval '1 day';
  insert into public.whatsapp_return_tokens (token_hash, event_id, user_id, expires_at)
  values (p_hash, p_event, p_user, now() + make_interval(mins => p_ttl_minutes));
end $$;

-- {status: ok|disabled|forbidden|not_found, eventId?}: pode preparar o aviso antes de entrar?
create function public.whatsapp_prejoin_event(p_code text, p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events;
begin
  if p_user is null or p_code is null or p_code !~ '^[A-Za-z0-9]{4,16}$' then return jsonb_build_object('status', 'not_found'); end if;
  if not exists (select 1 from public.feature_flags where key = 'whatsapp_avisos' and enabled) then return jsonb_build_object('status', 'disabled'); end if;
  select * into e from public.events where code = upper(p_code) and deleted_at is null;
  if e.id is null then return jsonb_build_object('status', 'not_found'); end if;
  if public.is_revealed(e.id) or e.host_id = p_user
     or exists (select 1 from public.participants where event_id = e.id and user_id = p_user and blocked_at is not null) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  return jsonb_build_object('status', 'ok', 'eventId', e.id);
end $$;

revoke all on function public.whatsapp_prejoin_event(text, uuid), public.whatsapp_issue_return_token(uuid, uuid, text, int) from public, anon, authenticated;
grant execute on function public.whatsapp_prejoin_event(text, uuid), public.whatsapp_issue_return_token(uuid, uuid, text, int) to service_role;

-- o formulário de entrada só mostra o campo de WhatsApp com o recurso ligado (feature_flags é só da equipe; aqui sai só o booleano)
create function public.whatsapp_available() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.feature_flags where key = 'whatsapp_avisos' and enabled)
$$;
revoke all on function public.whatsapp_available() from public;
grant execute on function public.whatsapp_available() to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261118000400', 'whatsapp_prejoin') on conflict (version) do nothing;

-- Número de WhatsApp guardado na conta + campanhas com autorização separada. ADITIVA.
--
-- O convidado digita o WhatsApp no formulário de entrada. Guardamos o número na conta (uma linha por usuário) para:
--   * preencher sozinho em próximos eventos (finalidade informada na Política v4, seção 3, e nos Termos v3, seção 2);
--   * campanhas e novidades do Revela, SOMENTE com autorização própria (caixa separada, nunca pré-marcada; LGPD art. 8º, §4º).
-- Os avisos de um evento (participant_whatsapp) continuam com o ciclo próprio: o número de lá é apagado ao sair do evento.
-- Cliente não escreve na tabela: só pelas funções abaixo, sempre sobre a própria conta. Equipe (master) lê para campanhas.

insert into public.legal_documents (kind, version, source, legal_review) values
  ('privacy', '2026-11-16-v4', 'v3 + número de WhatsApp guardado na conta e campanhas com autorização separada, a pedido do operador', 'nenhuma revisão jurídica profissional registrada'),
  ('terms', '2026-11-16-v3', 'v2 + WhatsApp opcional na entrada (seção 2), a pedido do operador', 'nenhuma revisão jurídica profissional registrada')
on conflict do nothing;

create table public.user_contact_phone (
  user_id uuid primary key references auth.users on delete cascade,
  -- E.164 do Brasil sem o "+": 55 + DDD + número (fixo 8 ou celular 9 dígitos)
  phone text not null check (phone ~ '^55[1-9][0-9][0-9]{8,9}$'),
  first_event_id uuid references public.events on delete set null,
  marketing_optin boolean not null default false,
  marketing_optin_at timestamptz,
  marketing_revoked_at timestamptz,
  privacy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_optin_has_date check (not marketing_optin or marketing_optin_at is not null)
);
alter table public.user_contact_phone enable row level security;
create policy user_contact_phone_own on public.user_contact_phone for select to authenticated using (user_id = (select auth.uid()));
create policy user_contact_phone_master on public.user_contact_phone for select to authenticated using ((select public.is_master()));
revoke all on public.user_contact_phone from anon, authenticated;
grant select on public.user_contact_phone to authenticated;

-- normaliza "(65) 99999-0000", "+55 65 99999 0000", "065..." → 5565999990000; inválido → null
create function public.normalize_br_phone(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when d ~ '^55[1-9][0-9][0-9]{8,9}$' then d
    when d ~ '^0?[1-9][0-9][0-9]{8,9}$' then '55' || ltrim(d, '0')
    else null end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

-- p_marketing: true = autoriza campanhas; false = retira; null = mantém como está
create function public.save_my_phone(p_phone text, p_marketing boolean default null, p_event uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n text := public.normalize_br_phone(p_phone);
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if n is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  insert into public.user_contact_phone as c (user_id, phone, first_event_id, marketing_optin, marketing_optin_at, privacy_version)
  values (uid, n, (select id from public.events where id = p_event and deleted_at is null), coalesce(p_marketing, false),
          case when p_marketing then now() end, '2026-11-16-v4')
  on conflict (user_id) do update set
    phone = excluded.phone,
    privacy_version = excluded.privacy_version,
    marketing_optin = coalesce(p_marketing, c.marketing_optin),
    marketing_optin_at = case when p_marketing and not c.marketing_optin then now() else c.marketing_optin_at end,
    marketing_revoked_at = case when p_marketing is false and c.marketing_optin then now()
                                when p_marketing then null else c.marketing_revoked_at end,
    updated_at = now();
end $$;

create function public.set_my_marketing(p_on boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_on is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.user_contact_phone c set
    marketing_optin = p_on,
    marketing_optin_at = case when p_on and not c.marketing_optin then now() else c.marketing_optin_at end,
    marketing_revoked_at = case when not p_on and c.marketing_optin then now() when p_on then null else c.marketing_revoked_at end,
    updated_at = now()
  where user_id = uid;
  return found;
end $$;

-- apaga o número guardado (e com ele a autorização de campanhas)
create function public.forget_my_phone() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  delete from public.user_contact_phone where user_id = auth.uid();
end $$;

revoke all on function public.normalize_br_phone(text), public.save_my_phone(text, boolean, uuid), public.set_my_marketing(boolean), public.forget_my_phone() from public, anon;
grant execute on function public.normalize_br_phone(text), public.save_my_phone(text, boolean, uuid), public.set_my_marketing(boolean), public.forget_my_phone() to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261118000500', 'contact_phone') on conflict (version) do nothing;
commit;
