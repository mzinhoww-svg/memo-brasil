# Comandos para o operador: aplicar a V2 no Supabase remoto (ordem estrita)

Alvo: projeto `asyaegeodyttttaubvxh` (org `zpnbwkmukywzlkxdfeja`). Rode na raiz do repo, na branch `feat/memoriesmt-studio` (remoto em `3a1a79d` ou posterior), com a CLI logada na conta dona do projeto.
Estado conferido antes de escrever este roteiro (Claude, 2026-10-21): 6 migrations V1 aplicadas; 10 V2 pendentes (`20261022000100…001000`); backup persistente e privado em `~/Backups/memoriesmt/20261021-1352/` (`schema.sql`, `data.sql`, `storage/event-photos/` com os 13 objetos; permissões 700/600; fora do Git; checksums em `~/Backups/memoriesmt/SHA256SUMS.txt`).
Por que o Claude não executou: o classificador de permissões bloqueou `supabase db push --linked` ("Blind Apply") duas vezes; não foi contornado.

## Backup e recuperação (já preparados; repetir se passar tempo)
- Integridade: `cd ~/Backups/memoriesmt/20261021-1352 && shasum -a 256 -c ../SHA256SUMS.txt` (tudo OK).
- Cobertura: `schema.sql` = 11 tabelas `public`; `data.sql` = dados de `public`, `auth` e METADADOS de `storage.objects` (13 linhas). **O dump SQL não contém os arquivos**: eles estão em `storage/event-photos/` (13 JPEGs, 19.666 bytes = soma dos metadados). O bucket `event-branding` ainda não existe no remoto (nasce na migration `…0300`), então não há o que salvar.
- Restauração testada (sem tocar o remoto): `public` em Postgres descartável (11 tabelas, 3 eventos, 1 foto, 4 participantes) e `auth`+`storage` no stack local dentro de transação com ROLLBACK (30 usuários, 5 identidades, 31 sessões, 1 bucket, 13 objetos, 48 auditorias). As dez migrations aplicadas por cima desse estado: sem perda de linhas.
- Para refazer o backup dos arquivos: `supabase storage cp -r ss:///event-photos/ <destino> --linked --experimental`.
- **Se algo der errado depois do `db push`:** cada migration roda em transação própria (a que falhar não deixa meia alteração). As V2 são aditivas, então o app V1 continua funcionando com elas aplicadas. Recuperação de dados: criar um projeto Supabase novo, aplicar `schema.sql` e `data.sql` e reenviar `storage/` (`supabase storage cp -r <pasta> ss:///event-photos/ --linked --experimental`); não restaurar por cima do projeto em produção sem decisão do dono. Plano com backup diário/PITR do Supabase depende do plano contratado: conferir no painel (Database → Backups).

## 0. Antes (somente leitura)
```bash
cat supabase/.temp/project-ref                      # deve imprimir asyaegeodyttttaubvxh
supabase migration list --linked                    # remoto: só 20261021000100…000600
supabase db push --linked --dry-run                 # deve listar exatamente as 10 de 20261022000100 a 20261022001000
supabase db dump --linked -f /caminho/seguro/schema.sql && supabase db dump --linked --data-only -f /caminho/seguro/data.sql
```
Conferir o papel do operador (event trigger exige privilégio): `select rolsuper from pg_roles where rolname = current_user;` — se `false`, a migration `…1000` emite WARNING e não cria o event trigger (ver passo 3).

## 1. Aplicar
```bash
supabase db push --linked --yes
```
Se falhar no meio, cada migration roda em transação própria: anote o arquivo que falhou, NÃO edite as já aplicadas, e avise o Claude com a saída.

## 2. Verificar (depois)
```bash
supabase migration list --linked                    # as 16 com local = remote
supabase db advisors --linked --type all            # só avisos já conhecidos; nenhum ERROR de RLS
```
```sql
select count(*) filter (where not relrowsecurity) as tabelas_sem_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r';  -- 0
select evtname from pg_event_trigger where evtname like 'audit_ddl%';                       -- audit_ddl_drop, audit_ddl_end (se faltar: passo 3)
select public.audit_integrity();                                                            -- status 'ok' (ou 'degraded' se faltar o event trigger; 'compromised' = parar e avisar)
select jobname, schedule from cron.job where jobname like 'mm-%' order by 1;                -- mm-audit-integrity, mm-expire-assets, mm-expire-uploads, mm-purge-deleted, mm-reveal-due
select tgname, tgenabled from pg_trigger where tgname like 'audit_logs_no_%' or tgname like 'platform_roles_%';  -- todos 'A'
```

## 3. Só se o event trigger não foi criado (WARNING na migration `…1000`)
Testado: como `postgres` (não superusuário) no Postgres da Supabase a criação funciona (owner `postgres`); o remoto tem `postgres` não superusuário e event triggers do `supabase_admin`. Mesmo se for recusado, a proteção não some em silêncio: `audit_integrity()` passa a `degraded`, o job `mm-audit-integrity` roda a cada 10 min e grava `audit.integrity_failed` na auditoria se algum trigger de imutabilidade for desligado, e o master lê o estado por `admin_audit_integrity()`.
Como superusuário (SQL Editor do painel do Supabase costuma ter o papel `postgres` com privilégio):
```sql
create event trigger audit_ddl_end on ddl_command_end when tag in ('ALTER TABLE') execute function public.guard_audit_ddl();
create event trigger audit_ddl_drop on sql_drop execute function public.guard_audit_ddl();
```
Se o ambiente recusar, registre como risco residual aceito (SCV-005 fica parcial no remoto).

## 4. Edge Functions
```bash
supabase functions deploy finalize-asset --project-ref asyaegeodyttttaubvxh --use-api
supabase functions deploy purge-storage  --project-ref asyaegeodyttttaubvxh --use-api --no-verify-jwt
supabase functions list --project-ref asyaegeodyttttaubvxh                                   # as duas ACTIVE
```
Opcional, se usar domínio próprio: `supabase secrets set ALLOWED_ORIGINS=https://seu.dominio --project-ref asyaegeodyttttaubvxh`.
Verificação (sem credencial = deve recusar): `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://asyaegeodyttttaubvxh.supabase.co/functions/v1/purge-storage` → `403`.

## 5. Agendar a purga do Storage (SCV-004)
O segredo fica no Vault do próprio banco, nunca no Git. No SQL Editor (cole a chave só na sessão do painel):
```sql
select vault.create_secret('<SERVICE_ROLE_KEY do projeto>', 'mm_service_role');
select cron.schedule('mm-purge-storage', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://asyaegeodyttttaubvxh.supabase.co/functions/v1/purge-storage',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mm_service_role'))
  ) $$);
```
Verificação: `select * from cron.job where jobname='mm-purge-storage';` e, após 30 min, `select status, return_message from cron.job_run_details order by start_time desc limit 3;` e `select count(*) from storage_purge_queue;` (tende a zero).

## 6. Auth e produção (fora do banco)
- Auth → Providers → Email: desligar login por e-mail/senha (deixar Google). 
- Vercel (projeto `newmemocuiaba`): confirmar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_MM_BACKEND=supabase` em Production; `service_role` NUNCA na Vercel.
- Primeiro master: `supabase/ops/provision_master.sql` (ver o cabeçalho; exige login Google prévio da conta).

## 7. Depois
Avise o Claude: ele roda `web/e2e/remote-flow.spec.ts` no preview atualizado (organizador→convidado→upload→tema→revelação→álbum→download, e `/master`), atualiza o backlog e o GO/NO-GO.
