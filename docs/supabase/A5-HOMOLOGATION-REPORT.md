# A.5 — Homologação E2E — checkpoint de 21/10/2026


## Rodada 3 (22/10/2026): aplicação da migration, purga v2, alerta e preview atualizado — parecer **NO-GO operacional**

**SHA candidato:** `26d9674e47b1dfde7fd871063bfa5de19e4e2c97` (branch `feat/memoriesmt-studio`). **Preview:** `dpl_25h3hDg1NjF7Q6bhe3fwqfBRSr1m`, `newmemocuiaba-la9u9il5p-mzinhoww-gmailcoms-projects.vercel.app` (SSO mantido), READY, `meta.githubCommitSha` igual ao SHA; `/termos` 200 com a V2, contato e título com um só sufixo. Produção intocada (legado `3a8bf89`, não promovida).

| # | Entrega | Resultado | Evidência |
|---|---|---|---|
| 1 | Variável da Vercel | **NÃO confirmada** | `filter_project_envs` (metadados, sem ler valor): `SUPABASE_SERVICEROLE_KEY` ainda em `production` (id `CPm04k6Py9oib7U5`, sensitive, `updatedAt` 1792590718665, o mesmo de antes). O operador informou a remoção; os metadados não a mostram. Preview não tem service_role |
| 2 | Projeto, backup, migration | **Concluído** | ref `asyaegeodyttttaubvxh`; backup novo `~/Backups/memoriesmt/<data-hora>` (schema 140 900 B, data 68 852 B, modo 600; sha256 schema `cbd7b4cc…6750`, data `658d5e00…fee8`); `db push --dry-run` listou só `20261022001100_user_consents.sql`; aplicada; `migration list`: local=remote. Remoto: RLS ligada nas duas tabelas, `record_consent` executável só por `authenticated`, 2 documentos legais, 0 aceites |
| 3 | `purge-storage` | **Publicada; falha real NÃO exercida** | v2, `verify_jwt=false`. HTTP: POST sem token 403, GET 405, token falso 403. 6 jobs `mm-*` ativos, fila vazia, últimas respostas 200 `{"ok":true,"falhas":0}`. Alerta: `health-alerts.ts` + `/master/saude` (fila >7200 s, revelação vencida, envio parado, pg_cron fora, job inativo/falho); vitest 5/5, suíte 277/277, `tsc` 0. Não se injetou falha em dado compartilhado |
| 4 | Documentos legais | **Contato definido; revisão e retenção PENDENTES** | `mazinhoww@gmail.com` em `/termos` e `/privacidade`. Retenção: nenhuma decisão aprovada para a V2 (o 365 d de `docs/deploy.md` é do legado) |
| 5 | Fluxo remoto com evento sintético | **NÃO executado** | O login Google abriu o seletor com várias contas reais; escolher a conta do organizador é decisão do dono. Login Google real: registrado como validação manual do operador (não repetido) |
| 6 | iOS Safari / Android Chrome | **PENDENTE** | Sem `adb`, sem ferramentas iOS, sem aparelho USB; emulação não substitui |

Nenhum dado real, Auth, projeto de terceiros ou produção foi alterado. Mudanças remotas desta rodada: migration `_1100` (aditiva) e `purge-storage` v2, ambas autorizadas pelo operador.

**Ruling:** versão dos textos mantida em `2026-10-21-rascunho` ao incluir o contato — publicar nova versão exigiria DML em `legal_documents`, fora da autorização, e há 0 aceites gravados. Custo: quando houver revisão jurídica, publicar versão nova.

**Decisão: NO-GO.** Restam: (a) remover `SUPABASE_SERVICEROLE_KEY` de Production e reconferir; (b) escolher a conta Google do organizador e executar o fluxo remoto sintético e o cron real; (c) revisão jurídica e retenção; (d) aparelhos físicos; (e) INF-005 (push→deploy), QAV-004, backup automático/PITR.

## Rodada 2 (21–22/10/2026): execução do plano operacional — parecer **NO-GO operacional**

Código testado: `ff712e3` (branch `feat/memoriesmt-studio`, integrada com `qa/a5-homologation-20261021`). Preview anterior: `dpl_B91ajh2QfZVrd6jc4KLfHwWxFA38` (`8ea3518`, sem aceite). Preview do candidato final: ver `docs/supabase/A5-EXECUTION-LEDGER.md`. Procedimento de publicação e rollback: `PUBLISH-AND-ROLLBACK.md`. Recuperação: `OPERATIONAL-RECOVERY.md`.

### Matriz de aceite (nove critérios da spec)
| # | Critério | Situação | Evidência |
|---|---|---|---|
| 1 | Organizador: Google, cria, personaliza, salva/reabre, link/código/QR | **Parcial** | Local: `flows` 16/16 e `studio-local` (tema isolado e restaurável), zero skips, Chromium oficial. **Falta:** login Google real e evento sintético no preview |
| 2 | Convidado em aparelho independente, câmera/fototeca, confirmação só após persistir, retry sem duplicar | **Parcial** | Integração: reenvio = 1 foto e 1 unidade de rolo; sexta foto recusada (quota 5); MIME e tamanho recusados. E2E Supabase com contexto independente. **Falta:** aparelhos reais |
| 3 | Quotas e permissões no servidor; sem acesso a evento alheio; sem sessão só prévia | **Comprovado (local + remoto anônimo)** | pgTAP 454/454; organizador B não lê/escreve/assina mídia de A (integração); probe remoto 30/30 com `scv010Closed: true`. **Falta:** matriz com sessões autenticadas remotas |
| 4 | Foto privada inacessível antes da revelação; job libera; downloads por papel | **Parcial** | Integração: antes não lista/baixa/assina; depois membro vê e estranho segue negado; fuso America/Cuiabá segue o instante do servidor. **Falta:** cron real do remoto com evento sintético |
| 5 | Token vencido + refresh válido renova; refresh inválido encerra; Master no backend | **Comprovado localmente** | `session.spec` 3/3 (inclui requisição sem JS e controle negativo) e `master-studio` 3/3. SCV-007 **não reproduzido**; sem `proxy.ts`. **Falta:** sessão Google real |
| 6 | iPhone/Safari e Android/Chrome reais | **PENDENTE** | Nenhum aparelho disponível. Roteiro: `A5-MANUAL-RUNBOOK.md` |
| 7 | Termos/privacidade, aceite versionado e auditado, revisão registrada, retenção explícita | **Não atendido** | Implementado e testado: páginas, `record_consent`, auditoria (pgTAP, vitest, E2E). **Falta:** revisão jurídica registrada e retenção definida (texto é rascunho); migration `_1100` não aplicada no remoto |
| 8 | Backup de banco e objetos; restauração isolada; saúde consultável | **Parcial** | Backup manual 15/15 checksums; restauração em container isolado, 0 erros de schema; `auth.*` exige stack Supabase. Backup automático/PITR não verificados |
| 9 | Preview = SHA; publicação e rollback comprováveis; sem falha crítica aberta | **Parcial** | Preview por API reproduzido 2×, SHA conferido. Procedimento escrito, não executado. Falha crítica aberta: INF-004 |

### Executado nesta rodada
- Suítes: pgTAP 454/454 (430 + 24 de consentimento); vitest 272/272; integração 15/15 (adapter + Supabase) e purga 2/2; E2E padrão 53 passaram e 14 foram pulados por exigirem Supabase local; E2E Supabase 8/8; `tsc` e build 0; eslint 0 erros (11 avisos preexistentes).
- Falhas reproduzidas e tratadas: (a) `GoogleButton` mudou o rótulo e o E2E ficou defasado (RED→GREEN); (b) BG-102 falhava por seletor ambíguo, **já na linha de base sem as mudanças desta rodada** (provado em worktree descartável); (c) servidor local de funções com flag errada devolvia 401 no lugar de 403 (ambiente, corrigido); (d) o teste de fuso falhou por premissa errada sobre o recálculo de `reveal_at` (o servidor está certo; teste ajustado).
- A falha do wizard do runner alternativo da QA **não se reproduz** no Chromium oficial do Playwright: `flows.spec.ts` 16/16.
- Testes novos que passaram de primeira porque o comportamento já existia (caracterização, sem RED): isolamento do organizador B, reenvio/quota, fuso, sessão.

### Pendências originais de A (não encerradas)
INF-004 (chave service_role em Production; verificado que nem o fonte nem o build de `3a8bf89` a leem; remoção cabe ao dono), SCV-009 (correção local; faltam publicar e provar no remoto, e o alerta), INF-005 (caminho por API comprovado; push→deploy segue aberto), QAV-004 (adiado, inventário preservado), SCV-007 (não reproduzido), COM-004 (falta revisão jurídica), testes com Google real e aparelhos.

### Intervenções manuais necessárias
1. Operador: `supabase db push --linked` para aplicar `20261022001100_user_consents.sql` (aditiva) e `supabase functions deploy purge-storage --project-ref asyaegeodyttttaubvxh`, depois de backup. Conferir com `supabase migration list --linked` e as respostas 403/405 da purga.
2. Dono: remover `SUPABASE_SERVICEROLE_KEY` de Production na Vercel (Settings → Environment Variables).
3. Dono/jurídico: revisar `/termos` e `/privacidade`, definir retenção e canal de contato; então publicar nova versão em `legal_documents`.
4. Qualquer pessoa com os aparelhos: roteiro de `A5-MANUAL-RUNBOOK.md`, passos 3–7 em iPhone/Safari e Android/Chrome, e o login Google no preview.

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
| SCV-010 | DONE nesta branch de homologação: Google ativo, Email inativo; POST de cadastro sintético recusado com 400 `email_provider_disabled`; sem usuário/sessão criados | Evidência versionada em `c0fd33b`. `disable_signup=false` permanece para não bloquear o fluxo Google/convidado; não significa Email habilitado |
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

O backlog acessível tem **213 itens sem épicos**, não os 256 mencionados como reconciliação paralela nos anexos. O validador inicialmente falhou: SCV-004 estava DONE com SB-005 aberto; SCV-005 estava DONE com MAD-002 aberto. As evidências históricas foram preservadas e somente esses fechamentos voltaram a IN_REVIEW até suas dependências serem reconciliadas. SCV-010 fechado com evidência `c0fd33b`; SCV-009 em revisão e demais intervenções bloqueadas. O validador voltou a passar. Não houve integração da proposta da frente B.

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
