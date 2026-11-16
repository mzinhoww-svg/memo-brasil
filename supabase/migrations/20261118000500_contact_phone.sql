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
