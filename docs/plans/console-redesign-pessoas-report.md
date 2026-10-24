# Console redesign: frente Pessoas (Usuários, Organizadores, Participantes e convites, LGPD)

Testes: 25 novos (4 arquivos `lib.test.ts`), todos passando. `tsc --noEmit` e `eslint` limpos. Sem build, sem Playwright, sem commit. Layout em 400 px e contraste não verificados no navegador.

## Arquivos (`web/src/app/master/`)
- `usuarios/`: `page.tsx`, `lib.ts` (+test), `Pager.tsx` (paginação por links, reutilizada por Organizadores), `page.module.css`.
- `organizadores/`: `page.tsx`, `lib.ts` (+test: `aggregateByHost`, `mergeOrganizers`, `topPlan`, `collectPages`), `events.ts` (server-only; carrega eventos v2 com fallback, reutilizado por Participantes), `page.module.css`.
- `participantes/`: `page.tsx`, `lib.ts` (+test: `groupByEvent`, `visibleColumns`, `excludeTestEvents`, `inviteStats`), `page.module.css`.
- `lgpd/`: `page.tsx`, `lib.ts` (+test: `slaOf`, `sortBySla`, `monthlyHistory`), `page.module.css`.

## Decisões
- Usuários: `admin_list_users_v2` (50 por página, `?tipo=google|email|anon`, `?q=` como busca por e-mail/ID, `?p=`). StackBar Google/E-mail/Anônimo, aviso de órfãs, linha de órfã realçada com Pill "órfã", CSV da página atual.
- Organizadores: junta `admin_list_organizers` (todas as páginas, teto 1000) com `admin_list_events_v2` (teto 1000 eventos) e `admin_list_payments` (500 pedidos; negado para não master vira "Só master"). Receita = pedidos `pago` dos eventos do anfitrião. Mini funil: criados, com convidados, com fotos, revelados (barras + texto + aria-label). Sem evento visível e sem testes, o organizador some da lista.
- Participantes: agrupados por evento em `<details>` (o maior abre aberto). Coluna Mesa (e Expira nos convites) some quando 100% vazia. Taxa convite para entrada = convites com ao menos um uso sobre o total (mais soma de entradas). Estado vazio explicado para convites. Eventos de teste saem via `isTest` de `admin_list_events_v2`.
- LGPD: Meter por solicitação (dias usados de 15; aviso a partir de 80%, crítico ao estourar; processada fora do prazo também crítica), atrasadas primeiro e com fundo realçado, histórico mensal (fuso America/Cuiaba, meses vazios preenchidos) com BarLineChart e CSV de solicitações e do histórico.

## Degradado sem a migration (`db push`)
- Usuários: busca RPC antiga com 200 contas e filtros de tipo/busca/paginação em memória; some "Eventos vinculados", "Situação" e a contagem de órfãs; toggle de testes sem efeito.
- Organizadores: eventos pela RPC antiga, sem plano mais usado ("—") e sem filtro de testes.
- Participantes: eventos de teste não são filtrados.
- LGPD: não depende das RPCs novas.

## Pendências
- Layout 400 px, foco e contraste a conferir no E2E/preview.
- Receita por organizador usa só os 500 pedidos mais recentes de `admin_list_payments`; acima disso fica subestimada. Truncamento de eventos (mais de 1000) é avisado na página.
- Mesma busca `?q=` de Usuários envia ao v2 como `p_search` (aceita ID exato, nome e, para master, e-mail).
- Usuários não tem ordenação por coluna (não pedida).
