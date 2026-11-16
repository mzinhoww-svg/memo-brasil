"""Etapa 7d: build do app apontando para o destino, next start na 3270 e smoke Playwright.

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/smoke_app.py [--sem-build]
A chave publicável do destino só existe no ambiente do processo filho (não é
impressa nem gravada; o build a embute em web/.next, que é ignorado pelo git e
é uma chave pública). Escolhe um evento real copiado (não apagado) para /e/<código>
sem imprimir o código. Para o servidor no fim (fuser -k 3270/tcp).
"""
import json, os, subprocess, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
web = os.path.join(root, "web")
k = sb.keys(dst)
env = dict(os.environ, NEXT_PUBLIC_MM_BACKEND="supabase", NEXT_PUBLIC_SUPABASE_URL=f"https://{dst}.supabase.co",
           NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=k.get("publishable") or k["anon"], NEXT_TELEMETRY_DISABLED="1")
cols = {r["c"] for r in sb.query(dst, "select column_name c from information_schema.columns where table_schema='public' and table_name='events'")}
where = ["true"]
if "deleted_at" in cols: where.append("deleted_at is null")
if "is_test" in cols: where.append("not is_test")
ev = sb.query(dst, f"select code from public.events where {' and '.join(where)} order by created_at desc limit 1")
if not ev:
    ev = sb.query(dst, "select code from public.events order by created_at desc limit 1")
out = {"tempos": {}}
t_smoke = sb.query(dst, "select now() t")[0]["t"]
t = time.monotonic()
if "--sem-build" not in sys.argv:
    r = subprocess.run(["npm", "run", "build"], cwd=web, env=env, capture_output=True, text=True)
    out["tempos"]["build"] = round(time.monotonic() - t, 1)
    if r.returncode != 0:
        print(r.stdout[-3000:], r.stderr[-3000:]); sys.exit("build falhou")
subprocess.run("fuser -k 3270/tcp", shell=True, capture_output=True)
srv = subprocess.Popen(["npx", "next", "start", "-p", "3270"], cwd=web, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try:
            urllib.request.urlopen("http://localhost:3270/", timeout=5); break
        except Exception:
            time.sleep(1)
    senv = dict(os.environ, SMOKE_BASE="http://localhost:3270", SMOKE_CODE=ev[0]["code"], SMOKE_SUPABASE_HOST=f"{dst}.supabase.co",
                SMOKE_SHOT=os.environ.get("SMOKE_SHOT", "/dev/null"))
    r = subprocess.run(["node", os.path.join(root, "scripts", "migrate-sp", "smoke.mjs")], cwd=web, env=senv, capture_output=True, text=True, timeout=300)
    out["smoke"] = json.loads(r.stdout) if r.returncode == 0 else {"erro": (r.stderr or r.stdout)[-1500:]}
finally:
    srv.terminate()
    subprocess.run("fuser -k 3270/tcp", shell=True, capture_output=True)
    # remove só o(s) convidado(s) anônimo(s) criado(s) pelo próprio smoke (antes da virada do DNS/Vercel)
    out["convidados_do_smoke_removidos"] = sb.purge_test_users(dst, f"is_anonymous and created_at >= {sb.lit(t_smoke)}::timestamptz")
    sb.query(dst, f"delete from public.rate_limits where window_start >= {sb.lit(t_smoke)}::timestamptz")
print(json.dumps(out, ensure_ascii=False, indent=1))
