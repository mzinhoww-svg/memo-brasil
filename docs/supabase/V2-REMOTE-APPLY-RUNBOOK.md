> **Roteiro operacional atual, com backup, restauração e recuperação: [OPERATOR-COMMANDS.md](OPERATOR-COMMANDS.md).** Este arquivo é o resumo.

# Runbook: aplicar a V2 no Supabase remoto `asyaegeodyttttaubvxh`

Pré-requisitos já cumpridos: validação local (pgTAP 430/430, integração 12/12, adaptador 14/14, E2E 5/5), backup, varredura de comandos destrutivos, dry-run das migrations (as 8 primeiras; 0900 e 1000 são posteriores). Fazer na ordem, com a mesma conta/CLI autenticada:

1. **Backup imediato** (se passou tempo): `supabase db dump --linked -f backup-schema.sql && supabase db dump --linked --data-only -f backup-data.sql` (guardar fora do Git; contém usuários).
2. **Conferir o alvo**: `cat supabase/.temp/project-ref` = `asyaegeodyttttaubvxh`; organização `zpnbwkmukywzlkxdfeja`.
3. **Dry-run**: `supabase db push --linked --dry-run` deve listar exatamente `20261022000100…1000` (dez migrations: as nove anteriores + `1000_audit_hardening`).
4. **Aplicar**: `supabase db push --linked --yes` (ou `scripts/supabase-apply-remote.sh --apply`).
5. **Verificar**: `supabase db advisors --linked --type all` (esperado: só os avisos já conhecidos) e contagem de tabelas com RLS = todas.
6b. **Worker de purga**: `supabase functions deploy purge-storage --project-ref asyaegeodyttttaubvxh --use-api`; agendar a chamada (POST com `Authorization: Bearer <service_role>`) a cada hora por um agendador externo ou pg_net + Vault. Sem isso a fila `storage_purge_queue` só cresce (SCV-004).
6. **Edge Function**: `supabase functions deploy finalize-asset --project-ref asyaegeodyttttaubvxh --use-api` (JWT obrigatório; usa o `service_role` interno do projeto, nunca vai ao cliente nem à Vercel).
7. **Pré-sequestro do master**: antes de provisionar, conferir em Auth que o provider e-mail/senha está desligado ou com confirmação ligada (hoje `mailer_autoconfirm = false`); rodar `supabase/ops/provision_master.sql` por `psql` com `-v email=...` (o script recusa conta com senha ou sem identidade Google).
8. **Smoke**: rodar `web/e2e/remote-flow.spec.ts` contra um preview novo (variáveis `REMOTE_URL`, `REMOTE_SHARE`, `SUPABASE_*`, `ALLOW_REMOTE_TEST=1`), mais o upload de logo/capa pela interface.
9. **Recuperação**: as migrations são aditivas; se algo falhar, restaurar o esquema e os dados do passo 1 num banco novo (o projeto só tem dados de teste) e apontar as variáveis da Vercel; o front V2 funciona contra o schema V1.
