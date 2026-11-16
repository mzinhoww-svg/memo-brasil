"""Reconciliação: diferenças linha a linha entre origem e destino (somente leitura nos dois).

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/diff_rows.py [schema.tabela ...]
Sem argumentos: todas as tabelas de public. Imprime só as CHAVES (PK) e os nomes das
colunas que mudaram (nenhum valor pessoal), em três grupos: só na origem, só no
destino e alteradas. Use depois da virada (o que entrou no antigo durante a janela) ou
num rollback (o que foi escrito no novo e precisa voltar ao antigo).
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
SRC = sb.PROD_REF
tables = sys.argv[1:] or ["public." + r["t"] for r in sb.query(SRC, "select relname t from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1")]

def pk(fq):
    r = sb.query(SRC, f"select a.attname n from pg_index x join pg_attribute a on a.attrelid=x.indrelid and a.attnum=any(x.indkey) where x.indrelid='{fq}'::regclass and x.indisprimary")
    return [x["n"] for x in r]

def rows(ref, fq, keys):
    k = " || '|' || ".join(f"coalesce({c}::text,'')" for c in keys)
    res = sb.query(ref, f"select {k} k, to_jsonb(t) j from {fq} t")
    return {r["k"]: (r["j"] if isinstance(r["j"], dict) else json.loads(r["j"])) for r in res}

out = {}
for fq in tables:
    keys = pk(fq)
    if not keys:
        out[fq] = "sem PK: compare com copy_data.py --so-verificar"; continue
    a, b = rows(SRC, fq, keys), rows(dst, fq, keys)
    changed = {k: sorted(c for c in set(a[k]) | set(b[k]) if a[k].get(c) != b[k].get(c)) for k in a.keys() & b.keys() if a[k] != b[k]}
    if a.keys() - b.keys() or b.keys() - a.keys() or changed:
        out[fq] = {"so_na_origem": sorted(a.keys() - b.keys()), "so_no_destino": sorted(b.keys() - a.keys()), "alteradas": changed}
print(json.dumps(out or {"resultado": "nenhuma diferença"}, ensure_ascii=False, indent=1))
