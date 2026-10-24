-- clean_person_name (20261024000200) nasceu com o EXECUTE padrão de public, e o PostgREST a expunha como RPC para anon
-- e authenticated. Regra do console: nada novo acessível sem papel de plataforma. O trigger passa a rodar como dono
-- (security definer), então o cliente continua gravando nomes e o trigger continua limpando.
-- Aditiva. Reversão: supabase/rollback/20261024000300_person_names_privileges.down.sql.
alter function public.person_name_guard() security definer;
revoke execute on function public.clean_person_name(text) from public, anon, authenticated;
