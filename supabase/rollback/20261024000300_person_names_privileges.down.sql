-- Reversão de 20261024000300_person_names_privileges. Rodar no SQL Editor, como dono do banco.
grant execute on function public.clean_person_name(text) to public;
alter function public.person_name_guard() security invoker;
delete from supabase_migrations.schema_migrations where version = '20261024000300';
