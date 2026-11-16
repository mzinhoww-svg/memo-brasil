"""Etapa 5b: config de Auth e inventário de secrets.

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/copy_config.py [--aplicar]

 - Auth: GET /config/auth da origem; envia ao destino (PATCH) os campos que
   diferem, exceto segredos (a API devolve mascarado/ausente). Sem --aplicar só
   mostra o diff.
 - Secrets das Edge Functions: lista só os NOMES da origem e classifica:
     plataforma  = SUPABASE_* (o projeto novo já tem os seus)
     regenerado  = gerados por rewrite_refs.py (tokens internos do cron)
     manual      = o usuário precisa digitar de novo (valor não é legível)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
apply = "--aplicar" in sys.argv
SECRETISH = ("secret", "password", "_pass", "api_key", "auth_token", "access_key", "smtp_pass")
st, a, _ = sb.mgmt("GET", f"/projects/{sb.PROD_REF}/config/auth"); assert st == 200
st, b, _ = sb.mgmt("GET", f"/projects/{dst}/config/auth"); assert st == 200
manual_auth, diff = [], {}
for k, v in a.items():
    if any(w in k for w in SECRETISH) and not k.startswith("mailer_") and not k.startswith("security_update_password") and k not in ("password_min_length", "password_required_characters", "password_hibp_enabled"):
        if v not in (None, "", False):
            manual_auth.append(k)
        continue
    if b.get(k) != v:
        diff[k] = v
out = {"auth_campos_diferentes": sorted(diff), "auth_segredos_manuais": manual_auth,
       "site_url": a.get("site_url"), "uri_allow_list": a.get("uri_allow_list"),
       "anonimos": a.get("external_anonymous_users_enabled"), "google": a.get("external_google_enabled"),
       "email": a.get("external_email_enabled"), "jwt_exp": a.get("jwt_exp"), "smtp_host": a.get("smtp_host")}
if apply and diff:
    body, rejected = dict(diff), []
    for _ in range(20):
        st, r, _ = sb.mgmt("PATCH", f"/projects/{dst}/config/auth", body)
        if st < 300:
            break
        msg = json.dumps(r)
        bad = [k for k in body if k in msg]
        if not bad:
            out["patch_erro"] = msg[:500]; break
        for k in bad:
            rejected.append({"campo": k, "erro": msg[:200]}); body.pop(k)
    out["patch_http"] = st
    out["auth_rejeitados"] = rejected
    st, b2, _ = sb.mgmt("GET", f"/projects/{dst}/config/auth")
    out["auth_ainda_diferentes"] = sorted(k for k in diff if b2.get(k) != a.get(k))
st, s, _ = sb.mgmt("GET", f"/projects/{sb.PROD_REF}/secrets"); assert st == 200
st, sd, _ = sb.mgmt("GET", f"/projects/{dst}/secrets")
dnames = {x["name"] for x in sd}
regen = {"PAYMENTS_CRON_TOKEN", "VALIDAPAY_PRODUCTION_RECONCILE_TOKEN"}
cls = {}
for x in sorted(s, key=lambda x: x["name"]):
    n = x["name"]
    if n.startswith("SUPABASE_"):
        cls[n] = "plataforma"
    elif n in regen:
        cls[n] = "regenerado" + (" (ok no destino)" if n in dnames else " (FALTA no destino)")
    else:
        cls[n] = "manual" + (" (já definido no destino)" if n in dnames else "")
out["secrets"] = cls
print(json.dumps(out, ensure_ascii=False, indent=1))
