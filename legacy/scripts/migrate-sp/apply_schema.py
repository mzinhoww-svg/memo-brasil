"""Etapa 2: aplica supabase/migrations/*.sql em ordem no projeto de destino.

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/apply_schema.py
 - habilita antes pg_cron e pg_net (vault já vem habilitado em projeto novo);
 - cria supabase_migrations.schema_migrations e registra cada arquivo;
 - pula arquivos já registrados (retomável);
 - no fim DESATIVA todos os jobs do pg_cron do destino (são recriados por
   rewrite_refs.py com o ref novo; ficam desligados até a virada).
"""
import glob, os, sys, time, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
files = sorted(glob.glob(os.path.join(root, "supabase", "migrations", "*.sql")))
t0 = time.monotonic()
sb.query(dst, """
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
""")
done = {r["version"] for r in sb.query(dst, "select version from supabase_migrations.schema_migrations")}
for f in files:
    base = os.path.basename(f)[:-4]
    version, name = base.split("_", 1)
    if version in done:
        continue
    sql = open(f, encoding="utf-8").read()
    t = time.monotonic()
    try:
        sb.query(dst, sql, timeout=300)
    except Exception as e:
        sys.exit(f"FALHOU {base}: {e}")
    sb.query(dst, f"insert into supabase_migrations.schema_migrations(version, name, statements) values ({sb.lit(version)}, {sb.lit(name)}, array[{sb.lit(sql)}])")
    print(f"ok {base} ({time.monotonic()-t:.1f}s)", flush=True)
jobs = sb.query(dst, "select jobid, jobname from cron.job order by jobid")
for j in jobs:
    sb.query(dst, f"select cron.alter_job(job_id := {int(j['jobid'])}, active := false)")
n = sb.query(dst, "select count(*) c from supabase_migrations.schema_migrations")[0]["c"]
print(json.dumps({"migrations_registradas": n, "jobs_desativados": [j["jobname"] for j in jobs], "segundos": round(time.monotonic() - t0, 1)}))
