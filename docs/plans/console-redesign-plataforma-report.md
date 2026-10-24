# Console redesign: frente Plataforma (Analytics, Storage, Auditoria, Configurações)

Testes: 65 novos passando em 7 arquivos (analytics 18 + 4, storage 10, auditoria 9, configurações 14 + 7 + 3). Escopo `src/app/master` + `src/features/master`: 31 arquivos, 295 passando. `tsc --noEmit` e `eslint` limpos. Nada commitado. Sem build nem Playwright, como pede o brief. Layout em 400 px e contraste não foram vistos no navegador.

## Arquivos (todos em `web/src/app/master/`)
- `analytics/lib.ts`: normaliza as séries nova e antiga (`fromOverview`, `fromLegacy`), `splitPeriods`, `total`, `cumulative`, `metricOf`, e as coortes (`localDay`, `weekStart`, `lastWeeks`, `cohortWeeks`, `cohortRange`, `cohorts`, `cohortEvent`, `weekLabel`). Testes em `lib.test.ts`.
- `analytics/charts.tsx` e `charts.module.css`: gráficos locais `Bars` (uma série) e `Lines` (1 a 3 séries, tracejado opcional). SVG, eixo único, séries `--adm-s*`, tooltip `<title>` com área de toque do tamanho da faixa do dia, legenda a partir de 2 séries, tabela `.adm-sr`. Ficam aqui porque o kit não pode ser editado, e o Storage também os usa. Sugestão: levar para o `kit/`. Testes em `charts.test.tsx`.
- `analytics/page.tsx` e `page.module.css`.
- `storage/lib.ts`: `QUOTA_BYTES` = 1 GiB (constante documentada do plano gratuito), `fromBreakdown`, `fromLegacyMetrics`, `cumulativeGrowth`, `daysToQuota`, `segments`. Testes em `lib.test.ts`. Também `page.tsx` e `page.module.css`.
- `auditoria/lib.ts`: `CATEGORIES` (mesmos prefixos de `audit_category_pattern`, com um prefixo `legacy`), `categoryOf`, `actionCategory`, `legacyIsPartial`, `isSensitive` (espelha o `sensitive` da v2), `roleLabel`, `groupByDay`, `dayLabel`, `targetEvent`, `targetText`. Testes em `lib.test.ts`. Também `page.tsx` e `page.module.css`.
- `configuracoes/validate.ts`: código puro, roda no navegador e no servidor.
  - Campos: `COMPANY_FIELDS`, `EDITABLE_KEYS`, `READ_ONLY_KEYS=["payments_env"]`, `isEditableKey`.
  - Validação: `isValidCnpj` (numérico e alfanumérico, IN RFB 2.229/2024), `formatCnpj`, `isValidEmail`, `formatPhone`, `validateSetting`.
  - Textos: `settingText`, `settingNote`, `flagDescription`.
  - Testes em `validate.test.ts`.
- `configuracoes/actions.ts` (`"use server"`): `saveCompanySetting`.
  - Antes de chamar o banco, confere a chave (fora da lista ou `payments_env` é recusada), o valor e o motivo (`reasonError`: 10 a 500 caracteres) e o `masterAccess()`.
  - Depois chama `admin_set_setting(p_key, p_value, p_reason)` e `revalidatePath('/master','layout')`.
  - Testes em `actions.test.ts`.
- `configuracoes/CompanyField.tsx` (client): formulário por campo com `useActionState`. Valida no navegador, motivo obrigatório. Testes em `CompanyField.test.tsx`.
- `configuracoes/page.tsx` e `page.module.css`.

## Decisões
- **Analytics.**
  - Uma chamada `admin_overview(p_days = 2N)` dá a série dos dois períodos. A metade recente é o período atual e a outra, o anterior de mesmo tamanho.
  - O funil vem de uma segunda chamada, `admin_overview(N)`, porque o funil do overview vale para o período pedido.
  - KPIs: fotos, entradas e eventos criados, com delta e sparkline.
  - Abas de métrica (`?m=`) controlam os dois gráficos:
    - barras diárias;
    - acumulado atual (linha cheia) contra anterior (tracejada).
  - Coortes:
    - semanas de segunda a domingo no fuso de Cuiabá;
    - 2, 5 ou 13 semanas conforme o período;
    - cada semana mostra criados, com participante (`participants > 0`) e com foto (`photos > 0`), com percentual;
    - os dados vêm de `admin_list_events_v2` (ordenado por `createdAt desc`, até 10 páginas de 100). Se truncar, a página avisa.
  - CSV da série e das coortes.
- **Storage.**
  - Medidor de uso contra 1 GB, marcado como estimativa, com a previsão "a cota acaba em cerca de N dias" pelo ritmo de 30 dias.
  - Média por foto, órfãos com Pill, barra empilhada original/derivado/órfão/identidade, curva acumulada de 30 dias (total de hoje menos o que entrou depois de cada dia) e tabela com CSV.
  - Só leitura. Saíram os cartões "uploads com falha/em andamento" da página antiga: eram dados de `admin_dashboard_metrics`, não de storage.
- **Auditoria.**
  - Chips Todas / Participante / Consentimento / Revelação / Admin / Pagamento (`?cat=`).
  - O filtro livre "Ação começa com" (`?a=`) continua e usa `admin_list_audit`. Os dois filtros são exclusivos.
  - A lista vem agrupada por dia local, numa única tabela com linha de dia.
  - Linhas sensíveis ganham fundo de aviso e a Pill "sensível". O resumo conta as sensíveis da página.
  - O alvo vira link para `/master/eventos?ev=<id>` (com `withShellParams`) quando é evento ou quando a linha tem `eventId`. Mostra o título do evento se houver; senão, o id encurtado.
  - Papéis aparecem em português: Sistema, Organizador, Convidado, Master, Suporte, Auditor, Operador.
  - Paginação mantida. CSV da página.
  - Sem TestToggle e PeriodTabs: as RPCs de auditoria não filtram por teste nem por período.
- **Configurações.**
  - Cartão "Cadastro da empresa" com "N de 4 preenchidos". O campo que falta tem borda e fundo de aviso, a Pill "falta" e o botão "Preencher"; os outros, "Editar".
  - Valores gravados como string jsonb normalizada (é o formato que `get_public_settings` lê):
    - CNPJ: `00.000.000/0000-00`;
    - telefone: `(DD) NNNNN-NNNN` ou `0800 NNN NNNN`;
    - razão social: espaços compactados.
  - `payments_env` aparece só leitura, num cartão próprio com a nota "Alterado só pelo procedimento de pagamentos". Não é chave editável no cliente nem na action.
  - "Outros parâmetros" (ex.: `capacity_grace_pct`) aparecem só leitura, com descrição.
  - Feature flags continuam só leitura, como antes. A lista tem estado e descrição (texto conhecido, `rollout.description`/`percent`, ou "Sem descrição cadastrada"). As duas tabelas têm CSV.

## O que fica degradado sem a migration `20261024000100`
- **Analytics.**
  - Usa `admin_dashboard_metrics(window(2N))` e mostra o aviso padrão.
  - O filtro de testes não tem efeito.
  - O funil é trocado por um EmptyState que explica o motivo.
  - As coortes vêm de `admin_list_events` e incluem eventos de teste, com aviso.
- **Storage.**
  - Usa `admin_dashboard_metrics`. As fotos aparecem numa só classe, "Fotos (sem classificação)", ao lado de Identidade.
  - A média é estimada (bytes de fotos / fotos prontas, o que inclui miniaturas).
  - Sem órfãos e sem curva.
- **Auditoria.**
  - Os chips usam `admin_list_audit` com o prefixo principal (`participant.`, `consent.`, `reveal.`, `admin.`, `payment.`). Quando a categoria tem mais prefixos, o aviso diz que o filtro está parcial.
  - `sensitive` é calculado no cliente com a mesma regra.
  - Sem título do evento.
  - O papel fica como está gravado na linha (antigas podem estar vazias).
- **Configurações.** Não depende da migration.

## Pendências
- Ver no navegador (1280/400, tema escuro): faixa de hover dos gráficos, rolagem das tabelas, contraste do fundo de aviso.
- `charts.tsx` é candidato ao `kit/`.
- `FLAG_NOTES` está vazio porque não há flags no banco nem consumidores no código. Preencher quando surgirem.
