# Console redesign: shell (Task 3)

Testes: 41 novos passando (22 em `web/src/features/master/alerts.test.ts`, 19 em `web/src/app/master/shell/shell.test.tsx`); escopo `src/app/master` + `src/features/master` com 146 passando. `tsc --noEmit` e `eslint` limpos. Nada commitado. Sem build nem Playwright (restrição da árvore compartilhada); layout em 400 px e contraste não verificados no navegador.

## Arquivos
- `web/src/app/master/modules.ts`: `GROUPS` (Operação, Pessoas, Receita, Plataforma; `{id, rotulo, modules:{rota, rotulo}[]}`), `MODULES` plano derivado (mesma forma `{rota, rotulo}`), `moduleHref(rota)`, tipos `ModuleGroup`, `ModuleItem`, `ModuleRoute`. Rótulos novos: "Participantes e convites", "Códigos de cortesia", "Auditoria". Rotas iguais.
- `web/src/app/master/MasterNav.tsx` (client): `<MasterNav badges? />`, `NavBadges = Partial<Record<rota, NavBadge>>` (chave = slug da rota; Visão geral usa `"visao-geral"`). `<nav aria-label="Módulos do console">`, `h2` por grupo como rótulo da `ul` (`aria-labelledby`), `aria-current="page"` (rota exata ou subrota). Até 980 px: botão "Menu"/"Fechar menu" com `aria-expanded`/`aria-controls`; Esc fecha e devolve o foco; clicar num link fecha.
- `web/src/app/master/shell/params.ts`: `withShellParams(href, searchParams)`, `SHELL_PARAMS = ["testes","dias"]`.
- `web/src/app/master/shell/load.ts` (server-only): `loadShell(sb): Promise<{alerts, badges, degraded}>`, com `cache` do React (uma vez por requisição).
- `web/src/features/master/alerts.ts` (puro): `shellFromSignals(signals)`, `signalsFromOverview(data)`, `signalsFromLegacy({metrics,lgpd,health,payments,settings})`, `missingSettings(values)`, tipos `ShellSignals`, `ShellAlert` (mesma forma do `AlertItem` do kit), `NavBadge {value, severity: ok|warn|crit|info|dim, label?}`, `SETTING_KEYS`.
- `web/src/app/master/shell/CommandSearch.tsx` (client): `<CommandSearch />`, `DEBOUNCE_MS = 200`.
- `web/src/app/master/shell/search.ts` (puro): `SearchResults`, `normalizeSearch`, `eventsFromList`, `eventHref`, `userHref`, `orderHref`, `SEARCH_MIN = 2`, `SEARCH_MAX = 80`, `SEARCH_LIMIT = 5`.
- `web/src/app/master/busca/route.ts`: `GET /master/busca?q=`.
- `web/src/app/master/layout.tsx`: gates intactos; com acesso `ok` renderiza menu em grupos com badges, linha do topo (`MasterCrumbs` + botão de busca) e `AlertBar` acima do conteúdo.
- `web/src/styles/admin.css`: só adições `.adm-nav-*`, `.adm-topline`, `.adm-search-trigger`, `.adm-kbd`, `.adm-cmd*` e o bloco `@media (max-width: 980px)`.
- `web/src/app/master/codes.test.ts`: a expectativa do rótulo mudou para "Códigos de cortesia" (fora da lista de arquivos, mas é consumidor de `MODULES`).

## Alertas e badges
| Sinal | Alerta (href) | Badge |
| --- | --- | --- |
| Revelação atrasada | crit "N revelações atrasadas" (`/master/revelacoes`) | `revelacoes` = pendentes, `warn` com atraso, `dim` sem |
| Rotina falhando | crit "N rotinas falhando" com nomes (`/master/saude`) | `saude` = "ok N/N" (`ok`) ou nº de falhas (`crit`) |
| LGPD | atrasada crit; só pendente info (`/master/lgpd`) | `lgpd` = pendentes, `crit` com atraso, senão `info` |
| Divergência de pagamento | crit (`/master/pagamentos`) | `pagamentos` vira `crit` |
| Ambiente de pagamento | sandbox warn, desligado info, produção sem alerta; texto mostra o valor exato | `pagamentos` = "off"/"sandbox"/"prod" (`info`/`warn`/`ok`) |
| Dados da empresa | warn "Dados da empresa incompletos", "Faltam N: CNPJ, ..." (`/master/configuracoes`) | `configuracoes` = nº faltando (`warn`) |

Ordem: crit, warn, info.

## Suposições sobre as RPCs
- `admin_overview`: uso `alerts.{pendingReveals, overdueReveals, lgpdPending, lgpdOverdue, paymentDivergences}`, `readiness.{companyCnpj, companyLegalName, supportEmail, supportPhone}` como booleano "preenchido" (só `true` conta), `readiness.paymentsEnv` e `jobs[].{name, ok}` (falha = `ok === false`; total = `jobs.length`). `alerts.settingsMissing` e `alerts.failingJobs` não são lidos: a lista sai de `readiness` e de `jobs`.
- Fallback (sem `admin_overview`, `degraded: true`), tudo só leitura: `admin_dashboard_metrics()` (padrão 30 dias, `reveals.{pending,overdue}`), `admin_lgpd_requests(p_limit 1)` (`summary.{pending,overdue}`), `admin_health()` (rotinas ativas; falha = `lastRun.status === "failed"`; `cronAvailable=false` não gera badge), `admin_payments_summary()` (`env`, `divergences`), `get_public_settings()` (chaves `company_*`/`support_*`; ausente = não é texto preenchido; e `payments_env` se o resumo falhar). Nenhuma mutação, nada de `payments_env` escrito.
- `admin_search(p_q)` → `{events:[{id,title}], users:[{userId,email}], orders:[{id,eventId,status}]}`. Se ela não existir (`isMissingRpc`), a rota usa `admin_list_events(p_limit 5, p_search)` e devolve `users`/`orders` vazios com `degraded: true`. A rota reconfere `masterAccess()` (403 se não for `ok`), corta o termo em 80 caracteres, exige 2 e responde `Cache-Control: no-store`.

## Para quem constrói páginas
- Toggle e período persistem: o menu já repassa `testes` e `dias` da URL atual. Na página, use `TestToggle`/`PeriodTabs` com `params = await searchParams`. Para links internos entre módulos dentro da página, use `withShellParams("/master/eventos", params)` (aceita o objeto `searchParams` ou `useSearchParams()`). `hrefWith` continua sendo o helper para filtros da própria página.
- Resultados da busca chegam como `/master/eventos?ev=<id>`, `/master/usuarios?q=<id>` (userId) e `/master/pagamentos?q=<id>` (id do pedido), com `testes`/`dias` anexados. Eventos devem abrir o `Drawer` com `?ev=`; Usuários e Pagamentos devem aceitar `?q=` como busca por ID.
- O layout é preservado em navegação suave: alertas e badges são da carga inicial (ou de `router.refresh()`). Depois de uma ação que muda contagens (revelar agora, responder LGPD, salvar configurações), chame `router.refresh()` ou `revalidatePath("/master", "layout")` para atualizar a barra.
- Não renderize outra `AlertBar` de shell na página; alertas específicos da página continuam livres. O `h1` da página é o primeiro título do `main` (os `h2` dos grupos ficam no `aside`).
- No modo degradado o shell usa `admin_dashboard_metrics`, que soma o storage; se pesar, a migration com `admin_overview` resolve.
