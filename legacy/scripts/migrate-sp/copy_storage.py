"""Etapa 4: copia buckets e objetos do Storage (origem só leitura).

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/copy_storage.py [--so-verificar]

 - Buckets: mesma config (public, file_size_limit, allowed_mime_types); cria ou atualiza.
 - Lista de objetos: SELECT em storage.objects da origem (read_only).
 - Download: GET /storage/v1/object/authenticated/<bucket>/<path> com service_role da origem.
 - Upload: POST /storage/v1/object/<bucket>/<path> com service_role do destino,
   mesmo caminho, content-type e cache-control (x-upsert: true, retomável).
 - Depois alinha owner_id/owner/user_metadata/created_at por SQL no destino.
 - Compara (bucket, nome, tamanho, mimetype, md5 do conteúdo baixado do destino).
"""
import hashlib, json, os, sys, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
SRC = sb.PROD_REF
only_verify = "--so-verificar" in sys.argv
log = {"destino": dst}
t0 = time.monotonic()

def enc(path):
    return "/".join(urllib.parse.quote(p, safe="") for p in path.split("/"))

with sb.Timer("buckets", log):
    st, src_b, _ = sb.project_http(SRC, "GET", "/storage/v1/bucket")
    assert st == 200, (st, src_b)
    st, dst_b, _ = sb.project_http(dst, "GET", "/storage/v1/bucket")
    have = {b["id"] for b in dst_b}
    for b in src_b:
        body = {"id": b["id"], "name": b["name"], "public": b["public"], "file_size_limit": b.get("file_size_limit"), "allowed_mime_types": b.get("allowed_mime_types")}
        if not only_verify:
            if b["id"] in have:
                st, r, _ = sb.project_http(dst, "PUT", f"/storage/v1/bucket/{b['id']}", body)
            else:
                st, r, _ = sb.project_http(dst, "POST", "/storage/v1/bucket", body)
            assert st < 300, (b["id"], st, r)
    log["buckets"] = [{k: b.get(k) for k in ("id", "public", "file_size_limit", "allowed_mime_types")} for b in src_b]

objs = sb.query(SRC, "select bucket_id b, name n, metadata->>'size' s, metadata->>'mimetype' m, metadata->>'cacheControl' c from storage.objects order by 1, 2")
log["objetos_origem"] = len(objs)
log["bytes_origem"] = sum(int(o["s"] or 0) for o in objs)

hashes = {}
def copy_one(o):
    st, data, h = sb.project_http(SRC, "GET", f"/storage/v1/object/authenticated/{o['b']}/{enc(o['n'])}", raw=True)
    if st != 200:
        return (o, f"download HTTP {st}")
    hashes[(o["b"], o["n"])] = hashlib.md5(data).hexdigest()
    if only_verify:
        return (o, None)
    headers = {"Content-Type": o["m"] or h.get("Content-Type", "application/octet-stream"), "x-upsert": "true"}
    if o["c"]:
        headers["Cache-Control"] = o["c"] if o["c"].startswith("max-age") else f"max-age={o['c']}"
    st, r, _ = sb.project_http(dst, "POST", f"/storage/v1/object/{o['b']}/{enc(o['n'])}", data, headers=headers)
    return (o, None if st < 300 else f"upload HTTP {st}: {str(r)[:200]}")

with sb.Timer("objetos", log):
    with ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(copy_one, objs))
    errs = [{"obj": f"{o['b']}/{o['n']}", "erro": e} for o, e in results if e]
    log["erros"] = errs

if not only_verify:
    with sb.Timer("metadados_sql", log):
        meta = sb.query(SRC, "select coalesce(json_agg(json_build_object('b', bucket_id, 'n', name, 'owner', owner, 'owner_id', owner_id, 'um', user_metadata, 'ca', created_at)), '[]'::json) j from storage.objects")[0]["j"]
        if isinstance(meta, str):
            meta = json.loads(meta)
        tag = "$mm" + os.urandom(6).hex() + "$"
        try:
            sb.query(dst, f"update storage.objects o set owner = m.owner, owner_id = m.owner_id, user_metadata = m.um, created_at = m.ca from json_to_recordset({tag}{json.dumps(meta)}{tag}::json) as m(b text, n text, owner uuid, owner_id text, um jsonb, ca timestamptz) where o.bucket_id = m.b and o.name = m.n")
            log["metadados_sql"] = "ok"
        except Exception as e:
            log["metadados_sql"] = f"falhou: {str(e)[:300]}"

with sb.Timer("verificacao", log):
    q = "select bucket_id||'/'||name||':'||coalesce(metadata->>'size','')||':'||coalesce(metadata->>'mimetype','')||':'||coalesce(owner_id,'') k from storage.objects"
    a = {r["k"] for r in sb.query(SRC, q)}
    b = {r["k"] for r in sb.query(dst, q)}
    log["so_origem"] = sorted(a - b); log["so_destino"] = sorted(b - a)
    def h_dst(o):
        st, data, _ = sb.project_http(dst, "GET", f"/storage/v1/object/authenticated/{o['b']}/{enc(o['n'])}", raw=True)
        return st == 200 and hashlib.md5(data).hexdigest() == hashes.get((o["b"], o["n"]))
    with ThreadPoolExecutor(max_workers=4) as ex:
        same = list(ex.map(h_dst, objs))
    log["conteudo_md5_igual"] = f"{sum(same)}/{len(objs)}"
    log["tudo_igual"] = not log["so_origem"] and not log["so_destino"] and all(same) and not log["erros"]
log["segundos_total"] = round(time.monotonic() - t0, 1)
print(json.dumps(log, ensure_ascii=False, indent=1))
