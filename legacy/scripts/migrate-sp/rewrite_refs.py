"""Etapa 2b: tudo que embute o ref/URL do projeto antigo, refeito para o novo.

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/rewrite_refs.py [--ativar-cron]

 1. Vault do destino: os 4 segredos internos são REGERADOS (a origem não deixa
    decifrar em modo leitura e não precisamos dos valores antigos):
      mm_purge_service_role                 = a chave que o destino injeta em SUPABASE_SERVICE_ROLE_KEY
                                              (hoje sb_secret_...; conferido por digest)
      mm_payments_cron_token                = token aleatório novo
      mm_payments_reconcile_url             = https://<novo>.supabase.co/functions/v1/payments-reconcile
      mm_validapay_production_reconcile_token = token aleatório novo
 2. Secrets das Edge Functions do destino com os MESMOS tokens novos:
      PAYMENTS_CRON_TOKEN, VALIDAPAY_PRODUCTION_RECONCILE_TOKEN
    (os valores só existem em memória durante esta execução).
 3. pg_cron: apaga os jobs do destino e recria exatamente os da origem com o
    ref trocado. Sem --ativar-cron ficam todos INATIVOS (carga/ensaio); com
    --ativar-cron cada job fica com o mesmo 'active' da origem.
 4. Event trigger ensure_rls/rls_auto_enable() (recurso da plataforma que existe
    na origem): recriado se o papel permitir.
"""
import os, secrets, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
activate = "--ativar-cron" in sys.argv
OLD = sb.PROD_REF
report = {}

if not activate:
    cron_tok = secrets.token_urlsafe(36)
    vp_tok = secrets.token_urlsafe(36)
    k = sb.keys(dst)
    # purge-storage compara o Bearer com SUPABASE_SERVICE_ROLE_KEY por igualdade. Hoje a plataforma injeta ali a
    # chave sb_secret_... (não o JWT legado): escolhe a que bate com o digest que GET /secrets devolve.
    import hashlib
    st, sec, _ = sb.mgmt("GET", f"/projects/{dst}/secrets")
    digest = {x["name"]: x.get("value") for x in sec}.get("SUPABASE_SERVICE_ROLE_KEY")
    purge_key = next((k[n] for n in ("secret", "service_role") if n in k and hashlib.sha256(k[n].encode()).hexdigest() == digest), None)
    if not purge_key:
        sys.exit("não achei a chave que a função enxerga em SUPABASE_SERVICE_ROLE_KEY")
    report["mm_purge_service_role_tipo"] = "sb_secret" if purge_key == k.get("secret") else "service_role legado (JWT)"
    vault = {
        "mm_purge_service_role": (purge_key, "chave que a Edge Function enxerga em SUPABASE_SERVICE_ROLE_KEY (purge-storage compara por igualdade)"),
        "mm_payments_cron_token": (cron_tok, "token da conciliacao de pagamentos"),
        "mm_payments_reconcile_url": (f"https://{dst}.supabase.co/functions/v1/payments-reconcile", "url da conciliacao"),
        "mm_validapay_production_reconcile_token": (vp_tok, "token da conciliacao ValidaPay"),
    }
    existing = {r["name"]: r["id"] for r in sb.query(dst, "select id, name from vault.secrets")}
    for name, (val, desc) in vault.items():
        if name in existing:
            sb.query(dst, f"select vault.update_secret({sb.lit(existing[name])}::uuid, {sb.lit(val)}, {sb.lit(name)}, {sb.lit(desc)})")
        else:
            sb.query(dst, f"select vault.create_secret({sb.lit(val)}, {sb.lit(name)}, {sb.lit(desc)})")
    report["vault"] = sorted(vault)
    st, res, _ = sb.mgmt("POST", f"/projects/{dst}/secrets", [
        {"name": "PAYMENTS_CRON_TOKEN", "value": cron_tok},
        {"name": "VALIDAPAY_PRODUCTION_RECONCILE_TOKEN", "value": vp_tok},
    ])
    report["secrets_internos"] = st
    del cron_tok, vp_tok, vault, k, purge_key
    try:
        fdef = sb.query(OLD, "select pg_get_functiondef('public.rls_auto_enable()'::regprocedure) d")[0]["d"]
        sb.query(dst, fdef + ";\ndo $$ begin if not exists (select 1 from pg_event_trigger where evtname='ensure_rls') then "
                 "create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable(); end if; end $$;"
                 "revoke all on function public.rls_auto_enable() from public, anon, authenticated; grant execute on function public.rls_auto_enable() to service_role;")
        report["ensure_rls"] = "ok"
    except Exception as e:
        report["ensure_rls"] = f"falhou: {str(e)[:200]}"

src_jobs = sb.query(OLD, "select jobname, schedule, command, active from cron.job order by jobid")
for j in sb.query(dst, "select jobname from cron.job"):
    sb.query(dst, f"select cron.unschedule({sb.lit(j['jobname'])})")
created = []
for j in src_jobs:
    cmd = j["command"].replace(OLD, dst)
    want = bool(j["active"]) if activate else False
    jid = sb.query(dst, f"select cron.schedule({sb.lit(j['jobname'])}, {sb.lit(j['schedule'])}, {sb.lit(cmd)}) id")[0]["id"]
    sb.query(dst, f"select cron.alter_job(job_id := {int(jid)}, active := {str(want).lower()})")
    created.append({"job": j["jobname"], "ativo": want, "trocou_ref": OLD in j["command"]})
report["cron"] = created
left = sb.query(dst, f"select count(*) c from cron.job where command like '%{OLD}%'")[0]["c"]
report["cron_com_ref_antigo"] = left
print(json.dumps(report, ensure_ascii=False, indent=1))
