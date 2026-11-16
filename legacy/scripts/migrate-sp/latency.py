"""Etapa 7e: latência da API (origem × destino) a partir da máquina que roda o script.

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/latency.py [n]
Mede, com conexão reaproveitada (keep-alive), o tempo de GET /auth/v1/health e
POST /rest/v1/rpc/get_public_settings. A diferença entre as medianas é a
diferença de RTT até cada região. Daqui (EUA) São Paulo parece pior; de Cuiabá
a relação se inverte (ver o roteiro).
"""
import http.client, json, os, ssl, statistics, sys, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
proxy = urllib.parse.urlparse(os.environ["HTTPS_PROXY"]) if os.environ.get("HTTPS_PROXY") else None

def conn(host):
    if proxy:
        c = http.client.HTTPSConnection(proxy.hostname, proxy.port, context=sb._ctx, timeout=30)
        c.set_tunnel(host, 443)
    else:
        c = http.client.HTTPSConnection(host, 443, context=sb._ctx, timeout=30)
    return c

out = {}
for label, ref in (("origem_us-west-2", sb.PROD_REF), ("destino_sa-east-1", dst)):
    host = f"{ref}.supabase.co"
    key = sb.keys(ref)["publishable"]
    c = conn(host)
    c.request("GET", "/auth/v1/health", headers={"apikey": key}); c.getresponse().read()  # aquece (TLS)
    res = {}
    for name, method, path, body in (("auth_health", "GET", "/auth/v1/health", None), ("rpc_get_public_settings", "POST", "/rest/v1/rpc/get_public_settings", b"{}")):
        ts = []
        for _ in range(n):
            t = time.perf_counter()
            c.request(method, path, body=body, headers={"apikey": key, "Content-Type": "application/json"})
            r = c.getresponse(); r.read()
            ts.append((time.perf_counter() - t) * 1000)
        res[name] = {"mediana_ms": round(statistics.median(ts), 1), "p90_ms": round(sorted(ts)[int(0.9 * n) - 1], 1), "http": r.status}
    out[label] = res
d = out["destino_sa-east-1"]["auth_health"]["mediana_ms"] - out["origem_us-west-2"]["auth_health"]["mediana_ms"]
out["diferenca_rtt_estimada_ms_daqui"] = round(d, 1)
print(json.dumps(out, ensure_ascii=False, indent=1))
