"""Compara o esquema da origem e do destino (somente leitura nos dois).

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/schema_diff.py
Mostra só as diferenças (colunas, funções, políticas RLS, triggers, grants em
public, buckets e extensões). Saída vazia em cada seção = igual.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
CHECKS = {
 "colunas": "select table_schema||'.'||table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'') k from information_schema.columns where table_schema in ('public','supabase_migrations')",
 "funcoes": "select p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||md5(pg_get_functiondef(p.oid)) k from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'",
 "politicas": "select schemaname||'.'||tablename||'.'||policyname||':'||md5(coalesce(qual,'')||coalesce(with_check,'')||cmd||array_to_string(roles,',')) k from pg_policies where schemaname in ('public','storage')",
 "triggers": "select n.nspname||'.'||c.relname||'.'||t.tgname||':'||t.tgenabled::text||':'||md5(pg_get_triggerdef(t.oid)) k from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','auth','storage')",
 "event_triggers": "select evtname||':'||evtevent||':'||evtfoid::regproc::text||':'||evtenabled::text k from pg_event_trigger",
 "grants_tabelas": "select c.relname||':'||coalesce(r.rolname,'PUBLIC')||':'||a.privilege_type k from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a left join pg_roles r on r.oid=a.grantee where n.nspname='public' and c.relkind in ('r','v','S') and (r.rolname in ('anon','authenticated','service_role') or a.grantee=0)",
 "grants_funcoes": "select p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||coalesce(r.rolname,'PUBLIC') k from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a left join pg_roles r on r.oid=a.grantee where n.nspname='public' and (r.rolname in ('anon','authenticated','service_role') or a.grantee=0)",
 "grants_storage_auth": "select n.nspname||'.'||c.relname||':'||coalesce(r.rolname,'PUBLIC')||':'||a.privilege_type k from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a left join pg_roles r on r.oid=a.grantee where n.nspname in ('auth','storage') and c.relkind='r' and r.rolname in ('anon','authenticated','postgres')",
 "rls": "select relname||':'||relrowsecurity||':'||relforcerowsecurity k from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r'",
 "buckets": "select id||':'||public||':'||coalesce(file_size_limit::text,'')||':'||coalesce(array_to_string(allowed_mime_types,','),'') k from storage.buckets",
 "extensoes": "select extname k from pg_extension",
 "cron": "select jobname||':'||schedule||':'||active k from cron.job",
 "views": "select table_name||':'||md5(view_definition) k from information_schema.views where table_schema='public'",
}
out = {}
for name, sql in CHECKS.items():
    a = {r["k"] for r in sb.query(sb.PROD_REF, sql)}
    b = {r["k"] for r in sb.query(dst, sql)}
    out[name] = {"so_na_origem": sorted(a - b), "so_no_destino": sorted(b - a)}
print(json.dumps(out, ensure_ascii=False, indent=1))
