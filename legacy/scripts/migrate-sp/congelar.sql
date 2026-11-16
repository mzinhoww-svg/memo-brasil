-- CONGELAR ESCRITA pela API (PostgREST/RPC) no projeto ANTIGO, no início da janela.
-- Rodar no SQL Editor do projeto antigo (o usuário roda; os scripts deste diretório nunca escrevem na origem).
-- Ensaiado no projeto de ensaio com scripts/migrate-sp/test_freeze.py.
-- Efeito: anon/authenticated não escrevem em tabelas de public nem executam funções de public
-- (inclui as RPCs SECURITY DEFINER). Leitura direta de tabelas continua; Auth e Storage seguem no ar
-- (as políticas do Storage chamam funções de public, então uploads/URLs assinadas também falham).
-- Atenção: revogar UPDATE/INSERT da tabela também revoga os privilégios POR COLUNA (ex.: UPDATE (display_name)
-- em profiles); por isso eles também são guardados.
-- Reversível com descongelar.sql (as ACLs ficam guardadas em mm_ops.freeze_acl, fora de public,
-- para não entrar na cópia de dados).
begin;
create schema if not exists mm_ops;
create table mm_ops.freeze_acl as
select 'table'::text kind, format('%I.%I', n.nspname, c.relname) obj, coalesce(r.rolname, 'public') grantee, a.privilege_type priv
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
  left join pg_roles r on r.oid = a.grantee
 where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
   and (r.rolname in ('anon', 'authenticated') or a.grantee = 0)
   and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
union all
select 'column', format('(%I) on %I.%I', a2.attname, n.nspname, c.relname), coalesce(r.rolname, 'public'), x.privilege_type
  from pg_attribute a2 join pg_class c on c.oid = a2.attrelid join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(a2.attacl) x
  left join pg_roles r on r.oid = x.grantee
 where n.nspname = 'public' and a2.attacl is not null and a2.attnum > 0 and not a2.attisdropped
   and (r.rolname in ('anon', 'authenticated') or x.grantee = 0)
   and x.privilege_type in ('INSERT', 'UPDATE')
union all
select 'function', p.oid::regprocedure::text, coalesce(r.rolname, 'public'), 'EXECUTE'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  left join pg_roles r on r.oid = a.grantee
 where n.nspname = 'public' and (r.rolname in ('anon', 'authenticated') or a.grantee = 0);
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;
notify pgrst, 'reload schema';
commit;
select count(*) as acls_guardadas from mm_ops.freeze_acl;
