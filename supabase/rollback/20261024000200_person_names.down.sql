-- Reversão de 20261024000200_person_names. Rodar no SQL Editor, como dono do banco.
-- 1. Tira os triggers (senão a restauração abaixo seria limpa de novo).
drop trigger if exists events_person_name on public.events;
drop trigger if exists profiles_person_name on public.profiles;
drop trigger if exists participants_person_name on public.participants;
-- 2. (Opcional) devolve os nomes anteriores a partir da auditoria do backfill.
update public.events e set host_name = b.name
  from public.audit_logs a, jsonb_to_recordset(a.detail -> 'before') as b(id uuid, name text)
 where a.action = 'system.person_names_cleaned' and a.target_type = 'events' and e.id = b.id;
update public.profiles p set display_name = b.name
  from public.audit_logs a, jsonb_to_recordset(a.detail -> 'before') as b(id uuid, name text)
 where a.action = 'system.person_names_cleaned' and a.target_type = 'profiles' and p.id = b.id;
update public.participants p set name = b.name
  from public.audit_logs a, jsonb_to_recordset(a.detail -> 'before') as b("eventId" uuid, "userId" uuid, name text)
 where a.action = 'system.person_names_cleaned' and a.target_type = 'participants' and p.event_id = b."eventId" and p.user_id = b."userId";
-- 3. Remove as funções e o registro da migration.
drop function if exists public.clean_person_names_backfill();
drop function if exists public.person_name_guard();
drop function if exists public.clean_person_name(text);
delete from supabase_migrations.schema_migrations where version = '20261024000200';
