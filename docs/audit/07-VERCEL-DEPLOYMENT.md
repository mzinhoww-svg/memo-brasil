# 07 · Vercel

Inspeção somente leitura pelo conector Vercel (consolidador) + smoke remoto. Evidência: `evidence/logs/vercel-supabase-inspection.md`, `vercel-prod-headers.txt`, `test-results/e2e-baseline.json`.

| Item | Estado |
|---|---|
| Projeto | `newmemocuiaba` (`prj_IpHyqsnnbrXS213AGrOmxizb0Kjl`), time `mzinhoww-gmailcoms-projects`; framework Next.js, Root Directory `web`, Node 24.x |
| Repositório | **Não vinculado** ao projeto: deploys criados pela API com `gitSource` (INF-003) |
| Variáveis de ambiente | **Nenhuma** (sem segredos no projeto) |
| Domínios | Só `*.vercel.app` |
| Deployments | `dpl_2vNJ…` **production** 3a8bf89 (primeiro build, READY); `dpl_7VdcB…` preview 7e0f9ec; `dpl_Cq1ot…` preview **5d8df4a** (READY, validado) |
| Runtime | Sem erros nas últimas 24 h |
| Preview vs produção | **Divergentes**: produção serve 3a8bf89 (sem CSP, sem X-Frame-Options, sem correções da auditoria anterior); só HSTS vindo da Vercel (INF-002) |
| Proteção do preview | SSO da Vercel (302); acesso por link temporário oficial; proteção **não** removida |
| Smoke remoto no preview 5d8df4a | 5/5 passaram: home, fontes, tema, manifest, SW; criar evento/entrar/postar/reagir; painel e rota inexistente offline; headers, 404 pt-BR e ausência do relógio de teste no bundle; revelação programada com relógio do navegador e sem rede |
| Promoção a produção | **Não feita** e **bloqueada** (REL-001): destino não confirmado pelo dono para promoção |

**Limite:** o smoke remoto cobre os fluxos testados, não o produto inteiro; a home funcional não prova o restante (por isso foram rodados fluxos de criação, convidado, painel e revelação).

## Achados de infraestrutura
- **INF-002 (P2):** produção com build antigo e sem headers/CSP. Resolver promovendo o preview validado, só com autorização.
- **INF-003 (P3):** projeto sem Git vinculado. Decidir entre vincular (Root Directory `web`) ou manter deploy manual documentado.
- **INF-001 (P1):** conector Supabase do Claude não enxerga o projeto de destino. Ver `08`.
