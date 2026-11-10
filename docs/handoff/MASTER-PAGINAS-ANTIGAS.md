# Master: inventário das páginas que ainda usam o visual antigo

Base: branch `feat/revela-docs` (de `feat/revela-redesign`), lido do código real em 10/11/2026. Nada de app foi alterado.
Screenshots: **não capturadas**. O Master só renderiza com Supabase configurado e sessão com claim `app_metadata.role = "master"` mais linha ativa em `platform_roles` (`app/master/layout.tsx` + `lib/master/server.ts`). No modo local (`NEXT_PUBLIC_MM_BACKEND=local`) o layout mostra só o cartão M00 "Console indisponível neste modo". Os specs `e2e/master-*.spec.ts` e `e2e/session.spec.ts` criam o master num Supabase local (`SUPABASE_URL`, chave publicável e service key), injetam o cookie `sb-<ref>-auth-token` e só então navegam. Não há Supabase local neste ambiente. Para capturar depois: subir a stack local, rodar um script nos moldes de `session.spec.ts` (`master()` + `setSession`) e fotografar em 1440×900 cada rota da seção 2 para `docs/handoff/master-antigas/<rota>.png`.

## 1. Mapa: o que é novo e o que é antigo

Moldura (`app/master/layout.tsx` → `MasterNav.tsx` → `revela/master-kit.tsx`): **toda** rota de `/master/**` já aparece dentro da moldura nova (`MasterFrame`: menu `.mside`, barra `.mtop` com busca e selo do ambiente). A diferença está no miolo da página.

Acesso (todas as rotas): `layout.tsx` chama `masterAccess()`: `getUser()` valida o JWT, o claim `app_metadata.role` tem de ser `master` e a RPC `is_master()` tem de devolver `true`. Resultados: `local` (sem Supabase), `anonymous` (sem sessão ou convidado), `forbidden`, `ok`. Cada `page.tsx` chama de novo `requireMaster()` (404 se não for `ok`), porque layouts não reexecutam em navegação suave. A autorização final é do banco: as RPCs de leitura exigem `is_platform_staff()` (papéis `master`, `support`, `auditor`) e levantam `MM004 forbidden` (a UI traduz para "Sem permissão para ver estes dados."). **Mas o layout só deixa entrar o papel master**; `support` e `auditor` existem no banco e nas RPCs, porém a porta de entrada do app os barra. Não existe `aal2` no acesso ao console; o `aal2` (TOTP) só é exigido por `admin_publish_plans` (MM016, tela Planos).

| Rota | Arquivos | Visual | Tela do desenho | Item do menu | Como o menu chega |
|---|---|---|---|---|---|
| `/master` | `page.tsx` | NOVO | M01 `MasterVisao` | Visão geral | link direto |
| `/master/eventos` | `eventos/page.tsx` | NOVO | M02 `MasterEventos` | Eventos | link direto |
| `/master/pessoas` | `pessoas/page.tsx` | NOVO | M10 `MasterPessoas` | Pessoas | link direto |
| `/master/planos` | `planos/page.tsx`, `PricesEditor.tsx`, `prices.ts` | NOVO | M03 `MasterPlanos` (+ M04 `MasterPlanoPublicar`) | Planos e preços | link direto |
| `/master/pagamentos` e `/[id]` | `pagamentos/**`, `billing*.ts(x)` | NOVO (folhas de ação ainda com classes `adm-*`) | M05 / M06 | Pagamentos | link direto |
| `/master/codigos` | `codigos/**`, `codes*.ts(x)` | NOVO (folha "Revogar" ainda `adm-*`) | M07 `MasterCortesias` | Cortesias | link direto |
| `/master/revelacoes` | `revelacoes/**` | NOVO | M08 | Revelações | link direto |
| `/master/moderacao` | `moderacao/**` | NOVO | M09 | Moderação | link direto |
| `/master/saude` | `saude/page.tsx` | NOVO | M11 `MasterSaude` | Storage e saúde | link direto |
| `/master/lgpd` | `lgpd/page.tsx` | NOVO | M12 | LGPD | link direto |
| `/master/auditoria` | `auditoria/page.tsx` | NOVO | M13 | Auditoria | link direto |
| `/master/configuracoes` | `configuracoes/**` | NOVO | M14 `MasterConfig` | Configurações | link direto |
| `/master/busca` | `busca/page.tsx` | NOVO (kit, sem tela própria no desenho) | nenhuma | nenhum; vem da caixa de busca da barra `.mtop` (form GET) | só pela barra |
| `/master/usuarios` | `usuarios/page.tsx` | **ANTIGO** (`ui.tsx`, `adm-*`) | nenhuma | nenhum link; `currentOf` acende "Pessoas" | só digitando a URL |
| `/master/organizadores` | `organizadores/page.tsx` | **ANTIGO** | coberta em parte por M10 aba Organizadores | nenhum link; acende "Pessoas" | só URL |
| `/master/participantes` | `participantes/page.tsx` | **ANTIGO** | coberta em parte por M10 aba Convidados | nenhum link; acende "Pessoas" | só URL |
| `/master/storage` | `storage/page.tsx` | **ANTIGO** | coberta em parte por M11 | nenhum link; acende "Storage e saúde" | só URL |
| `/master/analytics` | `analytics/page.tsx` | **ANTIGO** | coberta em parte por M01 | nenhum link; acende "Visão geral" | só URL |

Fatos importantes:
- `MASTER_NAV` / `MASTER_HREF` (em `master-kit.tsx` e `master-icons.tsx`) têm **12 itens**: visao, eventos, pessoas, planos, pagamentos, cortesias, revelacoes, moderacao, saude, lgpd, auditoria, configuracoes. As cinco páginas antigas **não têm item**; ficaram órfãs, sem nenhum link em `src` (grep confirma). `currentOf()` em `MasterNav.tsx` só as agrupa no menu.
- `app/master/modules.ts` ainda lista 15 módulos (inclui as 5 antigas) mas **ninguém importa mais** para o menu; é resíduo. Os 15 "módulos" antigos viraram as 15 telas M00–M14 do desenho, que não são 15 rotas: M00 é o login/gate, M04 é a folha de publicar de Planos e M06 é o detalhe do pagamento.
- `ui.tsx` (PageHead, Metric, Badge, StateBox, Table, ListSearchForm, ListPagination) e as classes `.adm-*` de `styles/admin.css` (87 linhas) só são usados por essas 5 páginas e por restos em `billing-actions.tsx`, `codes-actions.tsx` e `RevealNow.tsx` (`adm-nota`, `adm-code-card`, `adm-eyebrow`, `adm-sheet-nota`) e `ConfigForm.tsx`. Ao reformular as 5 páginas, `ui.tsx` pode ser removido e `admin.css` encolhe para essas sobras.
- Função de conveniência compartilhada: `app/master/data.ts` (`requireMaster`, `rpc<T>` com `Load<T>` = ok/denied/error, `num`, `bytes`, `when` em fuso America/Cuiaba, `window(dias)`), `pagination.ts` (PAGE_SIZE 25, `listArgs`), `format.ts` (relWhen, shortDay etc.).

Padrão comum às 5 páginas antigas (para não repetir em cada uma):
- Acesso: `requireMaster()` + RPC com `is_platform_staff()`. E-mail completo só para `is_master()`; os outros papéis veriam `a***@dominio` (`regexp_replace(email,'^(.).*(@.*)$','\1***\2')`). Como o layout só admite master, hoje o e-mail vem sempre completo.
- Estados: carregando = nenhum (Server Component; a navegação espera a resposta); erro/negado = `StateBox` (`.adm-state`, `role="alert"`: "Sem permissão para ver estes dados." ou "Não foi possível carregar: <mensagem>"); vazio = `.adm-state` com texto por tabela.
- Somente leitura: nenhuma dessas 5 páginas grava nada nem escreve auditoria.
- Paginação: `?p=` (25 por página, limite do servidor 100), `?q=` busca de até 80 caracteres aplicada **antes** da paginação (total correto). Links "← Anterior" / "Próxima →" e texto "Página X de Y · N registros · a–b".
- Ordenação: fixa no servidor (data desc); sem ordenação clicável.
- Testes comuns: `src/features/admin/master-lists.test.tsx` (vitest) cobre usuarios, organizadores e participantes; pgTAP `supabase/tests/database/19_ux_admin_lists.test.sql` e `02_v2_studio_admin.test.sql`. Nenhum teste cobre `storage` nem `analytics` na UI. O E2E `e2e/master-studio.spec.ts` navega as rotas `usuarios`, `organizadores`, `participantes`, `storage`, `analytics` esperando status 200, `h1` visível e ausência de erro, **mas está desatualizado** (ver seção 4).

## 2. Páginas antigas, uma a uma

### 2.1 `/master/usuarios`
- **Arquivos:** `app/master/usuarios/page.tsx`; `ui.tsx`; `data.ts`; `pagination.ts`.
- **Propósito:** lista de contas de autenticação (organizadores Google, link por e-mail e convidados anônimos) com papel de plataforma.
- **Acesso:** master (layout) e RPC `is_platform_staff()`.
- **RPC:** `admin_search_users(p_limit int=25, p_offset int=0, p_search text=null)` (migration `20261107000500_ux_admin_lists.sql`). Retorna `{ total, limit, offset, items[] }`; item: `userId, isAnonymous, provider (google|email|anonymous), email (mascarado exceto master), createdAt, lastSignInAt, platformRole (master|support|auditor|null)`. Limite do servidor: 1 a 100. Busca: id (substring), `profiles.display_name`, e-mail só se master. Ordem: `created_at desc, id`.
- **Colunas:** ID (8 primeiros caracteres do uuid em `<code>`), Tipo (selo "convidado" info, ou o provedor em ok), E-mail, Criado em, Último acesso, Papel (selo aviso, ou "—"). Texto de cabeçalho: "Contas de autenticação: organizadores (Google) e convidados anônimos. Sem telefone nem metadados; e-mail completo só para master."
- **Filtros/busca/paginação:** só busca textual (`?q=`) e paginação (`?p=`). Sem filtro por tipo.
- **Ações:** nenhuma.
- **Estados:** vazio "Nenhum usuário."; erro/negado via StateBox.
- **Privacidade/LGPD:** sem telefone, sem metadados de auth; e-mail completo só ao master; id truncado. Dado pessoal exibido: e-mail e datas de acesso. Não há botão de exportar nem de apagar.
- **Testes:** vitest `master-lists.test.tsx` (página 3 com busca: offset 50, limit 25, "Página 3 de 4", link Próxima `p=4`); pgTAP 19 (total antes do limite, acesso à última página, `support` recebe e-mail mascarado e não busca PII, usuário comum recebe MM004, `anon` sem grant).
- **Problemas conhecidos:** órfã (sem link no menu); visual antigo; sem filtro por tipo nem contagem por tipo; sem ordenação; `admin_list_users_v2` (que já devolve `summary` por tipo, `eventsLinked`, `isTest`, `orphanAnon`, `p_kind`) é usada por Pessoas apenas para a aba Equipe (até 200 itens, sem paginação), então contas de equipe além da 200ª pelo critério "mais novas primeiro" não aparecem.
- **O que o desenho cobre:** M10 aba **Equipe** mostra e-mail, papel e "Desde" das contas com `platformRole` (vindas de `admin_list_users_v2`). M10 aba Organizadores cobre o subconjunto "tem evento".
- **Lacunas:** lista geral de contas (inclusive convidados anônimos e quem nunca criou evento); coluna Último acesso; ID da conta; busca por conta; contagem de órfãos anônimos; filtro por tipo (Google / e-mail / convidado).
- **Onde viver no novo desenho:** nova aba "Contas" em M10 (Seg ao lado de Organizadores, Convidados, Equipe) usando `admin_list_users_v2` (já paginável e com `kind`). Alternativa: colapsar em "Equipe" mudando-a para "Contas" com chip de filtro "Todas / Equipe / Google / E-mail / Convidados".

### 2.2 `/master/organizadores`
- **Arquivos:** `app/master/organizadores/page.tsx`.
- **Propósito:** organizadores (quem tem ao menos um evento não apagado) com contagens.
- **RPC:** `admin_list_organizers(p_limit=25, p_offset=0, p_search=null)` (`20261022000500_admin_rpcs.sql`). Retorna `{ total, limit, offset, items[] }`; item: `userId, displayName, email (mascarado exceto master), eventsCount, activeEvents, firstEventAt, lastEventAt, photos (fotos prontas, não apagadas, em eventos não apagados), deletionRequested (pedido LGPD aberto)`. Busca por nome (`ilike` com escape de `%` `_` `\`) e e-mail (só master). Ordem: `last_event_at desc`.
- **Colunas:** Nome, E-mail, Eventos, Ativos, Fotos (numéricas à direita), Último evento, LGPD (selo aviso "exclusão pedida" ou "—"). Texto: "E-mails aparecem mascarados, exceto para o papel master."
- **Filtros/busca/paginação:** `?q=`, `?p=`.
- **Ações:** nenhuma. Auditoria: nenhuma (leitura).
- **Estados:** vazio "Nenhum organizador ainda."; erro/negado.
- **Privacidade/LGPD:** e-mail por papel; sinaliza quem pediu exclusão; fotos só como contagem.
- **Testes:** vitest `master-lists.test.tsx` (mesmo caso); pgTAP 19 (76 organizadores, página além de 50) e 02 (lista vazia).
- **Problemas conhecidos:** órfã; **M10 aba Organizadores já usa a mesma RPC** (25 por página, `?aba=organizadores&q=&p=`) mas **descarta** `activeEvents`, `photos`, `lastEventAt`; troca por "Entrou com" (provedor), "Gasto total" (soma de pedidos `pago` de `admin_list_payments` limit 500, ou seja, truncado em 500 pedidos: gasto subestimado numa base grande) e "Desde" (`firstEventAt`). O selo "exclusão pedida" virou sufixo de texto no nome.
- **Cobre:** nome, e-mail, entrou com, eventos, gasto total, desde, "exclusão pedida" (como texto), busca e paginação.
- **Lacunas:** Ativos, Fotos, Último evento; selo LGPD estilizado; link para a lista de eventos do organizador (hoje não há); o desenho tem coluna chevron (`.2fr`) para abrir detalhe, e o app a omite porque não existe tela de detalhe de pessoa.
- **Onde:** manter em M10; acrescentar as colunas Ativos/Fotos/Último evento (ou um tooltip) e fazer a linha abrir `/master/eventos?q=<nome>`. Detalhe de pessoa exigiria tela nova.

### 2.3 `/master/participantes` (Convites e participantes)
- **Arquivos:** `app/master/participantes/page.tsx`.
- **Propósito:** duas tabelas na mesma página: quem entrou em cada evento e o estado dos convites.
- **RPCs (paralelas):**
  - `admin_search_participants(p_limit, p_offset, p_search)`: item `eventId, eventTitle, userId, name, table, joinedAt, blocked, isHost`. Busca por nome, título do evento e mesa. Ordem `joined_at desc`. Página `?p=`.
  - `admin_search_invites(p_limit, p_offset, p_search)`: item `id, eventId, eventTitle, label, uses, maxUses, expiresAt, revokedAt, createdAt, state (ativo|expirado|esgotado|revogado)`. Busca por rótulo e título. Ordem `created_at desc`. Página `?i=` (independente). **Nunca devolve token nem hash** (pgTAP garante que `token_hash` não aparece).
- **Colunas participantes:** Evento, Nome, Mesa, Entrou em, Situação (selo: bloqueado=erro, organizador=info, ativo=ok). **Convites:** Evento, Rótulo, Usos (`uses / maxUses`), Expira, Estado (ativo=ok, revogado=erro, demais=aviso).
- **Busca:** um único campo `q` filtra as duas listas ao mesmo tempo.
- **Ações:** nenhuma (não revoga convite nem desbloqueia participante).
- **Estados:** "Nenhum participante." / "Nenhum convite."; erro/negado por tabela (falha de uma não derruba a outra).
- **Privacidade:** "Tokens de convite nunca aparecem." Sem telefone, e-mail nem foto. Nome do participante é dado pessoal (apelido digitado).
- **Testes:** vitest (paginação independente: `p=3` → offset 50, `i=2` → offset 25, busca repassada); pgTAP 19.
- **Problemas:** órfã; M10 aba **Convidados** usa só `admin_search_participants` (colunas Nome, Evento, Mesa, Entrou, Situação; cobre tudo da primeira tabela) mas **a segunda tabela (convites) não tem lugar no novo desenho**; `admin_search_invites` hoje é chamada somente por esta página. Situação em M10 vira texto puro, sem selo (`St`).
- **Lacunas:** convites inteiros (rótulo, usos, expiração, estado); distinção visual de bloqueado/organizador.
- **Onde:** nova aba "Convites" em M10 (Seg com 4 abas) ou seção "Convites" dentro de Eventos (a RPC já tem `eventId`). Preferência: aba, mantém o padrão `MasterPessoasView`.

### 2.4 `/master/storage` (Storage e fotos)
- **Arquivos:** `app/master/storage/page.tsx` (usa `Metric` e `.adm-grid`).
- **Propósito:** consumo do storage e saúde dos uploads.
- **RPC:** `admin_dashboard_metrics(p_from=now()-30d, p_to=now(), p_tz='America/Cuiaba')` (sem argumentos aqui). Usa só: `storage.photosBytes`, `storage.photosObjects`, `storage.brandingBytes`, `storage.brandingObjects`, `uploads.failed`, `uploads.inProgress`, `photos.total`. (A mesma RPC devolve ainda `events.*`, `organizers.*`, `participants.*`, `photos.uploaded`, `reveals.*` e `series[]`.) Dados vêm de `storage.objects` (buckets `event-photos` e `event-branding`, campo `metadata->>'size'`) e de `photos.upload_status`. Falha de upload = `falhou` ou `enviando` há mais de 1 hora; em andamento = `enviando` há menos de 1 hora.
- **Campos (4 cartões):** "Fotos (bucket privado)" tamanho + "N arquivos · M fotos prontas"; "Identidade visual" tamanho + arquivos; "Uploads com falha"; "Uploads em andamento". Texto: "O console não lista nem exibe fotografias privadas; o acesso excepcional exige justificativa e fica na auditoria."
- **Ações:** nenhuma (o acesso excepcional é a RPC `admin_request_photo_access(p_photo, p_reason)`, sem UI, ver glossário).
- **Estados:** erro/negado; sem estado vazio (zeros).
- **Privacidade:** fotos privadas nunca exibidas; só agregados.
- **Testes:** nenhum na UI; pgTAP 02 cobre `admin_dashboard_metrics` (vazio e com dados).
- **Problemas:** órfã; **M11 (`/master/saude`) mostra o mesmo bloco de armazenamento de forma incompleta**: gauge "Fotos" (`photosBytes`, `photosObjects`, `photos.total`, cota opcional `platform_settings.storage_quota_bytes`) e "Fila de exclusão" (`admin_health.purgeQueue.size`), mais "Storage de fotos" nos serviços (`uploads.stalled`/`failed` de `admin_health`). **Faltam em M11:** Identidade visual (bytes e arquivos) e Uploads em andamento. Existe `admin_storage_breakdown()` (originais / derivadas `.thumb` / órfãos / identidade visual, tamanho médio da foto e crescimento diário de 30 dias) **que nenhum código do app chama**.
- **Cobre:** bytes de fotos, nº de arquivos, fotos prontas, uploads presos/falhos (como texto do serviço).
- **Lacunas:** Identidade visual; Uploads em andamento; número exato de falhas como cartão; breakdown (órfãos, derivadas), crescimento por dia.
- **Onde:** M11 "Armazenamento": acrescentar medidores "Identidade visual" e "Órfãos" e meta com "em andamento"; crescimento diário como barras `.bars` na MCard (padrão de M01).

### 2.5 `/master/analytics`
- **Arquivos:** `app/master/analytics/page.tsx`.
- **Propósito:** série diária dos últimos 30 dias.
- **RPC:** `admin_dashboard_metrics(p_from = agora-30d, p_to = agora)` via `window(30)`; usa `series[]`: `{ day, eventsCreated, participantsJoined, photosUploaded, uploadsFailed }`, em fuso Cuiabá, dias sem atividade com zero. Limite do servidor: janela de 1 a 366 dias, MM005 se inválida.
- **Colunas:** Dia, Eventos criados, Entradas, Fotos, Falhas (todas numéricas), do dia mais novo para o mais antigo. Texto: "Série diária dos últimos 30 dias, calculada no banco (fuso de Cuiabá). Sem estimativas."
- **Filtros:** nenhum (período fixo de 30 dias). Sem paginação. Ações: nenhuma.
- **Estados:** erro/negado; vazio "Sem atividade no período." (nunca ocorre, pois os dias vêm preenchidos com zero, então a tabela sempre tem 30 linhas).
- **Privacidade:** só agregados.
- **Testes:** nenhum na UI; pgTAP 02.
- **Problemas:** órfã; **M01 (Visão geral) usa outra RPC** (`admin_overview(p_days 7|30)`) e mostra receita por dia, vendas por plano, KPIs (eventos ativos, fotos, receita) e últimos pagamentos. Os dados de Analytics (entradas de convidados por dia, eventos criados por dia, falhas por dia) **não aparecem em M01**. `admin_overview` calcula internamente `joins`, `photos`, `rev` e `active` por dia (`spark`) mas o app só consome `kpis`, `series.photos` e `upcomingReveals`. Além disso, `admin_dashboard_metrics` não exclui eventos de teste (`is_test`), enquanto `admin_overview` exclui por padrão (`p_include_tests=false`): os números das duas telas divergem.
- **Cobre:** fotos por dia (barras em M01, 7/30 dias).
- **Lacunas:** eventos criados/dia, entradas/dia, falhas/dia; tabela diária; unificação de critério de eventos de teste.
- **Onde:** M01 com segundo cartão "Atividade por dia" (Seg 7/30, `.bars` ou tabela `MTable`) ou nova aba em Visão geral. Decisão pendente: adicionar `p_include_tests` às métricas.

## 3. Funcionalidades de backend sem tela (candidatas ao novo desenho)
Existem RPCs prontas e testadas (pgTAP 02) sem chamador no app:
- `admin_event_detail(p_event)`: detalhe de um evento (a lista M02 não tem link de detalhe; a coluna do desenho tem apenas título).
- `admin_list_events_v2(...)`: eventos com ordenação/ filtro de revelação (M02 usa `admin_events_board`).
- `admin_set_test_flag(p_events uuid[], p_value, p_reason)` e `admin_soft_delete_test_events(p_events, p_reason)`: marcar e excluir em lote eventos de teste (só master, motivo 10–500, 1 registro de auditoria por evento, recusa lote com evento real, pago ou com direito não gratuito: erros MM005 `nottest`/`paid`). Sem UI; `p_include_tests` existe em `admin_overview` e `admin_list_users_v2`, mas o app nunca o liga (sempre `false`).
- `admin_grant_platform_role(p_user, p_role, p_reason)` / `admin_revoke_platform_role(...)`: gerir a equipe. A aba Equipe é só leitura.
- `admin_list_audit_v2(p_limit, p_offset, p_category, p_event)`: auditoria por categoria (participante, consentimento, revelação, admin, pagamento) e por evento; M13 usa a v1 com prefixo de ação digitado.
- `admin_health_history(p_limit)`: histórico dos jobs `pg_cron` (últimas N execuções, falhas consecutivas).
- `admin_storage_breakdown()`, `admin_request_photo_access(p_photo, p_reason)`, `admin_audit_integrity()`, `admin_clear_needs_refund(p_order, p_reason)`, `admin_list_participants/invites(p_event,...)`, `admin_list_users(p_limit,p_offset)` (v1).

## 4. Problemas transversais conhecidos
1. **E2E desatualizado:** `e2e/master-studio.spec.ts`, `e2e/session.spec.ts` e `e2e/reveal.spec.ts` procuram `getByRole("navigation", { name: "Módulos do console" })` com 15 links e `.adm-table`; esse landmark não existe mais no `MasterFrame` (o menu é `<aside class="mside">` com 12 links e sem `nav` rotulado). O spec passa por 14 rotas, entre elas as 5 antigas. Reescrever contra o menu novo (12 itens) e contra os 15 `h1` das telas novas. O gate do CI é outro (`ux-flow-hardening`, `validapay-local`), então a quebra pode passar despercebida.
2. **Acessibilidade do menu:** `MasterAside` usa `<a>` sem `<nav>`/`aria-label`; perda de landmark em relação ao console antigo.
3. **Entrada só para master:** o layout não admite `support`/`auditor`, embora as RPCs e os testes pgTAP os contemplem (e-mail mascarado). Decisão de produto pendente.
4. **`modules.ts` morto** e `admin.css` com classes quase sem uso.
5. **Gasto total em Pessoas** soma só os 500 pedidos mais recentes.
6. **`admin_dashboard_metrics` vs `admin_overview`** divergem quanto a eventos de teste.
7. Botões "Exportar" são omitidos (`exportHref={null}`) em todas as telas; nenhuma exportação CSV existe, apesar de o desenho mostrá-la.
8. A busca global `/master/busca` não existe no desenho; os resultados de Pessoas apontam para texto sem link (não há detalhe de pessoa).

## 5. Quadro de lacunas (resumo)
| Funcionalidade antiga | Já no novo desenho | Falta |
|---|---|---|
| Usuários (todas as contas) | Equipe (só com papel) | contas gerais, último acesso, filtro por tipo |
| Organizadores | M10 Organizadores | Ativos, Fotos, Último evento, selo LGPD |
| Participantes | M10 Convidados | selos de situação |
| Convites | nada | tabela inteira |
| Storage | M11 gauge Fotos + Fila | Identidade visual, em andamento, órfãos, crescimento |
| Analytics | M01 fotos/dia | eventos/dia, entradas/dia, falhas/dia |
| Gestão de equipe, eventos de teste, histórico de jobs, detalhe de evento | nada | telas novas |

## 6. Decisões que o usuário precisa tomar
1. As 5 rotas antigas devem **sumir** (redirecionar para Pessoas, Visão geral e Storage e saúde) ou ganhar telas no desenho?
2. Convites: aba nova em Pessoas, seção em Eventos, ou descartar?
3. Contas gerais (anônimos, quem nunca criou evento): aba "Contas" ou apenas Equipe?
4. Storage: quais itens entram em M11 (identidade visual, órfãos, derivadas, crescimento, em andamento)? Mostrar cota (`storage_quota_bytes`) mesmo quando indefinida?
5. Analytics: série diária de eventos/entradas/falhas entra em M01, em aba própria ou sai?
6. Eventos de teste: expor o interruptor "incluir testes" e as ações de marcar/excluir em lote (master, motivo)? Unificar `admin_dashboard_metrics` com `admin_overview` quanto a `is_test`?
7. Papéis `support` e `auditor`: liberar entrada no console (e-mail mascarado) ou manter só master?
8. Gerir equipe pela UI (conceder/revogar papel, com motivo e, talvez, `aal2`)? Exigir `aal2` em outras ações sensíveis (reembolso, revelar agora)?
9. Detalhe de pessoa e de evento (linhas clicáveis, chevron do desenho): criar telas?
10. Exportação CSV: implementar (com auditoria, pois contém PII) ou remover o botão do desenho?
11. Gasto total em Pessoas: criar RPC agregada por organizador em vez de somar 500 pedidos?
12. Atualizar os E2E do Master e reativá-los no CI?
13. Remover `ui.tsx`, `admin.css`, `modules.ts` e as folhas `adm-*` ao final?
14. Prova visual: gerar capturas 1440×900 de cada nova tela (exige Supabase local).

## 7. PROMPT-MODELO

> Implemente as telas do Master abaixo do design **Revela 2.0** exatamente como estão em `design-system/revela/html/Master-*.html` (e nos PNGs correspondentes). O design é a especificação; não é inspiração.
>
> Repositório `mzinhoww-svg/memo-brasil`, app em `web/`, branch `feat/revela-redesign` (worktree próprio, `node_modules` por link simbólico). Use `web/src/revela/master-kit.tsx` (MHead, Tiles, MTable, Seg, Chips, MCard, Gauge, GroupRow, MNote, MState, St) e o padrão de `web/src/revela/screens/Master*.tsx`: o componente `MasterXxxView` recebe props e tem o desenho como valor padrão; a página real em `app/master/<rota>/page.tsx` carrega os dados e passa as props. Handlers inline exigem `"use client"`.
>
> **Regras sem exceção:** (1) cada tela é refeita a partir do HTML/PNG, não repintada; (2) todo elemento visível existe, na mesma ordem; (3) nenhum elemento novo fora do desenho; estados de vazio, erro, carregando e sem permissão usam `MState`/`MNote` e o layout da tela mais próxima; (4) textos idênticos ao desenho, trocando só os dados; (5) se o dado que o desenho mostra não existe, crie migration aditiva (timestamp maior que `20261110000100`) com RLS e teste pgTAP em `supabase/tests/database/`, sem alterar RPCs existentes; (6) cores, fontes, raios e sombras só de `web/src/styles/tokens.css` (nenhum hex fora dele; `no-hex.test.ts`); (7) nada do kit antigo (`adm-*`, `mm-*`).
>
> **Regras do Master:** acesso por `requireMaster()` em cada página; a autorização é do banco (`is_platform_staff()` / `is_master()`); todo erro `MM004` vira "Sem permissão para ver estes dados."; ações sensíveis exigem motivo de 10 a 500 caracteres (`reasonError`, `adminErrorText`), gravam auditoria no servidor e confirmam em `Sheet`; e-mail e dados pessoais seguem a regra de máscara; fotos privadas nunca aparecem; tokens de convite nunca aparecem; fuso `America/Cuiaba`; paginação de 25 com a busca aplicada antes; fuso e formatos de `app/master/format.ts`.
>
> **Itens da aplicação (preencher):**
> - Telas novas do desenho: `<ids e arquivos Master-*.html>`
> - Rota real de cada uma: `<rota>`
> - Item do menu (`MASTER_NAV` / `MASTER_HREF` / `currentOf`): `<id do item ou aba>`
> - RPC e parâmetros de cada uma: `<nome(p_...)>`
> - Campos e colunas do desenho que o dado já cobre: `<lista>`
> - Campos do desenho sem dado (criar migration): `<lista>`
> - Rotas antigas que passam a redirecionar ou ser removidas (`usuarios`, `organizadores`, `participantes`, `storage`, `analytics`) e para onde: `<destino>`
> - Decisões já tomadas (seção 6 de `docs/handoff/MASTER-PAGINAS-ANTIGAS.md`): `<números e respostas>`
>
> **Como trabalhar, tela por tela:** (a) liste em `docs/revela/checklist.md` todos os elementos do HTML; (b) escreva a tela do zero; (c) capture 1440×900 com dados equivalentes e gere imagem lado a lado (app | desenho) em `docs/evidence/revela/<id>.png` (precisa de Supabase local e sessão master como em `e2e/session.spec.ts`; no modo local o Master mostra só o cartão M00); (d) corrija até só sobrar diferença de dados; (e) atualize os testes vitest e os E2E que quebrarem (menu de 12 itens, sem `.adm-table`), sem apagar cobertura de regra; (f) `npx tsc --noEmit`, `npx eslint src`, `npx vitest run`; (g) um commit por tela ou grupo pequeno, em português, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: <url da sessão>`; push na branch indicada. Sem PR, sem produção, sem Supabase remoto.
>
> **Critério de pronto:** imagem lado a lado commitada e todos os itens marcados. "Parecido" conta como não feito. No relatório final liste cada tela como pronta, parcial (com o que falta) ou não feita.

## 8. Glossário das RPCs do Master
Convenções: todas `security definer`, `search_path = ''`, sem `anon`. Leitura = `is_platform_staff()` (master, support, auditor). Escrita = `is_master()`. Erros: `MM004` forbidden, `MM005` invalid (parâmetro ou estado recusado), `MM008` já revelado, `MM011` motivo fora de 10–500 caracteres (`admin_reason`), `MM016` exige `aal2`. Ações sensíveis chamam `admin_log(action, target_type, target_id, reason, event)` e gravam em `audit_logs` (somente inserção).

Leitura (em uso):
- `is_master()` → boolean. Claim `app_metadata.role='master'` e `platform_roles` ativa. Porta do console.
- `get_public_settings()` → jsonb (`payments_env`: desligado/sandbox/production, etc.). Selo do ambiente e Configurações.
- `admin_overview(p_days 1–366 = 30, p_include_tests = false)` → `{days, generatedAt, kpis{activeEvents,photos,revenueCents:{value,previous,spark}}, series[], upcomingReveals[], readiness{paymentsEnv,lastWebhookAt}, ...}`. Receita só para master. Usada em M01, M11, M14.
- `admin_events_board(p_filter, p_search, p_limit 25, p_offset)` → `{total, counts{todos,rolando,aguardando,revelados,denuncias,excluidos}, items[]}`. Filtros: rolando, aguardando, revelados, denuncias, excluidos. M02.
- `admin_list_events(p_limit, p_offset, p_search, p_status ativo|encerrado, p_include_deleted)` → `{total, items[]}`. M07 (lista de eventos para cortesia).
- `admin_list_events_v2(...)`, `admin_event_detail(p_event)`: sem UI.
- `admin_list_organizers(p_limit, p_offset, p_search)`: ver 2.2. M10.
- `admin_list_users_v2(p_limit 50, p_offset, p_kind google|email|anon|null, p_include_tests, p_search)` → `{total, items[], summary{google,email,anon,orphanAnon}}`. M10 Equipe.
- `admin_search_users`, `admin_search_participants`, `admin_search_invites` (25 / 0 / null): ver seção 2. `admin_list_reveals`: sem UI (substituída por `admin_reveals_board`).
- `admin_search(p_q ≥ 2 caracteres)` → `{events[5], users[5], orders[5]}`; e-mail e pedidos só para master. `/master/busca`.
- `admin_list_payments(p_status, p_limit 100)` → setof jsonb; `admin_payments_summary()` → `{byStatus{status:{count,amountCents}}}`; `admin_payment_divergences()`; `admin_request_refund(p_order, p_reason)`; `admin_request_payment_refund(p_order, p_payment, p_reason, p_amount_cents)`; `admin_clear_needs_refund(p_order, p_reason)`; `admin_grant_courtesy(p_event, p_plan, p_reason)` → uuid. Pagamentos e cortesias.
- `admin_list_plans()` → setof jsonb (`code,name,isFree,sort,priceCents,highlighted,...`); `admin_set_plan(p_code, p_price_cents, p_sandbox_active, p_production_active, p_reason)`; `admin_publish_plans(p_changes jsonb, p_reason)` → exige `aal2`, grava `plan.price_changed`, não altera direitos nem Pix abertos.
- `admin_list_codes()` → setof jsonb; `admin_create_code(p_plan, p_max_uses 1–1000, p_expires_at, p_note 3–200)` → text (código inteiro só nessa resposta); `admin_revoke_code(p_code_id, p_reason)`.
- `admin_reveals_board(p_limit 50)` → `{items[{id,title,revealAt,revealedAt,photos,emailOptIns,emailsSent,emailsFailed,emailsQueued}]}`; `admin_reveal_now(p_event, p_reason)` → revela uma vez, MM008 se já revelado, `admin.reveal_now` na auditoria.
- `admin_moderation_queue()` → `{photos[], comments[], blocked[]}`; `moderate_comment(p_comment, p_action mostrar|esconder|remover, p_reason)`.
- `admin_list_audit(p_limit 50, p_offset, p_action prefixo)` → `{total, items[{id,at,actorId,actorRole,action,targetType,targetId,reason}]}`; `admin_list_audit_v2(p_limit, p_offset, p_category, p_event)`; `admin_audit_integrity()`.
- `admin_lgpd_requests(p_limit 100, p_offset)` → `{slaDays: 15, summary{pending,processed,overdue}, items[{userId,requestedAt,processedAt,status,daysOpen,overdue}]}`.
- `admin_health()` → `{generatedAt, cronAvailable, jobs[], reveals{overdue,maxDelaySeconds}, purgeQueue{size,oldestAgeSeconds}, uploads{stalled,failed}, lgpd{pendingDeletions}}`; `admin_health_history(p_limit 24)` (sem UI).
- `admin_dashboard_metrics(p_from, p_to, p_tz)` → ver 2.4 e 2.5 (janela até 366 dias, MM005 se inválida); `admin_storage_breakdown()` (sem UI).
- Configurações: leitura direta das tabelas `platform_settings(key,value)` e `feature_flags(key,enabled)`; escrita por `admin_set_setting(p_key, p_value jsonb, p_reason)` e `admin_set_feature_flag(p_key, p_enabled, p_rollout, p_reason)`.

Escrita sem UI: `admin_set_test_flag`, `admin_soft_delete_test_events`, `admin_grant_platform_role`, `admin_revoke_platform_role`, `admin_request_photo_access(p_photo, p_reason)` (TTL de 60 s, limite de 30 por hora, grava `photo.access_requested`).

Funções de apoio: `admin_reason(text)` (valida o motivo), `admin_log(...)`, `admin_action_is_sensitive(text)`, `admin_payment_json(...)`, `is_platform_staff()`, `is_platform_role(text)`.
