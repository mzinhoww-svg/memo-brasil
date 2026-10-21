# Runbook · conexão com o Supabase remoto

Projeto-alvo (confirmado pela CLI autenticada em 2026-10-21): **`newmemocuiaba`**, ref `asyaegeodyttttaubvxh`, organização `zpnbwkmukywzlkxdfeja`, us-west-2, PostgreSQL 17, ACTIVE_HEALTHY. Estado inicial: 0 tabelas em `public`, 0 usuários, 0 buckets; só a função de plataforma `public.rls_auto_enable()`.

## Caminhos de acesso (em ordem)
| # | Caminho | Resultado nesta sessão |
|---|---|---|
| 1 | Conector Supabase (MCP) | **Organização errada**: lista 6 projetos de `vercel_icfg_…`; o alvo não aparece. Não usado para escrever (INF-001) |
| 2 | Reautenticar OAuth do conector | Depende de ação do dono no cliente (escolher a organização `zpnbwkmukywzlkxdfeja`) |
| 3 | **Supabase CLI já autenticada** | **Funciona**: enxerga o projeto, `db query --linked` (somente leitura) e `db push --linked --dry-run` ok, sem senha de banco |
| 4 | Variáveis de ambiente | Nenhuma `SUPABASE_*` definida no ambiente |
| 5 | Supabase local (CLI + Docker) | **Funciona**: stack própria nas portas 55421–55424 (as 54321–54324 pertencem a outro projeto) |

## Aplicar as migrations
`scripts/supabase-apply-remote.sh` (dry-run por padrão) e `scripts/supabase-apply-remote.sh --apply`. O script recusa qualquer Project Ref ou organização diferentes dos acima, mostra o estado remoto, lista as migrations pendentes e, com `--apply`, faz `db push`, roda os advisors e confere que todas as tabelas de `public` têm RLS.
**Status:** o `db push` remoto foi **bloqueado pelo harness** (classificado como deploy de produção) e não foi contornado. Para aplicar: aprovar a ação ou rodar `! scripts/supabase-apply-remote.sh --apply` no prompt.

## Depois de aplicar (manual, no painel do projeto)
1. Authentication → Providers → Google: informar Client ID/Secret do **projeto Google do MemoriesMT** (não existe nesta sessão; ver ENVIRONMENT-MATRIX).
2. Authentication → Sign In / Providers → habilitar **Anonymous sign-ins** (convidados) e **Manual linking**.
3. URL Configuration: Site URL e Redirect URLs de produção e de preview (`/auth/callback`).
4. Database → Extensions: confirmar `pg_cron`; conferir `select * from cron.job` (3 tarefas `mm-*`). Sem `pg_cron`, agendar `reveal_due_events()` a cada minuto por outro meio.
5. Storage → conferir o bucket `event-photos` (privado, 8 MiB, jpeg/png/webp).
6. Edge Function `purge-storage` (drena `storage_purge_queue` pela API de Storage) e função de validação de upload: pendentes (ver DEPLOYMENT-CHECKLIST).

## Se a conexão falhar
Não repetir tentativa sem mudança de condição. Verificar `supabase projects list` (organização certa), `supabase link --project-ref asyaegeodyttttaubvxh`, e o token (`supabase login`). Nunca colar chaves em prompts, commits ou logs.

## Backup e restauração
Plano Free: sem PITR; fazer `supabase db dump --linked -f backup.sql` antes de mudanças destrutivas e guardar fora do repositório. Restauração: `psql` contra o projeto de destino. Fotos: Storage não entra no dump; exportar com a API quando houver dados reais.
