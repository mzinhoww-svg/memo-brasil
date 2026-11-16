-- LIGAR o álbum pessoal (Minhas Fotos SEM biometria) — SQL Editor, depois de publish_smart_album.sql.
-- A busca facial continua desligada (gate jurídico NO-GO): nada aqui liga reconhecimento facial.
-- Escolha UMA das opções. Auditado em audit_logs com o motivo.
begin;
select set_config('mm.audit_reason', 'Liberar o álbum pessoal Minhas Fotos (sem biometria)', true);
-- (a) todos os eventos:
insert into public.feature_flags (key, enabled, rollout) values ('smart_album_ui', true, '{}')
on conflict (key) do update set enabled = excluded.enabled, rollout = excluded.rollout;
-- (b) só um evento de teste (troque o uuid e use no lugar de (a)):
-- insert into public.feature_flags (key, enabled, rollout) values ('smart_album_ui', true, '{"events":["<uuid-do-evento>"]}')
-- on conflict (key) do update set enabled = excluded.enabled, rollout = excluded.rollout;
commit;
-- DESLIGAR: update public.feature_flags set enabled = false where key = 'smart_album_ui';
