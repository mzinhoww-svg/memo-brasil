# Runbook: aplicar a V2 no Supabase remoto `asyaegeodyttttaubvxh`

Pré-requisitos já cumpridos: validação local (pgTAP 385/385, integração 12/12, adaptador 13/13, E2E 5/5), backup, varredura de comandos destrutivos, dry-run das 8 migrations. Fazer na ordem, com a mesma conta/CLI autenticada:

1. **Backup imediato** (se passou tempo): `supabase db dump --linked -f backup-schema.sql && supabase db dump --linked --data-only -f backup-data.sql` (guardar fora do Git; contém usuários).
2. **Conferir o alvo**: `cat supabase/.temp/project-ref` = `asyaegeodyttttaubvxh`; organização `zpnbwkmukywzlkxdfeja`.
3. **Dry-run**: `supabase db push --linked --dry-run` deve listar exatamente `20261022000100…0800`.
4. **Aplicar**: `supabase db push --linked --yes` (ou `scripts/supabase-apply-remote.sh --apply`).
5. **Verificar**: `supabase db advisors --linked --type all` (esperado: só os avisos já conhecidos) e contagem de tabelas com RLS = todas.
6. **Edge Function**: `supabase functions deploy finalize-asset --project-ref asyaegeodyttttaubvxh --use-api` (JWT obrigatório; usa o `service_role` interno do projeto, nunca vai ao cliente nem à Vercel).
7. **Pré-sequestro do master**: antes de provisionar, conferir em Auth que o provider e-mail/senha está desligado ou com confirmação ligada (hoje `mailer_autoconfirm = false`); rodar `supabase/ops/provision_master.sql` por `psql` com `-v email=...` (o script recusa conta com senha ou sem identidade Google).
8. **Smoke**: rodar `web/e2e/remote-flow.spec.ts` contra um preview novo (variáveis `REMOTE_URL`, `REMOTE_SHARE`, `SUPABASE_*`, `ALLOW_REMOTE_TEST=1`), mais o upload de logo/capa pela interface.
9. **Recuperação**: as migrations são aditivas; se algo falhar, restaurar o esquema e os dados do passo 1 num banco novo (o projeto só tem dados de teste) e apontar as variáveis da Vercel; o front V2 funciona contra o schema V1.
