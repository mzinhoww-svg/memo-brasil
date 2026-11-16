"""Etapa 7c: smoke das Edge Functions no destino.

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/test_functions.py
 - sem token: purge-storage (403), payments-reconcile (401), validapay-reconcile;
 - CORS (OPTIONS) de payments-validapay a partir de https://fotosdocasamento.online;
 - cadeia do cron: executa UMA vez o comando de cada job com net.http_post
   (token lido do Vault) e lê net._http_response.
Sem credenciais de provedor no destino, nenhuma chamada sai para Mercado Pago/ValidaPay.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
out = {}
anon = sb.anon_key(dst)
for slug, method in (("purge-storage", "POST"), ("payments-reconcile", "POST"), ("payments-validapay-reconcile", "POST"), ("payments-validapay-webhook", "POST")):
    st, r, _ = sb._http(method, f"https://{dst}.supabase.co/functions/v1/{slug}", {}, {"Content-Type": "application/json"})
    out[f"{slug}_sem_token"] = st
st, r, h = sb._http("OPTIONS", f"https://{dst}.supabase.co/functions/v1/payments-validapay", None,
                    {"Origin": "https://fotosdocasamento.online", "Access-Control-Request-Method": "POST"})
out["cors_validapay"] = {"http": st, "allow_origin": h.get("Access-Control-Allow-Origin") or h.get("access-control-allow-origin")}
jobs = sb.query(dst, "select jobname, command from cron.job where command like '%net.http_post%' order by jobname")
ids = {}
for j in jobs:
    cmd = j["command"].strip().rstrip(";")
    ids[j["jobname"]] = sb.query(dst, f"{cmd} as id")[0]["id"]
time.sleep(25)
for name, rid in ids.items():
    r = sb.query(dst, f"select status_code, left(coalesce(content, error_msg, ''), 160) c, timed_out from net._http_response where id = {int(rid)}")
    out[f"cron:{name}"] = r[0] if r else "sem resposta ainda"
print(json.dumps(out, ensure_ascii=False, indent=1))
