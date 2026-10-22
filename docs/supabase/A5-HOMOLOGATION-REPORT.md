# A.5 — Homologação E2E — checkpoint de 21/10/2026

**Decisão: NO-GO para produção. A frente A não está concluída.** Esta rodada concluiu as verificações possíveis no ambiente disponível; não concluiu a homologação autenticada nem os testes físicos. Nenhuma produção, configuração Auth, dado real, Edge Function remota ou migration remota foi alterada nesta sessão.

## Fonte e escopo

- Código remoto verificado: `mzinhoww-svg/memo-brasil`, `feat/memoriesmt-studio`, `57a30eb0f95342f19a85d51ff356296d9a4fd781`.
- Preview Vercel verificado: `dpl_2v3GF6rj7GHeE8vBGFCRyxyDdKwf`, código `ca7a274a6f9510c1271b99ac79c9e8f112ad79d1`.
- Supabase: `asyaegeodyttttaubvxh` / `newmemocuiaba`, saudável; 16 migrations aplicadas e duas Edge Functions ativas.
- Os dois anexos foram lidos integralmente. Ambos contêm instruções para produzir handoff. Os documentos `docs/handoff/MEMORIESMT-MASTER-HANDOFF.md`, `docs/handoff/NEXT-SESSION.md` e este relatório A5 não existiam na branch remota ao iniciar. O commit `6d84c31` não foi encontrado pela API GitHub (422). O estado das worktrees do Mac permanece desconhecido.
- Foi usado um snapshot parcial recuperado por blobs GitHub, com fontes, testes, configuração e assets, em diretório isolado. O Git local desse snapshot não possui o histórico remoto. Alterações remotas devem preservar como pai o commit remoto acima.
- Superpowers aplicado: execução, debugging, TDD e verificação antes de concluir; revisão independente ao final. Skills Supabase e Browser também consultadas.

## Resultados por requisito do operador

| Requisito | Resultado atual | Limite da evidência |
|---|---|---|
| 1. Google, Master, refresh e expiração | PARCIAL: conta Google confirmada, `app_metadata.role=master`, concessão ativa, uma sessão; `is_master()` e `admin_health()` aprovados no banco | Acesso `/master` informado pelo operador. Consultas SQL com contexto de claims simulado não comprovam login, assinatura, refresh ou expiração de JWT no navegador |
| 2. Isolamento de permissões | PARCIAL: organizador sem papel Master/settings/eventos alheios; convidado sem convites/papéis/fotos ocultas ou prontas antes da revelação; claim Master sem concessão negada | Leituras RLS com usuários existentes em transações READ ONLY, sem modificar registros; faltam tentativas de escrita/IDOR e fluxo HTTP autenticado com fixtures descartáveis |
| 3. Criação e personalização no Studio | NÃO HOMOLOGADO: primeiro E2E local reprovou no runner alternativo | Build e testes unitários passaram. Teste de criação ficou no primeiro passo; causa ainda não atribuída ao produto. Não houve aceite do Studio |
| 4. Convites, QR, câmera, upload, quotas, galeria, revelação | PARCIAL: autorização anônima, configuração de buckets privados, limites MIME/tamanho, jobs e leitura antes da revelação verificados | Não houve criação/upload/revelação de um evento de teste remoto nesta sessão. Uso de câmera, QR e quotas pela UI permanece pendente |
| 5. iOS Safari e Android Chrome reais | PENDENTE FÍSICO | Nenhum aparelho físico disponível. Emulação não substitui esse aceite |
| 6. RLS, RPCs, auditoria, Functions e cron | PARCIAL: 16 tabelas com RLS; 30/30 sondagens HTTP; funções ativas; seis jobs ativos; auditoria íntegra | RPCs administrativas de leitura testadas; operações de escrita e destrutivas não executadas. `mm-purge-deleted` ainda sem execução registrada na consulta; não foi disparado manualmente |
| 7. Cinco itens de bloqueio | Ver tabela abaixo | Nenhum item foi fechado por mera implementação |
| 8. Automação, logs e correções | 266/266 unitários; typecheck e lint aprovados; build com saída 0 e artefatos; um bug corrigido com RED→GREEN | Integração bloqueada antes de qualquer teste; E2E bloqueado antes da jornada; pgTAP não reexecutado sem Supabase local/Docker |

## Evidências automatizadas

Diretório: `docs/supabase/evidence/a5-20261021/`.

| Verificação | Resultado | Evidência |
|---|---|---|
| Unitários existentes | 262/262 | `unit.txt` — a primeira tentativa encontrou asset ausente no snapshot; o asset foi recuperado do mesmo commit, sem mudar testes |
| Unitários após correção | 266/266 em 28 arquivos | `unit-final.txt` |
| Regressão SCV-009 | RED: duas falhas, HTTP 200 em vez de 500; GREEN: 4/4 | `purge-red.txt`, `purge-green.txt`; teste executa o handler real com SDK externo substituído |
| Typecheck | saída 0 | `typecheck-final.txt` |
| ESLint | saída 0; zero erros, 11 avisos preexistentes | `lint-final.txt` |
| Build | saída 0; BUILD_ID, manifests e 35 páginas compiladas presentes | `build.txt`; não prova deploy remoto |
| HTTP sem sessão | 30/30 | `http-readonly.json`: 16 tabelas e sete RPCs retornam 401/42501; Functions 401/403/405; endpoints públicos dos buckets recusados |
| Backend, RLS, grants e catálogo | consultas somente leitura, resultados por cenário | `backend-readonly.json` |
| Integração | BLOQUEADO: zero testes executados por falta de SUPABASE_URL/chaves de stack local | `integration.txt`; não usar service_role do remoto para contornar |
| E2E local | REPROVADO no runner alternativo: 1 falhou, 15 não executados | `e2e-chromium153.txt`: timeout no wizard ao procurar a etapa de revelação. Primeira tentativa falhou por binário ausente; o download oficial foi inválido. Chromium 153 recuperado do pacote de tooling permitiu iniciar a execução, sem comprovar equivalência ao Chromium 156 esperado pelo Playwright |
| pgTAP | NÃO EXECUTADO nesta sessão | 430/430 é informação histórica dos anexos, não resultado desta rodada |

Smoke HTTP local: cinco rotas retornaram 200 e HTML da marca quando servidor e probe foram executados no mesmo ambiente de processo (`local-route-smoke.json`). A primeira tentativa entre execuções separadas recebeu connection refused (`local-route-smoke-initial.json`). HTML servido não comprova hidratação ou jornada UI.

O probe também tem quatro testes próprios de segurança da evidência: configuração insegura retorna falha, origem é identificada corretamente, alvo divergente é recusado e signup negativo exige opção explícita. Revisão independente e correções em `A5-REVIEW.md`.

Diagnóstico do E2E alternativo: o snapshot final permaneceu no passo Nome, com campos inválidos; o diagnóstico de preenchimento retornou valores vazios logo após preencher. Não há raiz comprovada para atribuir essa falha ao produto ou corrigir código por tentativa. Reproduzir com o navegador da versão oficial do Playwright e capturar console/trace; o teste falho não foi omitido nem convertido em PASS.

## Estado dos cinco itens exigidos

| ID | Situação comprovada | Trabalho restante |
|---|---|---|
| SCV-010 | VALIDAÇÃO TÉCNICA PASSOU: Google ativo, Email inativo; POST de cadastro sintético recusado com 400 `email_provider_disabled`; sem usuário/sessão criados | Registrar fechamento com commit da evidência. `disable_signup=false` permanece para não bloquear o fluxo Google/convidado; não significa Email habilitado |
| INF-004 | BLOCKED: `SUPABASE_SERVICEROLE_KEY` ainda em Production, tipo sensitive; valores não lidos | Operador confirmar dependência do Lume, remover a variável quando aprovado e validar metadados. Não houve remoção nem rotação nesta sessão |
| SCV-009 | CORREÇÃO LOCAL PARCIAL: falhas do Storage ou da baixa de fila agora retornam HTTP 500; quatro testes novos | Sem deploy remoto. Falta alerta explícito para fila >2h e teste de falha em ambiente descartável. Oito últimas respostas reais observadas eram 200/zero falhas, fila vazia; isso não demonstra alerta |
| INF-005 | BLOCKED: projeto retornou framework null; preview atual foi produzido com parâmetros manuais | Root directory/Git integration e preview automático por push não foram homologados; listagem/build/runtime logs falharam com 403 de escopo da equipe |
| QAV-004 | BLOCKED: quatro contas Email de teste, nove objetos órfãos em event-photos, zero órfãos em event-branding | Limpeza requer backup e autorização de remoção; não executar sob a restrição atual. Não há prova de restauração de backup nesta sessão |

## Backend e operação

- Organizador e convidado recebem `MM004` ao tentar `admin_health()`; Master recebe métricas agregadas. Uma claim Master atribuída a conta sem concessão ativa não libera o papel.
- Auditoria: 53 registros na consulta, integridade `ok`, seis triggers protetivos e event triggers presentes, UPDATE/DELETE negados ao cliente e DELETE negado ao service_role. Não se tentou adulterar a auditoria.
- Buckets `event-photos` e `event-branding` privados; limites 8 MiB e 5 MiB; JPEG/PNG/WebP.
- Jobs: `mm-reveal-due` a cada minuto; `mm-expire-uploads` e `mm-audit-integrity` a cada 10 min; `mm-expire-assets` a cada 15 min; `mm-purge-storage` a cada 30 min; `mm-purge-deleted` às 03:17 UTC. Todos ativos. Saúde consultada: revelações atrasadas 0, uploads falhos/travados 0, fila 0.
- Advisors: avisos registrados, sem inventar que estão resolvidos. Há um grant anon em `guard_audit_ddl()` (função event trigger) e avisos sobre funções SECURITY DEFINER/policies para convidados. Conceder EXECUTE não basta para comprovar exploração; requer análise específica. Proteção contra senhas vazadas desligada, com Email desabilitado. Ver `supabase-security-advisors.json`.
- Logs Supabase: agregação nas últimas 24h disponível, incluindo avisos Auth `validation_failed`, `anonymous_provider_disabled`, `phone_provider_disabled`, `email_provider_disabled` e `no_authorization`. Não equivale a ausência de incidentes. Detalhes com dados pessoais/tokens não foram exportados.
- Vercel: metadados disponíveis; listagem e logs responderam 403 para `mzinhoww-gmailcoms-projects`. O navegador mostrou login Vercel. Auto-review recusou a ferramenta que criaria um link temporário dispensando login. Nenhum bypass foi criado ou tentado por outra via.

## Backlog, B, Codex e C

O backlog acessível tem **213 itens sem épicos**, não os 256 mencionados como reconciliação paralela nos anexos. O validador inicialmente falhou: SCV-004 estava DONE com SB-005 aberto; SCV-005 estava DONE com MAD-002 aberto. As evidências históricas são preservadas; esses fechamentos devem voltar a revisão até suas dependências serem reconciliadas. Não houve integração da frente B.

| Frente | Estado que esta sessão permite afirmar | Aberto |
|---|---|---|
| A — V2 | Implementação disponível, homologação parcial, NO-GO | E2E autenticado, sessão, físicos, INF-004, INF-005, revisão/monitoramento e higiene conforme tabela |
| B — backlog/roadmap | PENDENTE; proposta de 256 itens não localizada no remoto | Recuperar `integration/roadmap-v3` / `planning/memoriesmt-roadmap` e diferenças locais; reconciliar IDs/evidências/dependências; integrar backlog e roadmap; validar READY/releases |
| Codex — Growth Factory | Apenas estado reportado nos anexos | Avatar/lip sync, publicação oficial Instagram/TikTok, infraestrutura persistente e recuperação ENOSPC; recuperar branch/artefatos antes de confirmar avanço |
| C — GTM | Apenas planejamento reportado nos anexos | Validar preços/planos com clientes, piloto comercial, canal de cerimonialistas, custos/CAC e aquisição real |

As branches de B, Growth Factory e GTM não aparecem nas 23 branches remotas retornadas pela listagem completa consultada. Isso não comprova perda de trabalho local. Não foi feito novo discovery ou iniciada execução dessas frentes. Ordem mantida: **A → B → Codex → C**.

## Para transformar A em GO

1. Recuperar no checkout de origem o commit/handoffs que não foram enviados; comparar com esta rodada sem sobrescrever trabalho local.
2. Disponibilizar preview autenticado e acesso ao escopo Vercel correto; conferir um preview do mesmo commit que será homologado.
3. Resolver INF-004 após checar a dependência do legado; homologar INF-005 com push gerando preview de `web/`.
4. Rodar pgTAP e integração em Supabase local/descartável, depois E2E autenticado com quatro contextos, sessões e uploads.
5. Executar roteiro físico iOS Safari/Android Chrome e anexar evidência por cenário.
6. Homologar falha/recuperação da purga e alerta >2h; tratar higiene somente com backup e autorização próprios.
7. Atualizar evidências e emitir novo GO/NO-GO. Mesmo um GO não autoriza promoção Production.

Comandos e intervenções detalhados: `docs/supabase/A5-MANUAL-RUNBOOK.md`. Retomada: `docs/handoff/NEXT-SESSION.md`.
