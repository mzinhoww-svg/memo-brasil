# Console redesign: fundação de UI (Task 2)

Testes: 78 passando (58 em `web/src/features/master/*.test.ts`, 20 em `web/src/app/master/kit/kit.test.tsx`). `tsc --noEmit` e `eslint` limpos. Nada commitado.

## data.ts (`web/src/app/master/data.ts`)
- `Load<T>` = `{state:"ok"; data:T; degraded?:boolean} | {state:"denied"} | {state:"error"; message}`
- `rpcOr<T>(sb, name, args, fallback:{name; args?; map?:(data:unknown)=>T}): Promise<Load<T>>`. Erro "função inexistente" (PGRST202, 42883, /could not find the function/i) chama o fallback e devolve `degraded:true`; outros erros seguem a regra de `rpc` (denied/error).
- Reexporta de `@/features/master/params`: `includeTests(sp)`, `periodDays(sp)`, `isMissingRpc`, tipos `Period`, `SearchParams`. (Ficam em arquivo puro porque `data.ts` importa `server-only` e não roda no vitest.)
- Mantidos: `requireMaster`, `rpc`, `num`, `bytes`, `when`, `window`.

## features/master (puro)
- `params.ts`: `includeTests(sp): boolean` (só `testes=1`), `periodDays(sp): 7|30|90` (lê `dias`, depois `periodo`; padrão 30), `PERIODS`, `isMissingRpc(error)`, `SearchParams`.
- `risk.ts`: `eventRisk(ev: RiskEvent, now:number(ms), catalogCapacities:number[]): {score, signals:{code,severity,label}[]}`; `sortByRisk(items, riskOf:(item)=>Risk)`. `RiskEvent = {status, revealState?, revealAt?, participants, capacity?, hostName?, hostId?}`. Pesos crit 40, warn 15, info 5 (máx. 100).
- `plan.ts`: `planLabel(capacity, planCode, catalog: CatalogPlan[])` (código, depois capacidade, senão `manual (N)`, nulo vira "sem plano"); `pricePerGuestCents({capacity, priceCents})`. `CatalogPlan = {code,name,capacity,priceCents}`.
- `cron.ts`: `humanCron(expr)`, `nextRun(expr, from: Date): Date|null` (UTC; formas `* */n n` em minuto/hora, resto `* * *`).
- `csv.ts`: `toCsv(rows, cols:{key,label}[])` (BOM, `;`, CRLF, aspas, apóstrofo em texto iniciado por `= + - @ \t \r`; números negativos reais intactos). `CsvCol<R>`.
- `format.ts`: `num`, `brl(cents)`, `bytes`, `pct(part,total,digits=0)` ("—" se total 0), `countdown(target: number|string|Date, now:number)` ("em 1 dia e 11 h", "há 2 h e 5 min", "agora").

## kit (`web/src/app/master/kit/*`, importar do arquivo de cada componente)
- `url.ts`: `hrefWith(path, currentParams, patch)` (valor falsy remove a chave; remove `p` salvo se estiver no patch), `parseSort(sp, allowed, fallback)`, `sortRows(rows, ord, dir)`, `SortDir`.
- `Pill.tsx`: `<Pill tone="ok|warn|crit|info|dim">`.
- `Kpi.tsx`: `<Kpi label value(string formatada) current? previous? lowerIsBetter? spark? note? />`, `deltaOf(current, previous, lowerIsBetter?)`, `Sparkline`. Delta "+12%" / "-8%" / "novo" / "0%", `data-tone=ok|crit|dim`.
- `BarLineChart.tsx`: `<BarLineChart title data={{label,a,b,line}[]} names={{a,b,line}} summary? />` (eixo único; role=img + aria-label + tabela `.adm-sr`).
- `Funnel.tsx`: `<Funnel steps={{label,value}[]} />`.
- `StackBar.tsx`: `<StackBar segments={{label,value,color?}[]} format? label? />`.
- `Meter.tsx`: `<Meter label value max tone? valueText? />` (>=80% warn, >=95% crit).
- `AlertBar.tsx`: `<AlertBar alerts={{id?,severity:"crit|warn|info",title,text?,href,cta}[]} />` (vazio renderiza nada).
- `Drawer.tsx` (client): `<Drawer title closeHref>children</Drawer>`. A página renderiza só quando `?ev=<id>` existe e passa `closeHref = hrefWith(path, params, {ev:null})`. Esc, "Fechar" e fundo navegam para `closeHref`; trap de foco e devolução do foco.
- `CsvButton.tsx` (client): `<CsvButton filename rows cols label? />` (Blob no navegador; desabilitado sem linhas). Passar só linhas já filtradas/mascaradas no servidor.
- `TestToggle.tsx`: `<TestToggle path params />`, link `role="switch"` "Ocultar testes", `aria-checked=true` quando `testes` ausente.
- `PeriodTabs.tsx`: `<PeriodTabs path params />`, usa `?dias=` (mesmo parâmetro da página atual).
- `EmptyState.tsx`: `<EmptyState title text? action?={{href,label}} />`.
- `SortableTable.tsx`: `<SortableTable cols={{key,label,num?,sortable?,render?}[]} rows path params ord? dir? empty={{title,text?,action?}} rowKey? caption? />`. Só gera os links `?ord=&dir=`; quem chama ordena (RPC `p_sort/p_dir` ou `sortRows`).

## CSS (`web/src/styles/admin.css`)
Tokens novos `--ok --warn --crit --info` (claro em `:root`, escuro em `[data-theme="noite"]`), séries `--adm-s1..s5`, `--adm-grade`; classes `.adm-pill .adm-kpi* .adm-spark .adm-chart .adm-legend .adm-swatch .adm-svg .adm-funnel* .adm-stack .adm-meter* .adm-alertbar .adm-drawer* .adm-btn .adm-tabs .adm-th .adm-sortable .adm-sr .adm-aviso-degradado`. Lima da marca não foi alterado (os tokens do tema não têm lima; não mexi neles).

## O que os construtores de página precisam saber
- Páginas passam `searchParams` (já `await`ado) direto como `params`; os helpers aceitam `string|string[]|undefined`.
- Aviso de modo degradado: renderizar `<p className="adm-aviso-degradado">Dados completos após a atualização do banco.</p>` quando `load.degraded`.
- Ao usar `rpcOr`, o `map` do fallback deve normalizar o formato antigo para o novo; filtros de teste só têm efeito com a RPC nova.
- `hrefWith` zera `p` em toda mudança de filtro/período/ordenação.
- Não tocados: páginas, MasterNav, layout, migrations. O `.adm-btn[aria-checked="true"]` usa o estilo invertido (tinta/fundo) para o estado "ligado" do TestToggle.
- Não verifiquei contraste/layout no navegador (sem build/Playwright por restrição); cores semânticas escuras escolhidas para AA sobre `#141211`.
