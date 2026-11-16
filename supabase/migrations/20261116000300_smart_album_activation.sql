-- Revela Smart Album · ativação da busca facial (decisão do proprietário, 16/11/2026). ADITIVA (create or replace + insert).
-- 1. `smart_album_face_matching` aceita rollout {"all": true} (liberar no app inteiro) além da allowlist {"events": [...]}.
--    Continuam valendo: gate jurídico, versão aprovada do termo, conta não anônima, membro/anfitrião, evento revelado.
-- 2. Publica o termo de consentimento biométrico 2026-11-16-v1 como APROVADO (texto exibido no app, aprovado pelo proprietário com base no
--    parecer jurídico declarado). A versão de rascunho segue não aprovada.
create or replace function public.smart_album_face_enabled(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.feature_flags f
      where f.key = 'smart_album_face_matching' and f.enabled
        and ((f.rollout ->> 'all') = 'true' or (f.rollout -> 'events') ? p_event::text))
    and public.smart_album_legal_gate()
    and public.smart_album_face_consent_version() is not null
    and exists (select 1 from public.events e where e.id = p_event and e.deleted_at is null)
$$;
revoke execute on function public.smart_album_face_enabled(uuid) from public, anon;
grant execute on function public.smart_album_face_enabled(uuid) to authenticated;

insert into public.face_consent_documents (version, approved) values ('2026-11-16-v1', true) on conflict (version) do update set approved = true;
