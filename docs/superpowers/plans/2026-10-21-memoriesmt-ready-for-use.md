# MemoriesMT pronto para uso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Método preservado: execução autônoma pelo agente principal, sem nova escolha de método ou aprovação entre fases técnicas.

**Goal:** Entregar a V2 operacional para eventos reais acompanhados, fechar o aceite de A e evoluir B → Codex → C sem aguardar todo o roadmap.

**Architecture:** Preservar Next.js em `web/` e Supabase como fonte de autorização, dados e mídia. Reutilizar os testes e funções existentes; corrigir somente problemas reproduzíveis que bloqueiem a jornada. Primeiro uso assistido, sem checkout/cobrança automática; monetização segue no roadmap.

**Tech Stack:** Next.js 16.4.2, React 19.3, TypeScript, Supabase Auth/Postgres/RLS/Storage/Edge Functions/Cron, Vitest, Playwright, pgTAP e Vercel. Manter versões do lockfile.

**Spec:** `docs/superpowers/specs/2026-10-21-operational-release-design.md`.

## Global Constraints

- Ordem: A → B → Codex → C; preparar o plano não inicia B ou C.
- Não refazer discovery nem implementar funcionalidades fora do corte operacional V2.
- Não alterar dados reais de usuários, executar reset remoto ou limpeza destrutiva.
- Nunca exportar segredos, cookies ou tokens; service_role não entra no frontend nem na Vercel.
- Testes de escrita, revogação, falha de purga e limpeza de fixtures usam stack descartável; preview compartilhado recebe somente eventos sintéticos identificados, pela UI e permissões normais.
- iOS Safari e Android Chrome reais são requisitos de aceite; emulação não os substitui.
- Execução técnica autônoma, sem aprovações entre fases; preservar a restrição específica de promoção de produção sem autorização explícita para publicar a versão identificada.
- Não transformar pendência adiada em DONE: registrar motivo, mitigação, responsável e condição de retomada.

## Review Focus

- Sessão vence durante salvar/enviar: renovar ou voltar ao login, sem falso sucesso nem acesso residual (tarefa 3).
- Rede cai e usuário repete envio: uma foto persistida e uma unidade de quota consumida (tarefa 4).
- ID ou caminho de Storage de outro evento: negar leitura, escrita e URL assinada (tarefa 3).
- Câmera negada ou retorno do segundo plano: informar ação útil, permitir fototeca e continuar sem tela travada (tarefa 4).
- Fuso do cliente diverge do evento: revelação segue instante do servidor; antes dele, nenhuma mídia indevida (tarefa 4).

## Arquivos e responsabilidades

| Área | Caminhos principais |
|---|---|
| Criação/tema | `web/src/features/events/wizard.tsx`, `web/src/features/studio/AppearanceStudio.tsx`, `web/src/features/events/service.ts`, `web/e2e/flows.spec.ts`, `web/e2e/studio-local.spec.ts` |
| Sessão/autorização | `web/src/lib/supabase/client.ts`, `web/src/lib/supabase/server.ts`, `web/src/lib/master/server.ts`, `web/src/features/app/provider.tsx`, `web/src/repositories/supabase/index.ts` |
| Testes com servidor | `web/playwright.supabase.config.ts`, `web/e2e/master-studio.spec.ts`, `web/e2e/supabase.spec.ts`, novo `web/e2e/session.spec.ts`, `web/integration/supabase.integration.test.mjs`, `supabase/tests/database/` |
| Mídia/operação | `supabase/functions/finalize-asset/index.ts`, `supabase/functions/purge-storage/index.ts`, `web/src/lib/purge-worker.test.ts`, `web/e2e/reveal.spec.ts`, `supabase/ops/a5-readonly-probe.mjs` |
| Aceite/entrega | `docs/supabase/A5-HOMOLOGATION-REPORT.md`, `docs/supabase/A5-MANUAL-RUNBOOK.md`, `docs/handoff/`, `docs/backlog/backlog.json` |

### Tarefa 1 — Tornar o candidato acessível e reproduzível

**Arquivos:** atualizar `docs/supabase/A5-EXECUTION-LEDGER.md` e `docs/supabase/A5-MANUAL-RUNBOOK.md`; evidências em novo subdiretório datado de `docs/supabase/evidence/`.
**Interface:** consome branch QA `qa/a5-homologation-20261021`; produz registro `{sha, previewUrl, deploymentId, rootDirectory, executor, resultado}` sem credenciais.

- [ ] Comparar apenas alterações pendentes do checkout original com PR #21; preservar trabalho local e usar a ancestralidade remota real. Snapshot Git local desta sessão tem histórico sintético e não deve ser enviado como substituição da branch.
- [ ] Resolver o único pré-requisito de acesso: na conexão Vercel, habilitar equipe `mzinhoww-gmailcoms-projects` (`team_SOZVnHod91BcrmLMYmdmvB8k`) e projeto `newmemocuiaba` (`prj_IpHyqsnnbrXS213AGrOmxizb0Kjl`), com conta membro dessa equipe. O usuário já autorizou o link temporário; a tentativa retornou 403 em `lookup_deployment`, sem link. Retentar somente depois de mudança de acesso comprovada. Sem capacidade pelo conector, operador gera o preview no próprio painel autenticado.
- [ ] Confirmar Root Directory `web`, framework Next.js e SHA no deployment; gerar preview do candidato pela integração ou caminho manual documentado. Esperado: rotas da V2 funcionais, sem NOT_FOUND ou build da raiz legado. Não usar o preview antigo `ca7a274` como prova do código novo.
- [ ] Selecionar executor com checkout completo, Docker, Supabase CLI e navegador oficial do Playwright. Se esta sessão não oferece isso, executar no Mac já existente; registrar esse limite sem outra sequência de browsers alternativos.
- [ ] Registrar metadados e commit de documentação. Saída desta tarefa não significa GO; as tarefas locais independentes podem prosseguir enquanto o escopo Vercel é regularizado.

### Tarefa 2 — Fechar criação, personalização e convite

**Arquivos:** criação/tema da tabela acima; testes `web/e2e/flows.spec.ts` e `web/e2e/studio-local.spec.ts`; somente arquivos do defeito comprovado serão alterados.
**Interface:** consome `CreateWizard()` e `createViaWizard(page, options)` existentes; produz evento persistido e convite com código de oito caracteres, QR e tema limitado ao evento.

- [ ] Em `web/`, executar `npm ci` e `npx playwright install chromium`; depois `npm run e2e -- flows.spec.ts studio-local.spec.ts --trace retain-on-failure`. Esperado: todos os casos selecionados executados e aprovados, zero skips. Capturar trace/console da falha do primeiro passo se ela repetir; não atribuir o runner Chromium 153 ao produto sem reprodução.
- [ ] Para cada falha reproduzida, aplicar `systematic-debugging`, adicionar uma regressão com valor esperado independente, provar RED, corrigir o mínimo e provar GREEN. Preservar os testes de criação e restauração do tema; não aumentar timeout ou omitir teste para fabricar aprovação.
- [ ] No preview do candidato, organizador de homologação cria evento sintético, personaliza preset/paleta/fonte/mensagem/logo/capa/QR, salva/reabre e abre o convite em contexto separado. Esperado: valores persistidos, convite correto e nenhum tema vazando para outro evento/plataforma.
- [ ] Conferir o fluxo assistido: não anunciar pagamento confirmado, compra ou plano liberado sem integração real. Se a UI atual afirmar cobrança inexistente, criar teste de regressão de conteúdo e corrigir somente essa afirmação; não implementar checkout.
- [ ] Registrar cenário, SHA, resultado e evidência; commit das correções efetivamente necessárias.

### Tarefa 3 — Provar sessão, quatro papéis e backend

**Arquivos:** sessão/autorização e testes com servidor da tabela; criar `web/e2e/session.spec.ts`; incluir esse arquivo no `testMatch` de `web/playwright.supabase.config.ts`. Criar `web/src/proxy.ts` somente se a ausência de refresh SSR for a causa reproduzida de SCV-007, seguindo a API instalada do Next.js.
**Interface:** consome sessões de fixtures locais e os RPCs existentes `is_master()`/`admin_health()`; produz matriz Master/organizador/convidado/sem sessão, incluindo organizador B para isolamento.

- [ ] Na raiz, executar `supabase start` e `supabase test db`; em `web/`, configurar privadamente as três variáveis LOCAIS do runbook e executar `npm run test:integration`. Esperado: todos os testes executados e aprovados. Registrar totais atuais; não reaproveitar 430/430 ou 14/14 históricos. Nunca usar `ALLOW_REMOTE_TEST=1` no projeto compartilhado.
- [ ] Em `session.spec.ts`, criar casos locais `renova token vencido com refresh válido` e `refresh inválido encerra acesso protegido`: após a renovação `getUser().data.user.id` continua sendo o ator da fixture; após revogação o painel protegido não aparece e chamada administrativa é negada. Não aceitar simples presença de cookie como prova. Executar RED se houver bug, corrigir apenas a causa e reexecutar GREEN.
- [ ] Estender os testes existentes com acesso direto HTTP: organizador B e convidado não leem/escrevem evento A nem conseguem URL assinada para mídia privada A; `admin_health()` retorna MM004 para identidades sem concessão; claim Master sem concessão ativa não libera acesso. Fixar IDs das fixtures nos asserts, sem montar expected com a saída do código testado.
- [ ] Subir o app local e executar o comando E2E Supabase do runbook. Esperado: `master-studio`, `supabase` e `session` executados, zero skips. Auditar RLS/grants/RPCs/registro administrativo pelas suítes existentes, sem adulterar auditoria remota.
- [ ] Completar login Google real no preview em perfil autorizado; verificar backend, reload e renovação normal. Não revogar sessão real do operador nem reprovisionar Master. Registrar separadamente a prova Google e a prova de expiração local. Corrigir INF-004 após conferir dependência legada e validar ausência da variável somente por metadados.
- [ ] Commit e matriz atualizada; nenhuma simulação SQL ou sessão injetada substitui o login Google desta etapa.

### Tarefa 4 — Fechar mídia, revelação e aparelhos reais

**Arquivos:** estender `web/e2e/supabase.spec.ts`, `web/e2e/reveal.spec.ts` e `docs/supabase/A5-MANUAL-RUNBOOK.md`; corrigir `web/src/repositories/supabase/index.ts` ou os arquivos de mídia apontados pelo trace, somente quando houver reprodução.
**Interface:** consome evento/convite da tarefa 2 e isolamento da tarefa 3; produz prova de upload confirmado, quota no servidor, Storage privado e galeria liberada no horário.

- [ ] Fixar regressões locais: envio interrompido + retry resulta em uma foto pronta e uma unidade de quota consumida; quota 5 recusa a sexta foto; MIME falso e bytes acima do limite são recusados; cliente não marca sucesso antes da confirmação do servidor. Provar RED → correção mínima → GREEN quando a suíte expuser defeito.
- [ ] Fixar o cenário de fuso: evento em America/Cuiaba, cliente em outro fuso, instante anterior à revelação sem mídia liberada; após o instante do servidor, membro vê a foto e não membro continua negado. Executar `npm run e2e -- reveal.spec.ts` e a suíte Supabase local; usar relógio de teste somente no build local.
- [ ] No preview, usar evento sintético identificado com horário curto permitido e aguardar o cron real. Conferir convite/código inválido, QR, entrada, upload, câmera/fototeca, Storage privado, quota, galeria e download autorizado. Não rodar `remote-flow.spec.ts` com service_role no backend compartilhado: essa suíte cria/remove usuários e usa Email, hoje desabilitado.
- [ ] Executar uma jornada focada em iPhone/Safari e outra em Android/Chrome reais: QR, permissão aceita/negada, fototeca, rede interrompida, segundo plano/retorno e galeria após revelação. Registrar aparelho, SO/browser, SHA, horário, resultado e prova sem PII. Se não houver aparelhos, registrar PENDENTE e manter NO-GO de uso público.
- [ ] Commit das regressões/correções e anexar somente evidências sem sessão ou dados pessoais.

### Tarefa 5 — Cumprir o mínimo de privacidade já previsto em R2

**Arquivos:** criar `web/src/app/termos/page.tsx`, `web/src/app/privacidade/page.tsx`, `web/src/lib/consent.ts`, `web/src/lib/consent.test.ts`, `web/e2e/consent.spec.ts`; modificar `web/src/features/events/wizard.tsx` e `web/src/app/e/[code]/page.tsx`; migration gerada por `supabase migration new user_consents`, com o caminho retornado registrado no commit.
**Interface:** `ConsentInput = { termsVersion: string; privacyVersion: string; role: "organizador" | "convidado"; eventId: string | null }`; `recordConsent(input: ConsentInput): Promise<void>` em `consent.ts`, usando cliente Supabase existente. Backend deriva ator e horário, nunca aceita user_id do cliente.

- [ ] Consolidar textos existentes de COM-004 e retenção real, sem nova pesquisa de mercado. Registrar revisão jurídica prevista no backlog; texto gerado pelo agente não comprova essa revisão. Se o material revisado não estiver disponível, preparar páginas/fluxo e registrar exatamente a dependência para uso externo.
- [ ] Escrever testes: sem aceite não cria/entra; aceite confirmado grava versão de ambos os textos, papel, ator autenticado e horário do servidor; falha de gravação não mostra sucesso; outro usuário não altera nem lê aceites alheios. Executar os testes antes da implementação e registrar RED.
- [ ] Implementar páginas e aceite explícito no resumo do wizard/entrada do convidado. Criar tabela `user_consents` com RLS e RPC `record_consent(p_terms_version text, p_privacy_version text, p_role text, p_event_id uuid)`; versões válidas correspondem aos textos publicados. Validar papel/evento no servidor, impedir updates/deletes pelo cliente e auditar a inserção pelo padrão existente.
- [ ] Testar a migration na stack descartável e executar `npx vitest run src/lib/consent.test.ts`; incluir `consent.spec.ts` na configuração Supabase e executar esse fluxo local. Esperado: aceites persistidos e isolados, testes sem skips. Não aplicar migration ao compartilhado sem conferir projeto/destino e recuperação.
- [ ] Commit da implementação e revisão documentada; COM-004 só fica DONE com todos os critérios originais comprovados.

### Tarefa 6 — Garantir operação e recuperação mínimas

**Arquivos:** `supabase/functions/purge-storage/index.ts`, `web/src/lib/purge-worker.test.ts`, `supabase/ops/verify_purge_storage.sql`, `docs/supabase/A5-MANUAL-RUNBOOK.md`; criar `docs/supabase/OPERATIONAL-RECOVERY.md`.
**Interface:** handler existente retorna `{ok, removidos, falhas, restante}` com status 500 se `falhas > 0`; operação entrega backup/restauração isolada, saúde e procedimento de recuperação.

- [ ] Reexecutar `npx vitest run src/lib/purge-worker.test.ts` em `web/`; esperado: quatro testes atuais aprovados. A correção já existe na branch: não reimplementá-la. Publicar no ambiente de teste e injetar falha de Storage/baixa da fila apenas em destino descartável; esperado: HTTP 500, item preservado e retry posterior recupera sem apagar mídia alheia.
- [ ] Verificar jobs e respostas HTTP reais por leitura. Para o uso acompanhado, registrar Aurimar como operador, revisão de saúde ao abrir/encerrar evento e horária durante uploads; fila >7200 s, revelação vencida ou uploads travados exigem tratamento pelo runbook. SCV-009 continua aberto até alerta automático demonstrado.
- [ ] Localizar backup de banco E objetos; demonstrar restauração em destino isolado e leitura de um evento/foto sintéticos restaurados. Registrar frequência efetiva, último ponto recuperável e duração medida; não prometer RPO/RTO ainda não testados. Não publicar backups ou contratar PITR por pressuposto.
- [ ] Preservar QAV-004 aberto com inventário, sem limpeza. Confirmar por leitura que os resíduos não aparecem a usuários indevidos e não comprometem capacidade inicial. Definir retenção coerente com os jobs; operações irreversíveis não fazem parte deste plano.
- [ ] Commit do procedimento e evidências sanitizadas. Recuperação não demonstrada ou fila com falha sem responsável mantém NO-GO.

### Tarefa 7 — Emitir GO/NO-GO, disponibilizar e encerrar o corte

**Arquivos:** atualizar `docs/supabase/A5-HOMOLOGATION-REPORT.md`, os dois arquivos de `docs/handoff/`, `docs/backlog/backlog.json` e os documentos derivados pelo gerador existente.
**Interface:** consome evidências 1–6; produz `{sha, resultado: "GO" | "NO-GO", criterios, pendencias, rollback, url}` e lista priorizada da evolução, sem encerrar itens não provados.

- [ ] No candidato final, executar `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` em `web/`, `node --test supabase/ops/a5-readonly-probe.test.mjs` e `python3 docs/backlog/tools/backlog.py --next` na raiz. Executar o probe remoto em modo padrão somente leitura. Esperado: saída 0; registrar warnings, número real de testes e ambiente. Repetir apenas verificações afetadas por mudanças posteriores.
- [ ] Conferir os nove critérios da spec na mesma versão homologada, sem tokens em trace/relatório. Entregar GO operacional somente sem falha crítica e com aparelhos/recuperação/privacidade comprovados; caso contrário NO-GO com causa e intervenção exatas. Separar pendências originais de A adiadas neste novo corte; não afirmar “todos os pontos de A concluídos” enquanto existirem.
- [ ] Atualizar backlog preservando IDs, evidências e indentação original. Gerar derivados com `python3 docs/backlog/tools/backlog.py`; revisar diff e executar o validador. Nenhum DONE por mera existência de código. Commit do parecer e registrar a próxima ação única.
- [ ] Preparar SHA, URL candidata, configuração, backup verificado, deployment anterior e instrução de rollback. A autorização genérica de criação/execução não será usada para presumir promoção de produção; publicação aguarda a autorização específica vigente para essa versão. Não pedir aprovações técnicas adicionais.
- [ ] Quando a promoção estiver explicitamente autorizada, publicar o candidato homologado, conferir domínio/callback e executar smoke em evento sintético pela UI; registrar URL e SHA. Se houver falha crítica, executar rollback do deployment; nenhuma reversão destrutiva de banco. Entregar ao operador criação, convite, acompanhamento, suporte e recuperação.
- [ ] Após o encerramento formal de A, iniciar B → Codex → C na ordem: B integra o material existente e escolhe um lote de evolução; Codex recupera pipeline e primeiro canal; C executa piloto e valida preços/canal. Pagamentos, avatar e backlog inteiro não retroagem como condição da primeira versão operacional.

## Limite de esforço e auto-revisão do plano

Uma janela alvo de cinco dias úteis após disponibilidade de acesso, executor e aparelhos. Não é estimativa garantida para dependências externas ou falhas ainda não diagnosticadas. A cada entrega, informar resultado e próximo bloqueio; ao fim, emitir parecer, sem estender com funcionalidades novas.

Plano revisado contra os nove critérios da spec: criação (2), sessão/isolamento/backend (3), mídia e físicos (4), privacidade (5), recuperação/purga (6), versão/entrega (1 e 7). Os cinco riscos de Review Focus têm casos nas tarefas 3–4. Este commit altera planejamento e retomada; não representa execução das caixas acima nem muda o NO-GO atual.
