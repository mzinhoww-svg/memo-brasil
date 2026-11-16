"""Etapa 1: cria o projeto de destino em sa-east-1 e espera ACTIVE_HEALTHY.

Uso: python3 -I scripts/migrate-sp/create_project.py <nome> [org_id]
A senha do banco é aleatória, gerada e usada só em memória (não é salva).
Se precisar dela depois, redefina no painel (Database > Settings).
"""
import json, secrets, string, sys, time, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

name = sys.argv[1]
org = sys.argv[2] if len(sys.argv) > 2 else "zpnbwkmukywzlkxdfeja"
alphabet = string.ascii_letters + string.digits
pw = "".join(secrets.choice(alphabet) for _ in range(40))
t0 = time.monotonic()
st, res, _ = sb.mgmt("POST", "/projects", {"name": name, "organization_id": org, "region": "sa-east-1", "db_pass": pw})
del pw
if st >= 300:
    sys.exit(f"criação falhou HTTP {st}: {res}")
ref = res["id"]
print("ref:", ref, "status:", res.get("status"), flush=True)
while True:
    time.sleep(10)
    st, p, _ = sb.mgmt("GET", f"/projects/{ref}")
    print(f"  {time.monotonic()-t0:5.0f}s {p.get('status')}", flush=True)
    if p.get("status") == "ACTIVE_HEALTHY":
        break
# a API do projeto (auth/rest/storage) às vezes demora alguns segundos a mais
for _ in range(30):
    try:
        st, h, _ = sb._http("GET", f"https://{ref}.supabase.co/auth/v1/health", headers={"apikey": sb.anon_key(ref)})
        if st == 200:
            break
    except Exception:
        pass
    time.sleep(5)
print(json.dumps({"ref": ref, "segundos_ate_saudavel": round(time.monotonic() - t0, 1)}))
