# A.5 — Homologação E2E — checkpoint de 21/10/2026


## Rodada 6 (22/10/2026): textos legais v1, aceite separado e retenção — parecer **GO operacional condicionado (uso acompanhado)**

Código `67fef3ceeec9d6467b51a05b6d1cadc708b8c1f1` (push na branch `feat/memoriesmt-studio`, autoria dos commits inalterada). Preview manual `dpl_BGLvn1MhU1bSsbBWCteNNu92ik51` (memoriesmt-v2, READY, SHA conferido). O deploy disparado pelo push segue `BLOCKED` (INF-005, e-mail do autor; o operador está corrigindo; não contornado).

**Requisito 7 (textos e retenção).** Termos e Política `2026-10-22-v1` publicados nas páginas e em `legal_documents` com origem "texto fornecido pelo operador" e `legal_review = nenhuma revisão jurídica profissional registrada`. **Não houve revisão por advogado e isto não é afirmado em lugar nenhum.** Responsável e contato conforme minuta; sem CNPJ, endereço, certificação ou localização de servidores inventados (teste automatizado impede).

**Aceite.** Duas caixas separadas e desmarcadas: "Li e aceito os Termos de Uso." e "Li a Política de Privacidade.". `record_consent` exige as duas afirmações e um contexto (`criar-evento` / `entrar-evento`), grava `terms_accepted_at` e `privacy_acknowledged_at` em colunas distintas e audita a Política como `ciencia`. Aceites históricos (rascunho) intactos.

**Achado: a V2 não cumpria a retenção que o texto promete.** Havia só "evento excluído sai em 30 dias". Implementado (migration aditiva `20261022001300`):
- `events.retention_policy` gravada pelo servidor na criação; o cliente não escolhe nem altera. **Só eventos criados a partir daí** (`2026-10-22-v1`).
- `can_see_photo` (decisão única de tabela, reações, URL assinada e Storage) retira o acesso de host e convidados 90 dias após o encerramento.
- `expire_retained_events()` (job `mm-expire-retention`, 03:05 diário) marca o evento excluído; `purge_deleted_events()` remove em 28 dias (eventos sob a política) e continua com 30 dias para os anteriores. Resultado: acesso cortado em 90 d e exclusão do armazenamento ativo em ≤ 28 d depois (promessa: ≤ 30 d). Fotos e miniaturas vão para a fila de purga do Storage (worker a cada 30 min, já homologado).
- Exclusão antecipada pelo organizador já retirava o acesso na hora e passa a seguir os mesmos 28 d para eventos sob a política.
- Aviso "Guarda das fotos … disponíveis até DD/MM/AAAA" nas configurações do evento (só eventos sob a política).

**O que NÃO foi alterado (decisão explícita).** Os 5 eventos existentes no remoto ficam **sem política** (`retention_policy` nulo): não ganham expiração automática nem perdem prazo; a rotina nunca os toca (teste pgTAP). Eventos sob a política hoje: 1 (o sintético desta rodada); nenhum vence antes de 20/01/2027. Nenhuma exclusão de dados reais foi executada.

**Incompatibilidades e dependências do operador (precisas):**
1. **Cópias de segurança.** O texto promete eliminar as fotos das cópias em até 30 dias adicionais. Não há backup gerenciado nem PITR (OPS-A5-002); só os dumps manuais em `~/Backups/memoriesmt/` (fora do Git, modo 600), que incluem as fotos do bucket quando o operador copia o Storage. A rotação é **manual**: `supabase/ops/rotate_local_backups.sh` (dry-run por padrão; remove diretórios com mais de 30 dias; testado só em pasta descartável; **não executado**). O compromisso só é cumprido se o operador a rodar pelo menos a cada 30 dias e, em caso de restauração, reaplicar as exclusões já determinadas. Hoje não há backup vencido (o mais antigo é de 21/10).
2. **Pedidos de exclusão em até 30 dias** (Política §7 e §8) continuam **manuais** por e-mail (`mazinhoww@gmail.com`); não há fluxo automático para o titular. Compatível com o prazo desde que o operador responda a tempo.
3. **Eventos anteriores à política** (5, todos de teste/uso interno) não têm expiração automática; o texto vale para eventos novos.

**Evidências desta rodada.**
- pgTAP **500/500** após `db reset --local` (nova suíte `06_retention` com 31 verificações de acesso aos 89/91 dias, legado intocado, idempotência, auditoria, fila de Storage, permissões e agendamento; `04_consents` ampliada; `02` ajustada para 6 jobs). Antes do reset, falhas em 01–03 eram sujeira de dados dos E2E no banco local, não regressão.
- vitest **293/293**; tsc 0; eslint 0 erros (11 avisos preexistentes); build 0.
- E2E padrão **54 passaram, 17 puladas** (as puladas exigem Supabase local); spec de superfície pública 4/4; E2E Supabase local (chaves locais, alvo local conferido) **9/9**, inclusive a falha de gravação do aceite (RPC respondendo 503: o convidado não entra, nada fica pela metade, com a rede de volta entra uma única vez) e o isolamento (outro usuário lê 0 aceites).
- Remoto (migration aplicada após backup `20261022-1304`, dry-run antes): `legal_documents` com a v1 e os rascunhos preservados; `record_consent` só `authenticated`; `expire_retained_events` sem acesso para `anon`/`authenticated`; 7 jobs `mm-*` ativos; 5 eventos antigos sem política.
- Preview `dpl_BGLvn1…`: `/termos` e `/privacidade` na v1, sem "rascunho" (90 d, exclusão em ≤ 30 d, backups em 30 d adicionais presentes). **Login Google no memoriesmt-v2:** seletor de contas com `redirect_to` do próprio preview, conta `mazinhoww@gmail.com` escolhida no seletor (sem digitar credenciais), retorno em `/criar` autenticado. **OPS-A5-001 resolvido** pela inclusão da URL feita pelo operador.
- Fluxo remoto: sem nenhuma caixa e só com os Termos, "Criar evento" é recusado (alerta); com as duas, evento sintético "TESTE – excluir (A5 r6)" (`9b4a42fc-3de4-4221-afaa-461b1c90d606`, Festa) criado. No banco: `retention_policy = 2026-10-22-v1`; aceite `organizador/criar-evento` com versões v1 e as duas datas; auditoria com `privacy = ciencia`. Configurações mostram "disponíveis até 20·01·2027".

**Parecer.** O único requisito obrigatório aberto da rodada anterior (7) está atendido **sobre texto fornecido pelo operador, sem revisão jurídica profissional**. Recomendação: **GO operacional condicionado a uso acompanhado**, com as três dependências acima aceitas pelo operador e com os itens já classificados como informados pelo operador (iPhone/Safari e Android/Chrome físicos; revisão jurídica de terceiros, se desejada) registrados por ele. O encerramento formal de A é decisão do operador; B, Codex e C **não foram iniciados**. Produção **não promovida**.

**Resíduos novos:** evento sintético `9b4a42fc…` (será excluído pela política em até 90 d + 28 d, ou antes pelo organizador); nenhuma limpeza executada.

## Rodada 5 (22/10/2026): corte final — parecer **NO-GO operacional** (um requisito obrigatório aberto)

**SHA publicado:** `975a49c8ea026c4e98f704b7a085f2039649a68d` (branch `feat/memoriesmt-studio`). **Previews do SHA:** `dpl_HpaBRySf9RzetNukhku4JUMfHTRL` (`memoriesmt-v2-1xq3b4zig-…`, rotas e backend) e `dpl_59rEWBMxuud3m9STBssRUtd9hgic` (`newmemocuiaba-psr0hqtne-…`, fluxo autenticado). Os dois READY, SSO mantido, produção intocada. Commits posteriores só mexem em documentação.

| Entrega | Resultado | Evidência (automática = agente; manual = operador) |
|---|---|---|
| 1. Preview e homologação remota | **Comprovado** | SHA conferido; `/`, `/entrar`, `/criar`, `/termos`, `/privacidade`, `/master`, `/offline` 200; `/design` 404; sem "Versão local" (backend Supabase). Login Google (manual do operador, repetido uma vez só para trocar a sessão do convidado); aceite gravado; evento **Festa** `N5585DH5` criado pela UI; personalização persistida no banco (terracota, Great Vibes, preto e branco, 10 convidados, 10 fotos) |
| 2. Revelação, galeria, download | **Comprovado** | evento `5YXYRX57`, `reveal_at` 07:13:00 UTC: o job real `mm-reveal-due` de 07:14:00 revelou (`revealed_at`=`reveal_at` por desenho; nenhuma revelação manual). Galeria do convidado: 1 foto por URL assinada; download autorizado (blob 200 `image/jpeg` 4994 B). Não membro: lista vazia, assinatura e download 400. Convidado anônimo ≠ organizador (sessões separadas) |
| QR | **Comprovado** | QR da tela remota decodificado (cv2): `…/e/N5585DH5`, igual ao código exibido; o destino abre o convite do mesmo evento. Captura: `evidence/a5-r5/screens/remoto-organizador-pronto-festa.jpg` |
| 3. Telas para uso real | **Concluído** | Landing sem "festa de exemplo", "exemplo com revelação" nem "Guia de componentes"; `/design` e troca de identidade só em build com `NEXT_PUBLIC_MM_DEV_TOOLS=1`; resumo do wizard e configurações sem preço/gratuidade/demonstração; plural ("1 foto"); moldura do desktop. 48 capturas locais (mobile 390×844 e desktop 1280×800, build público) + 3 remotas autenticadas (organizador, painel, Master) em `docs/supabase/evidence/a5-r5/screens/`. Portão do Master sem sessão: "Entre com sua conta de operador" (no-store, noindex) |
| 4. Deploy por push | **Bloqueado (INF-005 aberto)** | push cria o deploy sozinho, mas a Vercel Hobby o BLOQUEIA: autor do commit (`espindolanogueira@yahoo.com.br`) não pertence ao time (`dpl_6VKc7…`, `dpl_FGfLR…`, `BLOCKED`). Intervenção do dono: GitHub → Settings → Emails da conta `mzinhoww-svg`: adicionar e verificar esse e-mail; depois um push de teste. Não alterei autoria nem histórico. Caminho operacional: deploy manual por API |
| 5. Verificação | **Concluído** | vitest 279/279; `tsc` 0; eslint 0 erros (4 avisos); build 0; E2E padrão 54 passaram (16 pulados: Supabase local e captura); `public-surface` 4/4 (RED antes: 4 falhas); pgTAP 463/463 e E2E Supabase local não reexecutados (nenhuma mudança de banco/auth desde `1117239`) |
| 6. Segurança e dados | **Comprovado** | `SUPABASE_SERVICEROLE_KEY` ausente de Production por metadados (INF-004 DONE); `_1200` aplicada (cinco categorias); purga v2: 403/405/403; Master saúde: 6 jobs ativos, 0 atraso, sem alerta; backup manual `20261022-0235` e restauração isolada (rodada 2) |
| 7. Documentação | **Concluído** | relatório, backlog (217 itens, validador OK), handoff, ledger, publicação/rollback |

**Defeitos corrigidos nesta rodada:** categorias do wizard recusadas pelo banco; criação travada sem erro; itens de homologação na superfície pública; textos de preço; plural. **Abertos novos:** `OPS-A5-001` (Redirect URLs do Auth não incluem o domínio do `memoriesmt-v2`; o login nele cai no Site URL antigo), `UI-A5-001` (nome duplicado visto uma vez, indício de autofill), `UI-A5-002` (rótulo repetido em Configurações).

**Informado pelo operador, não executado pelo agente:** iPhone/Safari e Android/Chrome físicos; revisão jurídica e retenção; remoção da chave na Vercel (esta confirmada por metadados). Cenários dos aparelhos: `A5-MANUAL-RUNBOOK.md`, passos 3–7.

**Motivo do NO-GO:** o requisito 7 da spec (termos e privacidade com revisão registrada e retenção explícita) não está aplicado no produto: as páginas continuam com o aviso "Rascunho em revisão jurídica" e a política diz que a retenção "será definida". O operador informou a revisão, mas não entregou texto final, versão nem prazo, e eu não invento nenhum dos três. **Para virar GO:** o operador informa o texto final e o prazo de retenção; eu publico a versão nova (legal_documents + versões no código), removo o aviso de rascunho e rodo a spec de consentimento. Todo o resto exigido está comprovado; INF-005 não bloqueia (caminho manual documentado), assim como PITR e limpeza (adiados, com responsável: dono).

## Rodada 4 (22/10/2026): fluxo remoto com `mazinhoww@gmail.com`, achados e pendências operacionais — parecer **NO-GO operacional**

**Código:** `1117239efd37dd283fc9ea91b5a73417ad8122be` (push feito). **Preview:** `dpl_5f7JwTrDK7vhRnNJg4UVzza72MnD`, `newmemocuiaba-ifvr9b4fn-mzinhoww-gmailcoms-projects.vercel.app`, READY, SHA conferido. Itens que o dono mandou considerar feitos (variável da Vercel, revisão jurídica, retenção, aparelhos) **não foram reverificados** e seguem registrados como informados, não comprovados por mim.

| Item | Resultado | Evidência |
|---|---|---|
| Login Google real (`mazinhoww@gmail.com`) no preview | **Executado** | seletor de contas → `/criar` autenticado |
| Aceite + criação + personalização | **Executado** (Casamento, 1 h, Vintage/Oceano/Pinyon, 10 convidados, 5 fotos) | evento `5YXYRX57` no remoto; aceites `organizador` e `convidado` em `user_consents` |
| Convite/código | **Executado** | tela "Evento criado" com código; QR não conferido visualmente |
| Convidado anônimo + upload | **Executado** | entrada com aceite, foto enviada pelo fallback de arquivo (câmera simulada como indisponível; a permissão real de câmera não foi concedida), quota "restam 4 de 5"; foto `pronta` no banco |
| Revelação pelo cron real | **PENDENTE** | `reveal_at` = 2026-10-22 07:13 UTC; conferir `revealed_at` e a galeria depois dessa hora |
| Download autorizado | **PENDENTE** | depende da revelação |

**Defeitos reais achados e corrigidos no código (commit `1117239`):**
1. `events_category_check` recusava `festa`, `empresa` e `viagem` (3 de 5 categorias do wizard). O primeiro teste remoto com "Festa" falhou. Correção: migration `20261022001200_event_categories.sql` (relaxa o CHECK; mantém as do esquema) + pgTAP `05_event_categories` (RED: falharam 2–4; GREEN: 463/463). **A migration NÃO está aplicada no remoto**: o `db push` foi bloqueado pelo classificador (fora da autorização). Até lá, no remoto, só Casamento e Outro funcionam.
2. A falha de gravação travava o botão "Criar" sem mensagem. `createEvent` agora devolve erro e a tela destrava (vitest `service.test.ts`; suíte 278/278, `tsc` 0, E2E 54 passaram).
3. Pré-preenchimento do nome do organizador sai duplicado ("Aurimar NogueiraAurimar") com a conta Google: **não corrigido** (anotado).

**Backup/PITR (leitura):** `supabase backups list`: `pitr_enabled:false`, `walg_enabled:true`, `backups:[]`. Não há backup gerenciado nem PITR; só o backup manual. Ativar PITR é decisão de plano/custo do dono.

**Resíduos (QAV-004):** inventário: 4 contas `@memoriesmt.test`, 25 sessões anônimas anteriores a 22/10, 9 objetos órfãos em `event-photos`. Há também um evento com título de uso real ("Aurimar & Leticia") e a conta master, **fora do alvo**. Exclusão definitiva não foi executada (ação que não faço mesmo a pedido). Entregue `supabase/ops/cleanup_test_residues.sql` (dry-run + execução guardada, enfileira órfãos na fila de purga), validado no banco local: contou 1/1/1/1 e preservou master, evento real, anônima vinculada e a de hoje. Falta o operador rodar, após backup do dia.

**INF-005 (deploy por push):** causa raiz: o projeto `newmemocuiaba` está ligado ao repositório `mzinhoww-svg/newmemocuiaba`, não ao `memo-brasil`; por isso push nunca disparou deploy. Criei o projeto `memoriesmt-v2` (`prj_udH3tmy4ZU5vAEIPVH61UVP6GEgs`) ligado a `memo-brasil`, raiz `web`, produção = `main`, sem deploy. Variáveis de Preview criadas: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Bloqueado pelo classificador:** `NEXT_PUBLIC_MM_BACKEND=supabase` (sem ela o build roda em modo local), framework `nextjs` e SSO "todos os domínios". Push→deploy **não comprovado** (0 deployments no projeto novo; o commit/push seguinte também foi bloqueado). Não promovi nada; a produção do `newmemocuiaba` não foi tocada.

**Para o GO:** (a) aplicar `_1200` no remoto; (b) completar a configuração do `memoriesmt-v2` e provar um push→deploy; (c) conferir a revelação às 07:13 UTC e o download; (d) rodar a limpeza; (e) decidir PITR; (f) reconferir `SUPABASE_SERVICEROLE_KEY` em Production.

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
