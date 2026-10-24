# Publicação e rollback da V2 (preview → produção)

Estado de partida (2026-10-21): produção `newmemocuiaba.vercel.app` serve o app legado (deployments `dpl_CX5GuvrnNSgjySpjBPpEGpX6hbKD` e `dpl_2vNJyjZnaMbcmM2ihKNLZYSCuUSJ`, commit `3a8bf89`, ambos `isRollbackCandidate`). **Nada daqui foi executado em produção.** A publicação exige autorização explícita do dono para o SHA identificado.

## 1. Preview reproduzível (comprovado duas vezes)
O projeto Vercel tem Root Directory `.` e framework `null`; a V2 está em `web/`. Um push não gera deploy aqui, e o build da raiz sai vazio ("READY" enganoso). Gerar o preview por API, **sem alterar o projeto**, com `rootDirectory` e framework só no deployment:

```
create_deployment (projeto newmemocuiaba, equipe team_SOZVnHod91BcrmLMYmdmvB8k)
  gitSource: { type: github, org: mzinhoww-svg, repo: memo-brasil, ref: <branch>, sha: <SHA completo de 40 caracteres> }
  projectSettings: { rootDirectory: "web", framework: "nextjs" }      # sem "target": o padrão é preview
```
Conferir: `state` READY, `meta.githubCommitSha` igual ao SHA, e uma rota da V2 (`/entrar` responde 200 com `x-matched-path: /entrar`). Registros: `dpl_2v3GF6rj7GHeE8vBGFCRyxyDdKwf` (`ca7a274`) e `dpl_B91ajh2QfZVrd6jc4KLfHwWxFA38` (`8ea3518`).

Não mudar Root Directory/framework do projeto antes da promoção: o legado em produção deixaria de buildar do jeito que builda hoje.

## 2. Pré-requisitos antes de promover
1. Migrations pendentes no remoto aplicadas pelo operador, em ordem. `20261022001100_user_consents.sql` foi aplicada em 2026-10-22 (list: local=remote). Comando (com backup recente feito antes): `supabase db push --linked` a partir da raiz do repositório, conferindo `supabase migration list --linked`.
2. Edge Function `purge-storage` republicada com a correção HTTP 500 (código na branch): `supabase functions deploy purge-storage --project-ref asyaegeodyttttaubvxh` (mantém `verify_jwt=false` do `config.toml`). Publicada como v2 em 2026-10-22; conferido: sem token 403, GET 405, token falso 403.
3. INF-004 resolvido (ver backlog) e Redirect URLs do Auth estreitadas ao domínio de produção (remover o curinga de previews).
4. Backup do banco e do bucket feito no mesmo dia (`OPERATIONAL-RECOVERY.md`).
5. Testes físicos (iPhone/Safari e Android/Chrome) e login Google real com resultado registrado em `A5-HOMOLOGATION-REPORT.md`.

## 3. Promover (somente com autorização explícita)
- Promover o deployment já construído e homologado, sem rebuild: Vercel → Deployments → o preview do SHA → **Promote to Production**, ou `npx vercel --scope mzinhoww-gmailcoms-projects promote <deployment-url>`.
- As variáveis `NEXT_PUBLIC_*` são fixadas no build; o preview foi construído com Preview env (`NEXT_PUBLIC_MM_BACKEND=supabase`, URL e chave pública do mesmo projeto), idênticas às de Production.
- Depois: abrir `https://newmemocuiaba.vercel.app/entrar`, `/termos`, `/master` (anônimo vê o portão), entrar com Google e criar um evento sintético identificado ("TESTE – excluir") pela UI; registrar URL e SHA.

## 4. Rollback (pronto antes de promover)
- Anotar o deployment de produção atual (hoje `dpl_CX5GuvrnNSgjySpjBPpEGpX6hbKD`).
- Falha crítica após a promoção: `npx vercel --scope mzinhoww-gmailcoms-projects rollback dpl_CX5GuvrnNSgjySpjBPpEGpX6hbKD` (ou Promote no deployment anterior). A reversão é instantânea e não mexe no banco.
- Migrations são aditivas e ficam aplicadas: o app legado ignora as tabelas novas. Não reverter migrations em produção; se necessário, corrigir à frente.
- Eventos sintéticos criados no teste de fumaça: excluir pela própria UI do organizador.

## 5. Atualização 2026-10-22 (rodada 5)
- **Caminho operacional vigente:** deploy manual por API (seção 1), no projeto `newmemocuiaba` (login Google funciona nos previews dele) ou no `memoriesmt-v2` (rotas/backend; o login exige `OPS-A5-001`). Previews homologados: `dpl_59rEWBMxuud3m9STBssRUtd9hgic` e `dpl_HpaBRySf9RzetNukhku4JUMfHTRL`, SHA `975a49c`.
- **Push → deploy:** o projeto `memoriesmt-v2` está ligado a `memo-brasil` e recebe o push, mas a Vercel Hobby bloqueia (`BLOCKED`) quando o autor do commit não pertence ao time. Intervenção do dono: verificar o e-mail do autor na conta GitHub `mzinhoww-svg`.
- **Flags de build:** `NEXT_PUBLIC_MM_DEV_TOOLS` e `NEXT_PUBLIC_MM_TEST_CLOCK` só existem no build de E2E; nunca configurá-las na Vercel.
- Produção segue o app legado; nada foi promovido. Rollback: seção 4, inalterada.

## 6. Atualização 2026-10-22 (rodada 6)
- **Candidato:** SHA `67fef3ceeec9d6467b51a05b6d1cadc708b8c1f1`; preview `dpl_BGLvn1MhU1bSsbBWCteNNu92ik51` (memoriesmt-v2). Login Google no preview confirmado (OPS-A5-001 resolvido). Produção segue o app legado; nada promovido.
- **Migration `20261022001300` já aplicada** (aditiva: textos v1, aceite separado, retenção). Não se reverte; corrigir à frente. O job `mm-expire-retention` só atua em eventos criados após a migration.
- **Antes de promover:** o operador decide conscientemente a promoção desse SHA e registra a rotina de rotação de backups (`supabase/ops/rotate_local_backups.sh`, a cada ≤ 30 dias).
- Push → deploy segue bloqueado pela Vercel até o e-mail do autor ser vinculado (INF-005); caminho vigente: deploy manual por API (seção 1; `requestBody` com `gitSource`).

## 7. Entrega final (2026-10-22, rodada 7) — procedimento vigente no projeto original
- **Destino único:** projeto Vercel `newmemocuiaba` (`prj_IpHyqsnnbrXS213AGrOmxizb0Kjl`, equipe `mzinhoww-gmailcoms-projects`), repositório `mzinhoww-svg/memo-brasil`, Root Directory `web`, Next.js, branch de produção `main`, domínio `https://newmemocuiaba.vercel.app` (público; hoje serve o app legado `dpl_CX5GuvrnNSgjySpjBPpEGpX6hbKD`). **`memoriesmt-v2` não é operacional**: preservado, sem uso e sem exclusão.
- **Pré-requisito antes de promover (operador):** a partir de um checkout com `supabase/.temp/project-ref = asyaegeodyttttaubvxh` (merge final de `feat/final-ui`), `supabase db push --linked --dry-run` deve listar exatamente `20261022001400…001800`; depois `supabase db push --linked --yes`; depois `supabase functions deploy payments-checkout payments-status payments-webhook payments-reconcile payments-refund --project-ref asyaegeodyttttaubvxh`; conferir `payments_env='desligado'`. Backup recente já existe (`~/Backups/memoriesmt/20261022-1902`); refaça com `sh supabase/ops/backup_and_rotate.sh` antes, se passou tempo.
- **Candidato de produção (sem tráfego):** `autoAssignCustomDomains=false` no projeto; `create_deployment` com `target: "production"` e `gitSource {github, org, repo, ref, sha completo}` (variáveis de **Production**); validar na URL própria do deployment (login Vercel só do operador); só então `request_promote` (não refaz o build) e restaurar `autoAssignCustomDomains=true`. Nunca promover artefato construído com variáveis de Preview.
- **Rollback:** `request_rollback` para `dpl_CX5GuvrnNSgjySpjBPpEGpX6hbKD` (legado) ou para o deployment anterior registrado na promoção; não reverte o banco (migrations aditivas ficam).
- **Não empurrar `main` antes da promoção:** a ligação `main` → Vercel gera deploy de produção automático; leve a `main` ao SHA publicado (fast-forward) somente depois do smoke.
- **Flags de build:** `NEXT_PUBLIC_MM_DEV_TOOLS` e `NEXT_PUBLIC_MM_TEST_CLOCK` nunca na Vercel (conferido: ausentes de Preview e Production).

## 8. Estado de produção após a entrega final (2026-10-23)
- **Produção:** `dpl_AebyeHRbNLKmsFcfMuWf2Yx9nSVm`, SHA `89a612b6d775a04a617e73f796ee5d9852c856af`, em https://newmemocuiaba.vercel.app. Projeto `newmemocuiaba` ligado a `mzinhoww-svg/memo-brasil`, Root Directory `web`, Next.js, branch de produção `main` (= SHA publicado), `autoAssignCustomDomains=true`.
- **Rollback (comando exato):** `request_rollback` no projeto `prj_IpHyqsnnbrXS213AGrOmxizb0Kjl` para `dpl_CX5GuvrnNSgjySpjBPpEGpX6hbKD` (app legado) ou `npx vercel --scope mzinhoww-gmailcoms-projects rollback dpl_CX5GuvrnNSgjySpjBPpEGpX6hbKD`. Não reverte o banco.
- **Próxima publicação:** repetir a seção 7 (candidato `target=production` com `autoAssignCustomDomains=false`, validar na URL própria, `request_promote`, smoke, só então `main`). Pushes em `main` geram deploy automático; hoje saem `BLOCKED` (INF-005).
- **Cobrança:** desligada (`payments_env='desligado'`). Para habilitar: PAY-001..005 corrigidos, homologação sandbox real (PAYMENTS-RUNBOOK §5–§8), decisões D3–D6. Nunca sem autorização específica para a primeira transação.
- **Smoke público reutilizável:** `E2E_BASE_URL=https://newmemocuiaba.vercel.app E2E_EVENT_CODE=<código de evento "TESTE – excluir"> npx playwright test -c playwright.prod-smoke.config.ts` (em `web/`).

