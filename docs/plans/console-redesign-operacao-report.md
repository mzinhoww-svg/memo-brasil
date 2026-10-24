# Console redesign: Operação (Tarefa 4)

Testes: 45 novos passando em 6 arquivos (`eventos/lib`, `eventos/EventsTable`, `visao/lib`, `visao/sections`, `revelacoes/lib`, `saude/lib`); suíte `src/app/master` + `src/features/master` inteira verde. `tsc --noEmit` e `eslint` limpos nas pastas. Sem build nem Playwright; nada commitado. Layout em 400 px e contraste não verificados no navegador.

## Arquivos
- `web/src/app/master/page.tsx` (Visão geral) + `web/src/app/master/visao/{lib.ts, lib.test.ts, sections.tsx, sections.test.tsx, page.module.css}`
- `web/src/app/master/eventos/{page.tsx, lib.ts, lib.test.ts, EventsTable.tsx, EventsTable.test.tsx, EventDrawerBody.tsx, actions.ts, page.module.css}`
- `web/src/app/master/revelacoes/{page.tsx, lib.ts, lib.test.ts, RevealNowButton.tsx, actions.ts, page.module.css}`
- `web/src/app/master/saude/{page.tsx, lib.ts, lib.test.ts, page.module.css}`

## Decisões
- **Visão geral:** 4 KPIs (`Kpi` com sparkline e delta); receita nula mostra "Só master". Gráfico diário (fotos e entradas em barras, eventos criados em linha), funil, próximas revelações com contagem regressiva, mapa de rotinas (`jobs[].ok`), composição do storage (originais, derivados, órfãos), card "Pronto para produção" (some com os 6 itens ok) e "Eventos que pedem atenção" (`risk.ts` sobre os 100 eventos mais recentes, catálogo 10/30/100/250/500, até 10 itens). `TestToggle` (padrão ocultar) e `PeriodTabs` 7/30/90 no cabeçalho.
- **Eventos:** RPC `admin_list_events_v2` com `p_sort/p_dir` (os cabeçalhos geram `?ord=&dir=`), paginação de 25, busca, filtro de situação (inclui "Excluídos" só com a RPC nova). Colunas Plano (`planLabel` com catálogo de `admin_list_plans`, ou "manual (N)") e Ocupação (`Meter`). Pill TESTE. A linha inteira abre o drawer (`?ev=`); o título também é link, para teclado. O drawer usa `admin_event_detail`: dados, plano e direito, linha do tempo, participantes, pedidos e auditoria.
- **Lote:** server actions em `eventos/actions.ts`. Cada uma reconfere `masterAccess`, valida ids (uuid, até 500) e motivo (10 a 500), chama a RPC e roda `revalidatePath('/master','layout')`. A seleção vale para qualquer linha, porque "Marcar como teste" precisa selecionar eventos reais. Já "Excluir testes selecionados" só envia os `isTest` não excluídos: o botão fica desabilitado sem nenhum deles, e a confirmação lista os afetados e exige justificativa e checkbox. O banco ainda recusa o lote inteiro se houver evento que não é de teste.
- **Nome do anfitrião:** `cleanHostName` (testado) é aplicado nos dois caminhos e nos participantes do drawer. Ele corrige "Aurimar NogueiraAurimar" para "Aurimar Nogueira", e também "Ana SilvaAna Silva" e "Ana Silva Ana Silva". Nomes legítimos (McDonald, Maria Maria, DeAndre) ficam intactos.
- **Revelações:** atrasadas primeiro, com Pill crit e a mais antiga no topo. Depois as próximas, agrupadas por dia (America/Cuiaba), com hora e contagem regressiva. A fonte é a v2, ordenada por `revealAt desc`, limite 100. "Revelar agora" pede justificativa e checkbox de confirmação e chama `admin_reveal_now` pela server action (MM008 vira "já revelado").
- **Saúde:** cards de `admin_health` mantidos. Cada rotina mostra a agenda legível (`humanCron`), a próxima execução (`nextRun`), a última execução com duração e as últimas 24 execuções em quadrados (da mais antiga à mais recente, com tooltip). Alerta crítico com 2 ou mais falhas seguidas em rotina ativa. Os `healthAlerts` existentes continuam (sem duplicar o da rotina) e `data-testid="alerta-saude"` foi mantido.
- CSV em toda tabela ou lista (eventos, atenção, revelações, rotinas). CSS só em `page.module.css` locais. Nada foi alterado em kit, `features/master`, layout ou `admin.css`.

## Sem a migration (modo degradado: aviso "Dados completos após a atualização do banco.")
- **Visão geral:** só os 3 KPIs de `admin_dashboard_metrics`, com testes incluídos, sem delta nem sparkline. A receita mostra "Só master". Ficam ocultos o gráfico, o funil, as revelações, as rotinas, o storage e a prontidão. A tabela de atenção usa `admin_list_events` e não tem TESTE.
- **Eventos:** a ordenação vale só para a página atual (em memória). Não há opção "Excluídos", Pill TESTE, seleção nem ações em lote. O drawer mostra só dados e plano, achados nos 100 eventos mais recentes.
- **Revelações:** lista de `admin_list_events` (100 mais recentes) sem o botão "Revelar agora". O toggle de testes não tem efeito.
- **Saúde:** só a última execução, sem duração. O alerta de 2 falhas seguidas não dispara (os `healthAlerts` cobrem a última falha).

## Pendências
- **Aceite "com testes, números iguais ao console atual":** `admin_overview` conta o período a partir da meia-noite local (hoje menos dias menos 1), e `admin_dashboard_metrics` conta a partir de agora menos dias. Na borda do período podem aparecer diferenças pequenas em Participantes e Fotos. Conferir no preview depois do `db push`. Eventos ativos deve bater exatamente.
- **Revelações:** com mais de 100 eventos e revelação muito antiga atrasada fora do topo, a lista pode omiti-la. O alerta do shell continua contando certo.
- **Kit (sugestão, implementada localmente):** a linha clicável, a seleção em lote e a confirmação com checkbox ficaram em `EventsTable`, porque `SortableTable` não aceita `onClick`/seleção. O mesmo vale para os quadrados de rotina (`saude`, `visao`).
- **Ações exigem `is_master()`** no banco: support e auditor recebem "Sem permissão para esta ação". Hoje o gate do console já admite só master.
