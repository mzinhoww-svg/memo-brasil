-- COM-004: aceite versionado de Termos de uso e Política de privacidade (organizador e convidado).
-- ADITIVA: cria legal_documents (versões publicadas), user_consents (aceites) e record_consent() (única via de escrita).
-- O texto das versões ainda é RASCUNHO: a revisão jurídica prevista no backlog não foi registrada; publicar nova versão ao aprovar.

create table public.legal_documents (
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null check (char_length(version) between 1 and 60),
  published_at timestamptz not null default now(),
  primary key (kind, version)
);
insert into public.legal_documents (kind, version) values ('terms', '2026-10-21-rascunho'), ('privacy', '2026-10-21-rascunho');
alter table public.legal_documents enable row level security;
create policy legal_documents_read on public.legal_documents for select to anon, authenticated using (true);
revoke all on public.legal_documents from anon, authenticated;
grant select on public.legal_documents to anon, authenticated;

create table public.user_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('organizador', 'convidado')),
  event_id uuid references public.events on delete set null,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now()
);
-- reenvio após falha de rede não duplica
create unique index user_consents_once on public.user_consents
  (user_id, role, terms_version, privacy_version, coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.user_consents enable row level security;
create policy user_consents_own_read on public.user_consents for select to authenticated using (user_id = auth.uid());
revoke all on public.user_consents from anon, authenticated; -- sem escrita direta: só record_consent()
grant select on public.user_consents to authenticated;

create function public.record_consent(p_terms_version text, p_privacy_version text, p_role text, p_event_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); anon boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false); ins bigint;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_role is null or p_role not in ('organizador', 'convidado') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if not exists (select 1 from public.legal_documents where kind = 'terms' and version = p_terms_version)
     or not exists (select 1 from public.legal_documents where kind = 'privacy' and version = p_privacy_version) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if p_role = 'organizador' and anon then raise exception 'forbidden' using errcode = 'MM004'; end if; -- organiza quem tem conta, não sessão anônima
  -- vinculado a evento: organizador só como host, convidado só como membro
  if p_event_id is not null and not (case p_role when 'organizador' then public.is_host(p_event_id) else public.is_member(p_event_id) end) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  insert into public.user_consents (user_id, role, event_id, terms_version, privacy_version)
  values (uid, p_role, p_event_id, p_terms_version, p_privacy_version) on conflict do nothing returning id into ins;
  if ins is not null then
    perform public.audit(p_event_id, 'consent.recorded', jsonb_build_object('role', p_role, 'terms', p_terms_version, 'privacy', p_privacy_version));
  end if;
end $$;
revoke execute on function public.record_consent(text, text, text, uuid) from public, anon;
grant execute on function public.record_consent(text, text, text, uuid) to authenticated;
