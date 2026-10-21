# Inspeção somente leitura: Vercel e Supabase (2026-10-21)
Ferramentas: conector Vercel (list_deployments, filter_project_envs, get_runtime_errors) e conector Supabase (list_projects). Nenhuma escrita.

## Vercel (time mzinhoww-gmailcoms-projects, projeto newmemocuiaba, prj_IpHyqsnnbrXS213AGrOmxizb0Kjl)
- Variáveis de ambiente: **nenhuma** (envs=[]; hiddenProductionEnvCount=0). Sem segredos no projeto.
- Deployments (3): `dpl_2vNJyjZnaMbcmM2ihKNLZYSCuUSJ` production, commit 3a8bf89, READY; `dpl_7VdcBUECb2HuewXZrnSRygcGsNAt` preview, 7e0f9ec, READY; `dpl_Cq1otDUS9DsuZVFqthubBfGLEEAz` preview, 5d8df4a, READY.
- Erros de runtime em 24 h: nenhum.
- Domínios: apenas *.vercel.app. Repositório vinculado ao projeto: nenhum (deploys criados com gitSource pela API; sem integração Git automática).

## Supabase (conta acessível ao conector)
Projetos listados (6): supabase-purple-book (tqgttdqxdctykgyssvkp, INACTIVE), the-loyalty (qjqnqcsdnpvvmyzkavoq, INACTIVE), crm-ai-studio (nwynoyqdrxaujlcratnx, INACTIVE), ListaEscolar (hojbnqkwzsicahzgshne, ACTIVE_HEALTHY), listada-escola (wfdejmokxrunupsekcmq, INACTIVE), citynews-prod (vmvirmemxfdtxfdmivuu, ACTIVE_HEALTHY).
- **Nenhum se chama `newmemocuiaba`** e **nenhum tem a ref `asyaegeodyttttaubvxh`** (informada antes pelo usuário).
- `newmemocuiaba` é o nome do projeto **Vercel**. O pedido o chamou de projeto Supabase: divergência a esclarecer.

## Correção de contexto informada pelo usuário (2026-10-21), NÃO verificada pelo auditor
O usuário informou, após confirmar pelo plugin Supabase do ChatGPT, que o projeto existe e está ativo: nome `newmemocuiaba`, ref `asyaegeodyttttaubvxh`, organização `zpnbwkmukywzlkxdfeja`, região us-west-2, status ACTIVE_HEALTHY, PostgreSQL 17.
**Classificação:** o projeto NÃO é tratado como inexistente. O que a auditoria observou é um **bloqueio de acesso do conector Supabase do Claude** (o conector enxerga outra conta/organização: `vercel_icfg_a71TEE6OkIZ69uoxz46MSdHA`, sa-east-1, 6 projetos), possivelmente divergência de conta, organização ou permissões. É um bloqueio de infraestrutura, separado dos achados de produto. A auditoria não tem como confirmar nem negar o estado do projeto por conta própria.
