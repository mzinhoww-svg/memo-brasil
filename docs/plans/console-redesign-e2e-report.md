# Console redesign: E2E no navegador + evidências (Tarefa 8)

Branch `feat/console-redesign`. Navegador real (Playwright/Chromium) contra o app em modo Supabase apontando para o Supabase LOCAL isolado (wrapper `sb`, portas 564xx). Nada no remoto.

## Comandos (sem segredos)
- `.superpowers/sdd/2026-10-22-memoriesmt-product-production/sb db reset` e `sb test db`.
- URL e chaves de `sb status -o env`, passadas só por variáveis de ambiente de um wrapper fora do repositório (scratchpad): `NEXT_PUBLIC_MM_BACKEND=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_KEY`, `E2E_BASE_URL=http://127.0.0.1:3197`; sem `NEXT_PUBLIC_MM_DEV_TOOLS`/`TEST_CLOCK`.
- `npm run build` e `npx next start -p 3197 -H 127.0.0.1` (em `web/`).
- `npx playwright test -c playwright.supabase.config.ts` (suíte Supabase inteira) e `... e2e/master-console.spec.ts`.
- Capturas: `CONSOLE_EVIDENCE_DIR=<repo>/docs/evidence/console-20261024/depois npx playwright test -c playwright.supabase.config.ts e2e/master-console.spec.ts`.
- `npx playwright test` (config padrão, build em modo local).
- `npx tsc --noEmit`, `npx eslint <arquivos>`, `npx vitest run src/app/master src/features/master`.

## Resultados
- pgTAP: 12 arquivos, **1323 testes, PASS** (eram 1319; +4 do `is_test` na criação).
- Vitest console: 31 arquivos, **295 passando**. `tsc` e `eslint` limpos.
- Suíte Supabase (`-c playwright.supabase.config.ts`): **47 passaram, 6 pulados, 0 falhas** (inclui master-studio, master-payments, master-codes e master-console). A regex `testMatch` ganhou `master-codes` (antes não rodava nessa config) e `master-console`.
- Suíte padrão (`npx playwright test`, build em modo local com o fix do CSS): **110 passaram, 68 pulados, 0 falhas**.

### master-console.spec.ts (9 testes, todos passando)
Semeia com a service key: master; organizador com 3 eventos reais (`Real A`, `Real B`, `Lote`) e 2 `TESTE – excluir A/B`, criados pelo cliente do organizador (como no app); 3 convidados anônimos e uma linha de foto `pronta` (sem upload no Storage).
- Os dois `TESTE – excluir …` nascem `is_test=true`; os reais `false` (depois do fix 1).
- (a) Visão geral: "Ocultar testes" ligado por padrão; "Eventos ativos" na tela = `admin_overview(p_include_tests=false)`; desligado = `true`; diferença ≥ 2.
- (b) Eventos: Pill TESTE só nos testes, colunas Plano ("Grátis") e Ocupação (`2 / 30`, `0 / 10`); cabeçalho "Evento" gera `ord=title&dir=asc` com `aria-sort` e a ordem muda (asc e desc conferidos); clique na linha (fora do título) abre o drawer `?ev=` com Linha do tempo, Participantes (2) e Auditoria; Esc fecha e mantém filtros/ordenação.
- (c) Lote: "Marcar como teste" recusa sem justificativa, depois marca e audita `admin.set_test_flag` com papel `master`. "Excluir testes selecionados" com seleção mista lista só o teste, exige justificativa e o checkbox, faz soft delete (linha continua com `deleted_at`), some da lista padrão e aparece em "Excluídos"; o real selecionado fica com `deleted_at` nulo. RPC direta com evento real dá MM005 e não exclui nada.
- (d) Revelações: "Revelar agora" exige justificativa e confirmação; revela (`revealed_at`, `revelada`), some da lista, audita `admin.reveal_now` (motivo, `master`) e `reveal.released`.
- (e) Auditoria: chips Admin e Revelação filtram (`aria-current`, ações só da categoria); linha nova mostra "Master" e o alvo é link para `/master/eventos?ev=<id>` com o título; o link abre o drawer.
- (f) CSV: Eventos (`ID;Evento;Anfitrião;…;Teste`, segue o filtro da tela) e Auditoria (`Quando;Ação;Papel;Alvo;Evento;Justificativa;Sensível`).
- (g) Configurações: CNPJ inválido recusado (mensagem e banco inalterado), sem motivo recusado, válido salvo como `11.222.333/0001-81` com status "Salvo e registrado na auditoria."; cartão "Ambiente de pagamentos" sem nenhum controle. O valor anterior de `company_cnpj` é restaurado no `afterAll`.
- (h) ⌘K (Ctrl/Meta+K) acha `Real B` pelo nome; Enter navega para `?ev=` e abre o drawer.
- (i) As 15 rotas: 200, `h1`, sem "Não foi possível carregar", sem aviso de modo degradado, e em 400 px `scrollWidth <= innerWidth`.

### master-studio / master-payments / master-codes
- master-studio: o menu agora é conferido como 4 listas rotuladas pelos `h2` (Operação 4, Pessoas 4, Receita 3, Plataforma 4), 15 links no total e o conjunto exato de rotas. As asserções de autorização ficaram intactas.
- master-payments e master-codes passaram sem mudança (as páginas preservaram rótulos, diálogos e ações).

## Bugs achados e corrigidos
1. **`a1ecc6c` fix(db)**: eventos novos com título de teste não ganhavam `is_test` (o backfill só rodava na migration), então "TESTE …" criados depois entrariam nos números. `is_test_guard` aplica a mesma regra de título no INSERT (cliente e servidor); renomear não marca; cliente continua sem poder ligar/desligar à mão. pgTAP +4. No mesmo commit: o teste "falhas consecutivas" de `12_console` falhava de forma intermitente porque o pg_cron local roda `mm-reveal-due` a cada minuto e a corrida real ficava mais nova que as simuladas; o teste apaga as corridas reais dentro da transação.
2. **`20a743c` fix(web)**: no build de produção **nenhum CSS Module era aplicado** (todas as `page.module.css` do redesign). A regra turbopack `"*.css"` com `as: "*.css"` (Tailwind) reclassificava `*.module.css` como CSS global; o objeto importado chegava vazio. Efeito visto nas capturas: KPIs empilhados, cartões da Visão geral sem borda, listas sem layout. A regra agora tem `condition: { not: { path: /\.module\.css$/ } }`; as classes saem com hash. Isso atinge o preview Vercel do mesmo jeito.
3. **`0595599`** test(e2e) + capturas.

## Evidências
`docs/evidence/console-20261024/depois/`: `<rota>-1280.png` (página inteira) e `<rota>-400.png` das 15 rotas (`visao-geral`, `eventos`, …), com testes ocultos; `eventos-drawer-1280.png`, `eventos-drawer-400.png`, `busca-cmdk-1280.png`, `busca-cmdk-400.png`. Os dados são os semeados pelos testes (vários `Real/Lote <tag>`).

## Pendências
- KPI "Receita 30 dias" quebra `R$ 0,00` em duas linhas a 1280 px (coluna de 220 px com o valor grande). Cosmético; não alterado.
- "Eventos que pedem atenção" na Visão geral e "Próximas revelações" ficam cheios de eventos de execuções anteriores do E2E (dados locais acumulados); só reflete o banco local.
- Drawer mostra "Plano Grátis, convidados 10" enquanto o evento tem `capacity` 30: o teste mexe em `capacity` direto pelo service role, sem passar pelo direito. Não é bug do console.
- Tamanho das capturas: 34 PNGs; se pesar no PR, dá para converter para JPEG como em `antes/`.
- A mudança na migration `20261024000100` ainda não foi aplicada no remoto (operador, `supabase db push`).
