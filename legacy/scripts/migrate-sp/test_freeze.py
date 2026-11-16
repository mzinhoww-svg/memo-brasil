"""Ensaia o CONGELAMENTO de escrita (somente no destino/ensaio; nunca rode na origem por este script).

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/test_freeze.py
 1. cria um convidado anônimo de teste pelo Auth do destino;
 2. congela com congelar.sql (o mesmo arquivo que o usuário roda no projeto antigo);
 3. tenta escrever (PATCH profiles) e ler (rpc get_public_settings) via REST;
 4. descongela com descongelar.sql, confirma que a escrita volta e que as ACLs ficaram idênticas;
 5. apaga o convidado de teste.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
pub = sb.keys(dst)["publishable"]
out = {}
# 1ª tentativa (falhou no ensaio): alter role authenticator set default_transaction_read_only = on — o PostgREST abre
# as transações de escrita explicitamente como READ WRITE, então a escrita passa. Mecanismo que funciona:
# 2ª tentativa (falhou): revoke usage on schema public from anon, authenticated — eles herdam USAGE via PUBLIC.
# Mecanismo que funciona: congelar.sql / descongelar.sql (ACLs guardadas e restauradas).
HERE = os.path.dirname(os.path.abspath(__file__))
FREEZE = open(os.path.join(HERE, "congelar.sql"), encoding="utf-8").read()
THAW = open(os.path.join(HERE, "descongelar.sql"), encoding="utf-8").read()
# comparação semântica (NULL = padrão vira ACL explícita equivalente depois do grant)
ACL_SQL = """select md5(string_agg(k, ',' order by k)) h from (
  select c.relname||':'||coalesce(r.rolname,'public')||':'||a.privilege_type k from pg_class c
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a left join pg_roles r on r.oid=a.grantee
   where c.relnamespace='public'::regnamespace
  union all select c.relname||'.'||t.attname||':'||coalesce(r.rolname,'public')||':'||a.privilege_type from pg_attribute t join pg_class c on c.oid=t.attrelid
    cross join lateral aclexplode(t.attacl) a left join pg_roles r on r.oid=a.grantee
   where c.relnamespace='public'::regnamespace and t.attacl is not null
  union all select p.oid::regprocedure::text||':'||coalesce(r.rolname,'public')||':'||a.privilege_type from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a left join pg_roles r on r.oid=a.grantee
   where p.pronamespace='public'::regnamespace) t"""
st, r, _ = sb.project_http(dst, "POST", "/auth/v1/signup", {"data": {}}, key=pub)
assert st == 200, (st, r)
at, uid = r["access_token"], r["user"]["id"]
H = {"Authorization": f"Bearer {at}", "Content-Type": "application/json", "Prefer": "return=minimal"}
n_write = [0]
def write():
    n_write[0] += 1
    name = f"Teste congelamento {n_write[0]}"
    st, r, _ = sb.project_http(dst, "PATCH", f"/rest/v1/profiles?id=eq.{uid}", {"display_name": name}, headers=H, key=pub)
    gravou = sb.query(dst, f"select display_name = {sb.lit(name)} g from public.profiles where id = '{uid}'")
    return {"http": st, "code": (r or {}).get("code") if isinstance(r, dict) else None, "gravou": bool(gravou and gravou[0]["g"])}
def read():
    st, _, _ = sb.project_http(dst, "POST", "/rest/v1/rpc/get_public_settings", {}, headers={"Content-Type": "application/json"}, key=pub)
    return st
try:
    out["antes_escrita"] = write()
    t = time.monotonic()
    acl_antes = sb.query(dst, ACL_SQL)[0]["h"]
    out["congelar_acls_guardadas"] = sb.query(dst, FREEZE)[0]["acls_guardadas"]
    time.sleep(3)
    out["congelado_escrita"] = write()
    out["congelado_leitura"] = read()
    out["congelado_auth_signup"] = sb.project_http(dst, "POST", "/auth/v1/signup", {"data": {}}, key=pub)[0]
    sb.query(dst, THAW)
    time.sleep(3)
    out["descongelado_escrita"] = write()
    out["descongelado_leitura"] = read()
    out["acls_restauradas_identicas"] = sb.query(dst, ACL_SQL)[0]["h"] == acl_antes
    out["segundos_congelar_descongelar"] = round(time.monotonic() - t, 1)
finally:
    if sb.query(dst, "select to_regclass('mm_ops.freeze_acl') is not null t")[0]["t"]:
        sb.query(dst, THAW)
    sb.purge_test_users(dst, "is_anonymous and created_at > now() - interval '10 minutes'")
print(json.dumps(out, ensure_ascii=False, indent=1))
