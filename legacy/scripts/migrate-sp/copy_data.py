"""Etapa 3: copia os dados da origem (somente leitura) para o destino, por SQL via API.

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/copy_data.py [--so-verificar]

 - Esquemas: auth (users, identities, sessions, refresh_tokens, mfa_*, ...;
   tudo que tem linha, menos schema_migrations/instances) e todas as tabelas de
   public, em ordem topológica pelas FKs.
 - Leitura: SELECT paginado por PK na origem (read_only=true, papel
   supabase_read_only_user). Escrita: insert ... select from
   json_populate_recordset(...) no destino, dentro de uma transação com
   `set local session_replication_role = replica` (desliga triggers de negócio
   e checagem de FK durante a carga).
 - Destino é ESVAZIADO antes (truncate das tabelas copiadas): os seeds das
   migrations (plans, legal_documents, platform_settings...) são substituídos
   pelos valores reais.
 - Colunas geradas são puladas; identity ALWAYS usa OVERRIDING SYSTEM VALUE.
 - Sequences de public E auth (ex.: auth.refresh_tokens_id_seq): setval com o maior entre
   o last_value da origem e o max() da coluna no destino.
 - Vault NÃO é copiado (a origem não deixa decifrar em modo leitura):
   rewrite_refs.py regera os segredos internos.
 - Ao fim compara contagem e md5(string_agg(linha::text ordenado pela PK)) por tabela.
"""
import json, os, secrets, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
SRC = sb.PROD_REF
only_verify = "--so-verificar" in sys.argv
AUTH_SKIP = {"schema_migrations", "instances"}
PAGE = 400

def tables(ref, schema):
    return [r["t"] for r in sb.query(ref, f"select c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname={sb.lit(schema)} and c.relkind in ('r','p') order by 1")]

def columns(ref, fq):
    return sb.query(ref, f"select a.attname n, a.attgenerated::text g, a.attidentity::text i from pg_attribute a where a.attrelid={sb.lit(fq)}::regclass and a.attnum>0 and not a.attisdropped order by a.attnum")

def pk(ref, fq):
    r = sb.query(ref, f"select a.attname n from pg_index x join pg_attribute a on a.attrelid=x.indrelid and a.attnum=any(x.indkey) where x.indrelid={sb.lit(fq)}::regclass and x.indisprimary order by array_position(x.indkey, a.attnum)")
    return [x["n"] for x in r]

def fk_order(ref, schema, names):
    deps = {t: set() for t in names}
    for r in sb.query(ref, f"select c.relname t, f.relname r from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_class f on f.oid=k.confrelid join pg_namespace n on n.oid=c.relnamespace join pg_namespace fn on fn.oid=f.relnamespace where k.contype='f' and n.nspname={sb.lit(schema)} and fn.nspname={sb.lit(schema)}"):
        if r["t"] in deps and r["r"] in deps and r["t"] != r["r"]:
            deps[r["t"]].add(r["r"])
    out, seen = [], set()
    def visit(t, stack=()):
        if t in seen: return
        if t in stack: return  # ciclo: a carga em modo replica não checa FK
        for d in sorted(deps[t]): visit(d, stack + (t,))
        seen.add(t); out.append(t)
    for t in sorted(names): visit(t)
    return out

GUARDED = {"public.\"audit_logs\"", "public.\"platform_roles\""}
_guard = {}

def guard_sql():
    """Suspende (e restaura no fim da MESMA transação) os triggers ENABLE ALWAYS da trilha de
    auditoria e os event triggers que impedem desligá-los. Fora da transação nada muda."""
    if not _guard:
        _guard["trg"] = sb.query(dst, "select c.relname r, t.tgname n, t.tgenabled::text e from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relname in ('audit_logs','platform_roles') and not t.tgisinternal")
        _guard["evt"] = [r["evtname"] for r in sb.query(dst, "select evtname from pg_event_trigger where evtname in ('audit_ddl_end','audit_ddl_drop') and evtenabled <> 'D'")]
    off = "".join(f"alter event trigger {e} disable; " for e in _guard["evt"])
    off += "alter table public.audit_logs disable trigger user; alter table public.platform_roles disable trigger user; "
    verb = {"O": "enable trigger", "A": "enable always trigger", "R": "enable replica trigger", "D": "disable trigger"}
    on = "".join(f"alter table public.{t['r']} {verb[t['e']]} {q(t['n'])}; " for t in _guard["trg"])
    on += "".join(f"alter event trigger {e} enable; " for e in _guard["evt"])
    return off, on

def write_tx(body, guarded):
    off, on = guard_sql() if guarded else ("", "")
    sb.query(dst, f"begin; set local session_replication_role = replica; {off}{body}; {on}commit;", timeout=300)

def q(name):
    return '"' + name.replace('"', '""') + '"'

def plan():
    items = []
    auth_rows = {r["t"]: r["n"] for r in sb.query(SRC, "select relname t, n_live_tup n from pg_stat_user_tables where schemaname='auth'")}
    src_auth = set(tables(SRC, "auth")); dst_auth = set(tables(dst, "auth"))
    auth_list = [t for t in fk_order(SRC, "auth", sorted(src_auth & dst_auth)) if t not in AUTH_SKIP]
    pub = fk_order(SRC, "public", sorted(set(tables(SRC, "public")) & set(tables(dst, "public"))))
    missing = sorted(set(tables(SRC, "public")) - set(tables(dst, "public")))
    if missing:
        sys.exit(f"tabelas de public ausentes no destino: {missing}")
    for schema, lst in (("auth", auth_list), ("public", pub)):
        for t in lst:
            fq = f"{schema}.{q(t)}"
            sc = {c["n"]: c for c in columns(SRC, fq)}
            dc = {c["n"]: c for c in columns(dst, fq)}
            cols = [n for n in sc if n in dc and not dc[n]["g"] and not sc[n]["g"]]
            items.append({"schema": schema, "table": t, "fq": fq, "cols": cols,
                          "identity_always": any(dc[n]["i"] == "a" for n in cols),
                          "pk": pk(SRC, fq) or cols,
                          "cols_so_origem": sorted(set(sc) - set(dc)), "cols_so_destino": sorted(set(dc) - set(sc))})
    return items

def fetch(it):
    collist = ", ".join(q(c) for c in it["cols"])
    order = ", ".join(q(c) for c in it["pk"])
    rows, off = [], 0
    while True:
        res = sb.query(SRC, f"select coalesce(json_agg(t), '[]'::json) j from (select {collist} from {it['fq']} order by {order} limit {PAGE} offset {off}) t")
        page = res[0]["j"]
        if isinstance(page, str):
            page = json.loads(page)
        rows.extend(page)
        if len(page) < PAGE:
            return rows
        off += PAGE

def load(it, rows):
    collist = ", ".join(q(c) for c in it["cols"])
    over = " overriding system value" if it["identity_always"] else ""
    chunk, size = [], 0
    def flush(chunk):
        if not chunk: return
        payload = json.dumps(chunk, ensure_ascii=False)
        tag = "$mm" + secrets.token_hex(6) + "$"
        write_tx(f"insert into {it['fq']} ({collist}){over} select {collist} from json_populate_recordset(null::{it['fq']}, {tag}{payload}{tag}::json)", it["fq"] in GUARDED)
    for r in rows:
        s = len(json.dumps(r, ensure_ascii=False))
        if chunk and size + s > 1_500_000:
            flush(chunk); chunk, size = [], 0
        chunk.append(r); size += s
    flush(chunk)

def checksum(ref, it):
    collist = ", ".join(q(c) for c in it["cols"])
    order = ", ".join(q(c) for c in it["pk"])
    r = sb.query(ref, f"select count(*) n, coalesce(md5(string_agg(t::text, '|' order by {order})), '') h from (select {collist} from {it['fq']}) t")[0]
    return int(r["n"]), r["h"]

SEQ_SQL = """select n.nspname s, c.relname q, t.relname t, a.attname col
from pg_class c join pg_namespace n on n.oid=c.relnamespace
left join pg_depend d on d.objid=c.oid and d.deptype in ('a','i')
left join pg_class t on t.oid=d.refobjid left join pg_attribute a on a.attrelid=t.oid and a.attnum=d.refobjsubid
where c.relkind='S' and n.nspname in ('public','auth')"""

def sync_sequences():
    """setval = maior entre o last_value da origem (pode vir nulo para o papel de leitura) e o max() da coluna dona no destino."""
    src_last = {(r["schemaname"], r["sequencename"]): r["last_value"] for r in sb.query(SRC, "select schemaname, sequencename, last_value from pg_sequences where schemaname in ('public','auth')")}
    done = []
    for r in sb.query(dst, SEQ_SQL):
        fq = f"{r['s']}.{q(r['q'])}"
        vals = [int(src_last[(r["s"], r["q"])])] if src_last.get((r["s"], r["q"])) is not None else []
        if r["t"] and r["col"]:
            m = sb.query(dst, f"select max({q(r['col'])})::bigint m from {r['s']}.{q(r['t'])}")[0]["m"]
            if m is not None:
                vals.append(int(m))
        if vals:
            sb.query(dst, f"select setval({sb.lit(fq)}, {max(vals)}, true)")
        else:
            sb.query(dst, f"select setval({sb.lit(fq)}, 1, false)")
        done.append(f"{r['s']}.{r['q']}={max(vals) if vals else 'inicio'}")
    return done

log = {"destino": dst}
t0 = time.monotonic()
items = plan()
log["ordem"] = [f"{i['schema']}.{i['table']}" for i in items]
diffcols = {f"{i['schema']}.{i['table']}": {"so_origem": i["cols_so_origem"], "so_destino": i["cols_so_destino"]} for i in items if i["cols_so_origem"] or i["cols_so_destino"]}
if diffcols:
    log["colunas_diferentes"] = diffcols
if not only_verify:
    with sb.Timer("truncate_destino", log):
        write_tx("truncate " + ", ".join(i["fq"] for i in items) + " cascade", True)
    with sb.Timer("copia_linhas", log):
        for it in items:
            rows = fetch(it)
            if rows:
                load(it, rows)
            print(f"  {it['schema']}.{it['table']}: {len(rows)}", flush=True)
    with sb.Timer("sequences", log):
        log["sequences"] = sync_sequences()
with sb.Timer("verificacao", log):
    res, ok = [], True
    for it in items:
        a = checksum(SRC, it); b = checksum(dst, it)
        same = a == b
        ok &= same
        res.append({"tabela": f"{it['schema']}.{it['table']}", "origem": a[0], "destino": b[0], "md5_igual": a[1] == b[1]})
    log["tabelas"] = res
    log["audit_integrity_destino"] = sb.query(dst, "select public.audit_integrity()->>'status' s")[0]["s"]
    log["tudo_igual"] = ok
log["segundos_total"] = round(time.monotonic() - t0, 1)
print(json.dumps(log, ensure_ascii=False, indent=1))
