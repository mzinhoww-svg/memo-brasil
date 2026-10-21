# Checklist de implantação (Supabase remoto → Vercel)

Legenda: ✅ feito e verificado · ⛔ bloqueado (ação do dono) · ⬜ pendente

## 1. Supabase remoto (`asyaegeodyttttaubvxh`, org `zpnbwkmukywzlkxdfeja`)
- ✅ Projeto confirmado pela CLI autenticada; ACTIVE_HEALTHY; us-west-2; PG17; remoto vazio (0 tabelas, 0 usuários, 0 buckets).
- ✅ Migrations 1–6 validadas localmente; `supabase db push --linked --dry-run` lista exatamente as 6.
- ⛔ **SB-003** aplicar: `scripts/supabase-apply-remote.sh --apply` (o harness bloqueou o `db push` como deploy de produção; precisa de aprovação do dono).
- ⬜ Advisors remotos (`supabase db advisors --linked`) sem alertas; `select count(*) from pg_tables where schemaname='public' and not rowsecurity` = 0.
- ⬜ `pg_cron` ativo e `select jobname from cron.job` com `mm-reveal-due`, `mm-expire-uploads`, `mm-purge-deleted`.
- ⬜ Rodar `web/integration/*` contra um **projeto/branch de teste** (nunca contra dados reais; exige `ALLOW_REMOTE_TEST=1`).

## 2. Auth
- ⛔ **SB-004** Google: Client ID/Secret do projeto Google do MemoriesMT no painel; Redirect: `https://<dominio>/auth/callback` e o do preview.
- ⬜ Anonymous sign-ins e Manual linking ligados; Site URL e Redirect URLs corretos; revisar limite de anônimos por IP.

## 3. Funções de apoio
- ⬜ **SB-005** Edge Function `purge-storage` (drena `storage_purge_queue`) e validação de upload.
- ⬜ **SB-006** hook de Realtime na interface; **SB-007** relógio do servidor, logs estruturados, alerta de atraso da revelação.

## 4. Vercel (`newmemocuiaba`, `prj_IpHyqsnnbrXS213AGrOmxizb0Kjl`)
- ✅ Projeto correto (Root Directory `web`); preview anterior protegido por SSO; **sem variáveis**; sem Git vinculado (INF-003).
- ⬜ **SB-008** definir `NEXT_PUBLIC_MM_BACKEND=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` em Preview e Production (nunca `service_role`).
- ⬜ Deploy de preview, smoke test (`web/e2e/remote.spec.ts` + fluxo de convidado), conferir CSP e `/auth/callback`.
- ⛔ **REL-001** promoção a produção: exige confirmação explícita do destino e todos os gates de `docs/backlog/RELEASE-GATES.md`.
- ⬜ INF-002: produção ainda serve um build antigo (só HSTS).

## 5. Pós-release
- ⬜ Backup (`supabase db dump --linked`), registro do commit/URL, monitor da revelação, revisão dos logs de auditoria.
