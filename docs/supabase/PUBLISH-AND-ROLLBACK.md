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


## 7. Atualização 2026-10-23 (Rodada 10: Mercado Pago em produção, cobrança desligada)
- **Produção:** `https://newmemocuiaba.vercel.app` → `dpl_FLm1pT6udBUiWmX5ZZr9i6HPC5pu`, SHA `c02ff4200b4df2fa8727575384b96d45a8154ad3` (`feat/mercadopago`, inclui a home de `9c36af0`; `main` alinhada por fast-forward depois do smoke). Candidatos anteriores da mesma rodada: `dpl_AktSDY4…` (`541df22`) e `dpl_5tLhh6aPA7…` (`09c1939`). Seguiu o procedimento: `autoAssignCustomDomains=false` → candidato `target=production` → validação na URL própria → `request_promote` → `autoAssignCustomDomains=true` restaurado.
- **Rollback (nesta ordem):** `dpl_5tLhh6aPA7GwXJLuqJFDdKs9b5EF` (`09c1939`), `dpl_AGvPH6Ad85j5vtSfkso6Y2WATveT` (`9c36af0`, home sem Mercado Pago), `dpl_J28BnSfP5SrabGNrFj3KwJ2we2Du` (`8de2d88`) ou `dpl_AebyeHRbNLKmsFcfMuWf2Yx9nSVm` (`89a612b`). O banco não volta: a migration `20261023000100` é aditiva e o app anterior a ignora; as functions `payments-*` novas respondem 503/`desligado` e nada cobram.
- **Remoto alinhado:** migrations 25/25; functions `payments-checkout`, `payments-status`, `payments-refund`, `payments-webhook`, `payments-reconcile` (v8) e `payments-diagnose` (v1) ativas; segredo `PAYMENTS_CRON_TOKEN` e Vault `mm_payments_cron_token`/`mm_payments_reconcile_url` gravados; job `mm-payments-reconcile` a cada 5 min.
- **Pendente do titular (cobrança permanece desligada):** ver `PAYMENTS-RUNBOOK.md` §7 (webhook no painel do Mercado Pago, que exige a validação por SMS/WhatsApp do titular) e §9 (janela `sandbox` + pagamento de teste).
- **O que mantém os planos pagos ocultos:** somente `payments_env = 'desligado'` (`list_public_plans()` devolve só o Grátis nesse estado). O catálogo está correto (Grátis 10/10; Festa 30/24 R$ 29; Celebração 100/24 R$ 89; Casamento 250/36 R$ 189; Grande 500/ilimitado R$ 349; todos `sandbox_active` e `production_active`). Textos de Plano, Preços e do passo de criação já correspondem a esse estado e o "fale com a gente" sempre tem contato (`c02ff42`).
- **Único requisito pendente para abrir a cobrança:** o titular da conta Mercado Pago (conta `3786909683`, aplicação `1592042337972998`) (1) conferir/cadastrar o webhook `https://asyaegeodyttttaubvxh.supabase.co/functions/v1/payments-webhook` (tópico Pagamentos, sem parâmetros) no painel, que pede validação por SMS/WhatsApp, e informar se as credenciais cadastradas são de TESTE ou PRODUÇÃO; (2) com o operador executando o §9 do `PAYMENTS-RUNBOOK.md` (janela `sandbox`), fazer um pagamento de teste de um plano numa festa sintética na página do Mercado Pago (Pix pendente ou cartão de teste aprovado) e conferir no Master o pedido `pago`, o `live_mode` e a liberação do plano; (3) fechar a janela (§9.1). Só depois, decisões D3/D5/D6 e `production`.

## 8. Atualização 2026-10-24 (jornada de pagamento mobile)
- **Produção:** `https://newmemocuiaba.vercel.app` → `dpl_58KzqgGhPqSjJ2TWoNykNQcEnujN`, SHA `cf47ac9a7610d6132d2253261da0997551bbb7c8` (inclui home e convite/PDF das outras sessões). `main` alinhada por fast-forward. Procedimento do §7 (autoAssign off → candidato → promover → autoAssign on).
- **Rollback:** `dpl_Djo8SdeirhXrN71ZaFHBRTYRq7fF` (convite, `fa55ed5`), depois `dpl_FLm1pT6udBUiWmX5ZZr9i6HPC5pu` (`c02ff42`).
- **Estado da cobrança:** `payments_env='sandbox'` aberto para homologação (checkout de sandbox só para Master); cobrança de produção desligada.

## 9. Revela 2.0 em fotosdocasamento.online (preparação, 2026-11-09)
- **Domínio:** `fotosdocasamento.online` foi comprado na Vercel, está verificado e ligado ao projeto `newmemocuiaba` (nameservers da Vercel; `www` redireciona para o apex). Hoje serve a mesma produção de `newmemocuiaba.vercel.app`. Não há DNS a configurar: publicar o Revela é promover o deploy neste projeto.
- **Produção atual (rollback):** `dpl_Hm4o7eyrFkZEdQWShh5fdmKp1bY1` (`main`, `2de09ce`). Anteriores: `dpl_DhGeS8mceKpuhufE1v11YBT8aG5q` (`b776b64`), `dpl_3x5MBwp9bxcZ52FHzn1ib8rZ9VVt` (`6720373`).
- **Endereço oficial do código:** `DEFAULT_SITE_ORIGIN = https://fotosdocasamento.online` (QR e convite A5). Convites já impressos com `newmemocuiaba.vercel.app` continuam valendo enquanto esse domínio ficar no projeto: não removê-lo.
- **CORS das Edge Functions:** `fotosdocasamento.online` (e `www`) entrou na lista fixa de `supabase/functions/_shared/cors.ts`. Só vale depois de republicar as funções (`payments-validapay`, `payments-validapay-reconcile`, `payments-validapay-refund`, `finalize-asset` etc.) ou de pôr o domínio em `ALLOWED_ORIGINS`.
- **Bloqueio:** o projeto Supabase de produção (`asyaegeodyttttaubvxh`) não pertence às organizações acessíveis pelo token da conta `mzinhoww@gmail.com` (orgs `jkswmppcjrtotpxntvle` e `vercel_icfg_a71TEE6OkIZ69uoxz46MSdHA`); a API responde 403 (`project_admin_read`, `database_read`, `edge_functions_read`). Para aplicar as migrations `20261109000100…400` e republicar funções é preciso um token pessoal (`sbp_…`) da conta dona desse projeto, ou adicionar `mzinhoww@gmail.com` como membro com papel de Owner/Administrator na organização dele.
- **Ordem quando houver acesso:** (1) `migration list` remoto e backup; (2) aplicar `20261109000100…400` (aditivas); (3) publicar `reveal-emails` e republicar as funções com CORS novo; (4) Auth: Site URL e Redirect URLs com `https://fotosdocasamento.online/**`, habilitar Email (link mágico) se for usado; (5) candidato `target=production` com `autoAssignCustomDomains=false`, validar na URL própria; (6) promover; (7) smoke em `https://fotosdocasamento.online`; (8) `main` por fast-forward. Confirmação do dono antes de (2) e de (6).

## 10. Revela 2.0 publicado em fotosdocasamento.online (2026-11-09)
- **Produção:** `https://fotosdocasamento.online` (e `newmemocuiaba.vercel.app`) → `dpl_EZtKyENbbEP26KTZVpn2EeQ3T73i`, build automático da `main` em `df2970f`. O candidato validado e promovido foi `dpl_DRMMEk9bVhvFad1cuXtf9EgZTiQT` (mesmo SHA). `main` alinhada por fast-forward depois do smoke. `autoAssignCustomDomains=true` restaurado.
- **Rollback (app):** `dpl_Hm4o7eyrFkZEdQWShh5fdmKp1bY1` (`2de09ce`, app anterior) — promover esse deployment na Vercel. O banco não precisa voltar (migrations aditivas; o app anterior funciona com elas).
- **Supabase (`asyaegeodyttttaubvxh`, org `zpnbwkmukywzlkxdfeja`):** aplicadas `20261109000100…400` (37 migrations no histórico). Auth: `site_url = https://fotosdocasamento.online`; redirects mantidos + `https://fotosdocasamento.online/auth/callback` e `www`. Secret `ALLOWED_ORIGINS` com o domínio (CORS conferido por OPTIONS em `payments-validapay`). Funções de pagamento não foram republicadas. Provedor Email continua desligado (botão escondido; ligar com `NEXT_PUBLIC_EMAIL_LOGIN=1` depois de configurar SMTP).
- **Rollback (banco), só em incidente:** `supabase/ops/rollback_revela_20261109.sql` (restaura as funções vigentes antes da publicação; apaga comentários e e-mails de convidados criados depois).
- **Smoke no domínio:** `/`, `/entrar`, `/criar`, `/termos`, `/master`, `/e/<código inexistente>`, vídeo, câmera 3D e manifest com HTTP 200 e marca Revela; sem rolagem lateral em 360/390/430 px. Login com Google, criação de evento e pagamento não foram exercitados pelo agente (cobrança real ligada).

## 11. Revela 2.0 · telas fiéis (G1–G7) publicadas (2026-11-10)
- **Produção:** `https://fotosdocasamento.online` → `dpl_2QdPiDZPzVVMJ28SjFTq9bmucpiA` (SHA `e594aaa6c`, branch `feat/revela-redesign`; PR #30). Candidato `target=production` sem tráfego (`autoAssignCustomDomains=false`), validado pela API da Vercel (READY, sem erro no log, sem flags de teste em Production), promovido e `autoAssignCustomDomains=true` restaurado. Smoke no domínio: rotas públicas, vídeo, câmera 3D, fonte do PDF A5 e manifest com 200; `/dev/*` com 404.
- **Rollback (app):** promover `dpl_EZtKyENbbEP26KTZVpn2EeQ3T73i` (`df2970f`, versão anterior), depois `dpl_Hm4o7eyrFkZEdQWShh5fdmKp1bY1`.
- **Supabase (`asyaegeodyttttaubvxh`):** aplicadas `20261109000500` (`my_pose_times`), `…600` (quadros e fila de moderação do Master) e `…700` (opt-out de e-mail); 40 migrations no histórico. Funções `payments-validapay`, `-webhook`, `-reconcile` e `-refund` na versão 8 (flag `validapay_card` desligada por padrão; validade do Pix configurável). Rollback do banco: `supabase/ops/rollback_revela_20261109.sql` (inclui `my_pose_times`; as migrations 600 e 700 são só funções novas e podem ficar).
- **Pendente:** rodar o Axe de novo num build novo (correção de `/termos`), specs de nuvem/`master-*`/`audit-*`, pgTAP 29 com Postgres, e o ciclo de pagamento real (cobrança segue desligada).

## 12. Revela 2.0 · pacote final publicado (2026-11-10)
- **Produção:** `https://fotosdocasamento.online` → `dpl_5yPWCk9eY3CVy44JrsLUYXmucb33` (SHA `9cf32656a`, `feat/revela-redesign`). Candidato `target=production` sem tráfego (`autoAssignCustomDomains=false`), validado pela API (READY, 0 erros no log, sem flags de teste em Production), promovido e flag restaurada; smoke no domínio com 200 em todas as rotas públicas e 404 em `/dev/*`.
- **Rollback (app):** promover `dpl_8vNt6U4stgmmWqEabMxkQriDNW6U` (`277dec9`), depois `dpl_2QdPiDZPzVVMJ28SjFTq9bmucpiA` e `dpl_EZtKyENbbEP26KTZVpn2EeQ3T73i`.
- **Banco (`asyaegeodyttttaubvxh`, 47 migrations):** `…20261109000500/600/700`, `20261110000100` (correção do quadro de eventos), `…000200` (`reveal_now`), `…210` (motivo da denúncia), `…220` (`guest_download_high`), `…300` (`print_orders`), `…400` (`admin_export_csv`), `…500` (`admin_request_reconcile`). Rollbacks: `supabase/ops/rollback_revela_20261109.sql`, `rollback_revela_20261110_backend.sql`, `rollback_revela_20261110_exports.sql`.
- **Funções:** `payments-validapay*` v8, `payments-validapay-reconcile` v9 (encerra Pix vencido), `payments-reconcile-now` v1 (Conciliar agora, exige Master + aal2).
- **Limite da Vercel:** 100 deployments/dia; cada push em `feat/**` gera um preview. Evite pushes em sequência antes de publicar.
- **Documentos:** roteiro `docs/qa/ROTEIRO-TESTE.md`, catálogo `docs/qa/E2E-CATALOG.md`, retirados `docs/qa/E2E-RETIREMENTS.md`, Master antigo `docs/handoff/MASTER-PAGINAS-ANTIGAS.md`.
- **Pendente:** teste em celular real (câmera, filtro WebGL, QR no iPhone), pagamento ponta a ponta, specs de nuvem, redesenho das 5 páginas antigas do Master, fechar o download em alta no Storage, pedido de impressão na tela "Você" do convidado, atualizar `audit-*`, `master-studio` e `session` ao menu novo.

## 13. Revela 2.0 · console Master completo M15–M32 publicado (2026-11-12)
- **Produção:** `https://fotosdocasamento.online` → `dpl_3nYtL3ieAqUnkPxinoEpEpu1KE3E` (SHA `218b2431c`, `feat/revela-redesign`). Candidato `target=production` sem tráfego (`autoAssignCustomDomains=false`), validado pela API (READY, 0 suspeitos no log, sem flags de teste em Production), promovido e flag restaurada. Smoke: rotas públicas 200, `/dev/*` 404, `/master/analytics` e `/master/usuarios` redirecionam (308), `/master/*` sem sessão mostra só a entrada do operador.
- **Rollback (app):** promover `dpl_5yPWCk9eY3CVy44JrsLUYXmucb33` (`9cf32656a`).
- **Banco (`asyaegeodyttttaubvxh`, 54 migrations):** `20261111000100` (flag `printed_album`, desligada), `…200` e `…210` (Pessoas e exportação), `…300` (Visão geral/Eventos), `…400` (Moderação/Saúde/Auditoria), `…500` (Impressões), `…510` (Configurações). Rollback das funções substituídas: `supabase/ops/rollback_revela_20261111_console.sql` (as funções novas podem ficar).
- **Funções:** `payments-reconcile-now` v2 e `payments-validapay-reconcile` v10 (devolvem `unchanged` e `failures[]`).
- **Impressões:** menu e rotas só existem com a chave `printed_album` ligada em Configurações (hoje desligada).
- **Pendente:** teste visual do console com Supabase real e papéis reais (master/support/auditor), specs de nuvem, celular real, pagamento ponta a ponta.
