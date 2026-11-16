"""Etapa 7b: roda supabase/tests/database/*.test.sql no DESTINO (nunca na origem).

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/run_pgtap.py [arquivo ...]
Cada arquivo roda numa única chamada; o `select * from finish(); rollback;` final
é trocado por um bloco que lê __tresults__ e termina com RAISE EXCEPTION
(o erro carrega o resumo e garante o rollback de tudo que o teste fez).
Atenção: o destino tem os dados reais copiados; testes que supõem banco vazio
podem falhar por isso (não por defeito da migração).
"""
import glob, json, os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
files = sys.argv[1:] or sorted(glob.glob(os.path.join(root, "supabase", "tests", "database", "*.test.sql")))
sb.query(dst, "create extension if not exists pgtap with schema extensions")
HEAD = """set search_path = public, extensions;
create temp table mm_fail(n serial, descr text);
grant all on mm_fail to public; grant all on sequence mm_fail_n_seq to public;
create function public.ok(boolean, text) returns text language plpgsql as $mmok$
begin
  if not coalesce($1, false) then insert into pg_temp.mm_fail(descr) values ($2); end if;
  return extensions.ok($1, $2);
end $mmok$;
"""
TAIL = """
reset role;
do $mmtap$ declare f int; t int; d text; begin
  f := coalesce(extensions._get('failed'), 0);
  t := currval('__tresults___numb_seq');
  select string_agg(descr, ' | ' order by n) into d from pg_temp.mm_fail;
  raise exception 'MMTAP total=% falhas=% %', t, f, coalesce(left(d, 1500), '');
end $mmtap$;
"""
res = []
t0 = time.monotonic()
for f in files:
    sql = open(f, encoding="utf-8").read()
    if "\\gset" in sql or re.search(r"^\s*\\ir\b", sql, re.M):
        res.append({"arquivo": os.path.basename(f), "pulado": "usa meta-comando do psql (\\gset/\\ir): rodar com supabase test db"}); print(res[-1]); continue
    body, n = re.subn(r"select\s+\*\s+from\s+finish\(\)\s*;\s*rollback\s*;\s*$", TAIL, sql.rstrip() + "\n", flags=re.I)
    if n != 1:
        res.append({"arquivo": os.path.basename(f), "erro": "formato final inesperado"}); continue
    body = body.replace("begin;", "begin;\n" + HEAD, 1)
    try:
        sb.query(dst, body, timeout=300)
        res.append({"arquivo": os.path.basename(f), "erro": "terminou sem o resumo (não deveria)"})
    except RuntimeError as e:
        m = re.search(r"MMTAP total=(\d+) falhas=(\d+) ?(.*)", str(e), re.S)
        if m:
            res.append({"arquivo": os.path.basename(f), "total": int(m[1]), "falhas": int(m[2]), **({"detalhe": m[3].strip()[:600]} if int(m[2]) else {})})
        else:
            res.append({"arquivo": os.path.basename(f), "erro": str(e)[:600]})
    print(res[-1], flush=True)
ok = sum(1 for r in res if r.get("falhas") == 0)
print(json.dumps({"arquivos": len(res), "sem_falha": ok, "pulados": sum(1 for r in res if "pulado" in r), "segundos": round(time.monotonic() - t0, 1)}))
