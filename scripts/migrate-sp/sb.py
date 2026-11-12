"""Biblioteca comum da migração para São Paulo (sa-east-1).

Tudo passa por HTTPS: Management API (api.supabase.com) e os hosts do projeto
(<ref>.supabase.co). Nenhum segredo é impresso ou gravado: chaves ficam só em
memória (cache deste módulo).

TRAVA DE SEGURANÇA: o projeto de origem (PROD_REF) é somente leitura.
 - Management API: só GET, e POST /database/query com read_only=true e SQL
   iniciado por SELECT/WITH/SHOW/EXPLAIN (sem ';' fora de literais no meio).
 - Hosts do projeto: só GET (Storage download/listagem via POST /object/list e
   POST /object/sign são liberados porque não escrevem nada).
Rode com: python3 -I scripts/migrate-sp/<script>.py
"""
import json, os, re, ssl, sys, time, urllib.request, urllib.error, uuid

PROD_REF = os.environ.get("MIGRATE_SRC_REF", "asyaegeodyttttaubvxh")
API = "https://api.supabase.com/v1"
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN_PLACEHOLDER", "dummy")  # o proxy injeta o token real
_CA = "/root/.ccr/ca-bundle.crt"
_ctx = ssl.create_default_context(cafile=_CA) if os.path.exists(_CA) else ssl.create_default_context()
_keys = {}

class ProdWriteBlocked(RuntimeError):
    pass

def _http(method, url, body=None, headers=None, raw=False, timeout=120):
    data = None
    h = dict(headers or {})
    if body is not None:
        if isinstance(body, (bytes, bytearray)):
            data = bytes(body)
        else:
            data = json.dumps(body).encode()
            h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, context=_ctx, timeout=timeout) as r:
                payload = r.read()
                return r.status, (payload if raw else _decode(payload)), dict(r.headers)
        except urllib.error.HTTPError as e:
            payload = e.read()
            if e.code in (429, 502, 503, 504) and attempt < 4:
                time.sleep(2 + attempt * 3)
                continue
            return e.code, (payload if raw else _decode(payload)), dict(e.headers)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt < 4:
                time.sleep(2 + attempt * 3)
                continue
            raise

def _decode(b):
    try:
        return json.loads(b) if b else None
    except ValueError:
        return b.decode("utf-8", "replace")

_READ_SQL = re.compile(r"^\s*(select|with|show|explain)\b", re.I)

def _strip_literals(sql):
    sql = re.sub(r"\$([a-z_]*)\$.*?\$\1\$", "''", sql, flags=re.S | re.I)
    sql = re.sub(r"'(?:[^']|'')*'", "''", sql)
    return sql

def _assert_read_sql(sql):
    s = _strip_literals(sql).strip().rstrip(";")
    if not _READ_SQL.match(s) or ";" in s:
        raise ProdWriteBlocked("SQL não é uma leitura única; bloqueado para o projeto de origem")
    if re.search(r"\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|copy|call|vacuum|refresh|setval|nextval|pg_terminate_backend|dblink|set_config|lo_import|lo_export)\b|net\.http_\w+\s*\(|cron\.(schedule|unschedule|alter_job)\b", s, re.I):
        raise ProdWriteBlocked("SQL contém palavra de escrita; bloqueado para o projeto de origem")

def mgmt(method, path, body=None, raw_body=None, headers=None, ref_for_guard=None):
    if PROD_REF in path or ref_for_guard == PROD_REF:
        ok = method == "GET" or (method == "POST" and path.endswith("/database/query") and isinstance(body, dict) and body.get("read_only") is True)
        if not ok:
            raise ProdWriteBlocked(f"{method} {path} bloqueado no projeto de origem")
        if method == "POST":
            _assert_read_sql(body["query"])
    h = {"Authorization": f"Bearer {TOKEN}"}
    h.update(headers or {})
    return _http(method, API + path, raw_body if raw_body is not None else body, h)

def query(ref, sql, timeout=180):
    """Executa SQL pela Management API. Na origem sempre read_only."""
    body = {"query": sql}
    if ref == PROD_REF:
        body["read_only"] = True
    st, res, _ = mgmt("POST", f"/projects/{ref}/database/query", body)
    if st >= 300:
        msg = res.get("message") if isinstance(res, dict) else res
        raise RuntimeError(f"query {ref} HTTP {st}: {str(msg)[:1500]}")
    return res

def keys(ref):
    """service_role/anon (legadas) e secret/publishable, só em memória."""
    if ref not in _keys:
        st, res, _ = mgmt("GET", f"/projects/{ref}/api-keys?reveal=true")
        if st != 200:
            raise RuntimeError(f"api-keys {ref} HTTP {st}")
        k = {}
        for item in res:
            name, typ, val = item.get("name"), item.get("type"), item.get("api_key")
            if not val:
                continue
            if typ == "legacy" and name in ("anon", "service_role"):
                k[name] = val
            elif typ == "publishable":
                k.setdefault("publishable", val)
            elif typ == "secret":
                k.setdefault("secret", val)
        _keys[ref] = k
    return _keys[ref]

def service_key(ref):
    k = keys(ref)
    return k.get("service_role") or k["secret"]

def anon_key(ref):
    k = keys(ref)
    return k.get("anon") or k["publishable"]

def project_http(ref, method, path, body=None, headers=None, raw=False, key=None, timeout=120):
    if ref == PROD_REF:
        allowed = method == "GET" or (method == "POST" and re.match(r"^/storage/v1/object/(list|sign)/", path))
        if not allowed:
            raise ProdWriteBlocked(f"{method} {path} bloqueado no projeto de origem")
    k = key or service_key(ref)
    h = {"apikey": k}
    if k.count(".") == 2:  # JWT legado também vai no Authorization
        h["Authorization"] = f"Bearer {k}"
    h.update(headers or {})
    return _http(method, f"https://{ref}.supabase.co{path}", body, h, raw=raw, timeout=timeout)

def lit(v):
    """Literal SQL seguro para valores vindos do banco (texto)."""
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

def purge_test_users(dst, where_sql):
    """Apaga usuários de TESTE do destino e tudo que depende deles. Em modo replica o ON DELETE CASCADE
    não dispara, então os dependentes são apagados explicitamente (sem disparar triggers de auditoria)."""
    return query(dst, f"""begin; set local session_replication_role = replica;
      create temp table mm_purge on commit drop as select id from auth.users where {where_sql};
      delete from auth.mfa_amr_claims where session_id in (select id from auth.sessions where user_id in (select id from mm_purge));
      delete from auth.refresh_tokens where user_id::uuid in (select id from mm_purge);
      delete from auth.sessions where user_id in (select id from mm_purge);
      delete from auth.identities where user_id in (select id from mm_purge);
      delete from public.participants where user_id in (select id from mm_purge);
      delete from public.profiles where id in (select id from mm_purge);
      delete from auth.users where id in (select id from mm_purge);
      select (select count(*) from mm_purge) n; commit;""")[0]["n"]

class Timer:
    def __init__(self, label, log):
        self.label, self.log = label, log
    def __enter__(self):
        self.t = time.monotonic(); return self
    def __exit__(self, *a):
        dt = time.monotonic() - self.t
        self.log.setdefault("tempos", {})[self.label] = round(dt, 1)
        print(f"[tempo] {self.label}: {dt:.1f}s", flush=True)

def target_ref():
    ref = os.environ.get("MIGRATE_DST_REF")
    if not ref:
        sys.exit("defina MIGRATE_DST_REF (ref do projeto de destino)")
    if ref == PROD_REF:
        sys.exit("destino não pode ser o projeto de origem")
    return ref
