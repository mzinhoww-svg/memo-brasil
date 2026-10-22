-- pgTAP · COM-004: aceite versionado de termos e privacidade (organizador e convidado), isolado por usuário e auditado.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'org-c1@test.local', false),
  ('00000000-0000-4000-8000-0000000000c2', 'authenticated', 'authenticated', 'org-c2@test.local', false),
  ('00000000-0000-4000-8000-0000000000c3', 'authenticated', 'authenticated', null, true);
insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000000c1'), ('00000000-0000-4000-8000-0000000000c2'), ('00000000-0000-4000-8000-0000000000c3') on conflict do nothing;
insert into public.events (id, title, category, host_id, host_name, duration_hours)
  values ('00000000-0000-4000-8000-0000000000d1', 'Consent', 'casamento', '00000000-0000-4000-8000-0000000000c1', 'Host', 6);
insert into public.participants (event_id, user_id, name) values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c3', 'Convidado');

-- estrutura
select has_table('public', 'user_consents', 'tabela de aceites existe');
select has_table('public', 'legal_documents', 'versões publicadas existem');
select ok((select relrowsecurity from pg_class where oid = 'public.user_consents'::regclass), 'RLS ligada em user_consents');
select ok(exists (select 1 from public.legal_documents where kind = 'terms') and exists (select 1 from public.legal_documents where kind = 'privacy'), 'há versão publicada de termos e de privacidade');

-- sem sessão
set local role anon;
select throws_ok($$select public.record_consent('2026-10-21-rascunho', '2026-10-21-rascunho', 'convidado', null)$$, '42501', null, 'anon não executa record_consent');
reset role;

-- organizador com conta grava; reenvio é idempotente; auditado
select tests.login('00000000-0000-4000-8000-0000000000c1');
select lives_ok($$select public.record_consent('2026-10-21-rascunho', '2026-10-21-rascunho', 'organizador', null)$$, 'organizador grava o aceite');
select lives_ok($$select public.record_consent('2026-10-21-rascunho', '2026-10-21-rascunho', 'organizador', null)$$, 'reenvio após falha de rede não duplica');
select is((select count(*)::int from public.user_consents), 1, 'uma linha, do próprio usuário');
select is((select terms_version || '|' || privacy_version || '|' || role from public.user_consents), '2026-10-21-rascunho|2026-10-21-rascunho|organizador', 'versões e papel gravados');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'consent.recorded' and actor_id = '00000000-0000-4000-8000-0000000000c1'), 1, 'auditoria registra o aceite uma vez, com o ator autenticado');
select ok((select accepted_at from public.user_consents) between now() - interval '1 minute' and now() + interval '1 minute', 'horário vem do servidor');

-- recusas
select tests.login('00000000-0000-4000-8000-0000000000c1');
select throws_ok($$select public.record_consent('versao-inexistente', '2026-10-21-rascunho', 'organizador', null)$$, 'MM005', null, 'versão de termos desconhecida é recusada');
select throws_ok($$select public.record_consent('2026-10-21-rascunho', 'versao-inexistente', 'organizador', null)$$, 'MM005', null, 'versão de privacidade desconhecida é recusada');
select throws_ok($$select public.record_consent('2026-10-21-rascunho', '2026-10-21-rascunho', 'master', null)$$, 'MM005', null, 'papel inválido é recusado');
select throws_ok($$select public.record_consent('2026-10-21-rascunho', '2026-10-21-rascunho', 'convidado', '00000000-0000-4000-8000-0000000000d1')$$, 'MM004', null, 'host não registra aceite de convidado do próprio evento sem ser membro');
select lives_ok($$select public.record_consent('2026-10-21-rascunho', '2026-10-21-rascunho', 'organizador', '00000000-0000-4000-8000-0000000000d1')$$, 'host registra o aceite de organizador vinculado ao próprio evento');
reset role;

-- convidado anônimo: grava como convidado; não como organizador
select tests.login('00000000-0000-4000-8000-0000000000c3', true);
select throws_ok($$select public.record_consent('2026-10-21-rascunho', '2026-10-21-rascunho', 'organizador', null)$$, 'MM004', null, 'anônimo não aceita como organizador');
select lives_ok($$select public.record_consent('2026-10-21-rascunho', '2026-10-21-rascunho', 'convidado', null)$$, 'convidado anônimo aceita antes de entrar');
select lives_ok($$select public.record_consent('2026-10-21-rascunho', '2026-10-21-rascunho', 'convidado', '00000000-0000-4000-8000-0000000000d1')$$, 'membro registra o aceite vinculado ao evento');
select throws_ok($$select public.record_consent('2026-10-21-rascunho', '2026-10-21-rascunho', 'convidado', '00000000-0000-4000-8000-0000000000ff')$$, 'MM004', null, 'evento inexistente ou alheio é recusado');
reset role;

-- isolamento e escrita direta
select tests.login('00000000-0000-4000-8000-0000000000c2');
select is((select count(*)::int from public.user_consents), 0, 'outro usuário não lê aceites alheios');
select throws_ok($$insert into public.user_consents (user_id, role, terms_version, privacy_version) values ('00000000-0000-4000-8000-0000000000c2', 'organizador', 'x', 'y')$$, '42501', null, 'INSERT direto é negado');
select throws_ok($$update public.user_consents set role = 'organizador'$$, '42501', null, 'UPDATE direto é negado');
select throws_ok($$delete from public.user_consents$$, '42501', null, 'DELETE direto é negado');
reset role;

select * from finish();
rollback;
