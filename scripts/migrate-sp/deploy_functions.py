"""Etapa 5a: publica as Edge Functions no destino com o MESMO verify_jwt da origem.

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/deploy_functions.py [slug ...]
Sem slugs: publica as funções que existem na origem (GET /functions da origem).
Multipart: index.ts (entrypoint) + ../_shared/*.ts (sem testes), metadata
{"name", "entrypoint_path": "index.ts", "verify_jwt"}.
"""
import json, os, sys, time, uuid, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "supabase", "functions"))
st, src_fns, _ = sb.mgmt("GET", f"/projects/{sb.PROD_REF}/functions")
assert st == 200
verify = {f["slug"]: bool(f.get("verify_jwt")) for f in src_fns}
slugs = sys.argv[1:] or [f["slug"] for f in src_fns]
shared = [p for p in sorted(glob.glob(os.path.join(root, "_shared", "*.ts"))) if not p.endswith(".test.ts")]

def multipart(fields, files):
    b = "----mm" + uuid.uuid4().hex
    out = bytearray()
    for name, val in fields:
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{val}\r\n".encode()
    for name, fname, data in files:
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{fname}\"\r\nContent-Type: application/typescript\r\n\r\n".encode() + data + b"\r\n"
    out += f"--{b}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={b}"

report = []
t0 = time.monotonic()
for slug in slugs:
    idx = os.path.join(root, slug, "index.ts")
    if not os.path.exists(idx):
        report.append({"slug": slug, "erro": "sem código no repositório"}); continue
    vj = verify.get(slug, True)
    files = [("file", "index.ts", open(idx, "rb").read())]
    files += [("file", f"../_shared/{os.path.basename(p)}", open(p, "rb").read()) for p in shared]
    body, ctype = multipart([("metadata", json.dumps({"name": slug, "entrypoint_path": "index.ts", "verify_jwt": vj}))], files)
    t = time.monotonic()
    st, res, _ = sb.mgmt("POST", f"/projects/{dst}/functions/deploy?slug={slug}", raw_body=body, headers={"Content-Type": ctype})
    report.append({"slug": slug, "http": st, "verify_jwt": vj, "versao": (res or {}).get("version") if isinstance(res, dict) else None,
                   "s": round(time.monotonic() - t, 1), **({} if st < 300 else {"erro": str(res)[:300]})})
    print(report[-1], flush=True)
st, now, _ = sb.mgmt("GET", f"/projects/{dst}/functions")
mism = [f["slug"] for f in now if f["slug"] in verify and bool(f.get("verify_jwt")) != verify[f["slug"]]]
print(json.dumps({"publicadas": len(now), "verify_jwt_divergente": mism, "segundos": round(time.monotonic() - t0, 1)}))
