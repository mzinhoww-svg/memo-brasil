# Console Master: divergências entre o desenho e o app

Registro das decisões tomadas no fluxo autônomo (regra 6 do `PROMPT-MASTER-CONSOLE.md`): em cada uma foi escolhida a opção mais segura.
Fonte da verdade dos papéis: policies de `platform_roles`/`audit_logs`, as RPCs `admin_*` e `web/src/lib/master/roles.ts`; provadas por pgTAP em `supabase/tests/database/32_master_roles.test.sql`.

## 1. Matriz de papéis da M32 × banco

O desenho (`Master-sem-acesso.html`) é uma proposta. Comparação linha a linha, na ordem do desenho:

| Linha do desenho | master | support (desenho → banco) | auditor (desenho → banco) | O que foi feito |
|---|---|---|---|---|
| Eventos, pessoas e convites | sim | sim → sim | sim → sim | Igual (`admin_events_board`, `admin_search_participants`, `admin_search_invites` aceitam `is_platform_staff()`). |
| E-mail e contato completos | sim | mascarado → mascarado | mascarado → mascarado | Igual. O mascaramento (`a***@dominio`) é do banco (`regexp_replace` dentro de `admin_search_users`, `admin_list_users_v2`, `admin_list_organizers`, `admin_search`, `admin_export_csv`); a busca por e-mail só vale para o master (impede reconstruir o endereço por prefixo). Nome, texto de comentário e nome de convidado bloqueado em `admin_moderation_queue` só voltam para o master. Provado em pgTAP. |
| Pagamentos | sim | **leitura → nada** | **leitura → nada** | **Divergência.** `admin_list_payments`, `admin_payments_summary` e `admin_payment_divergences` exigem `is_master()` desde o início, e o desenho não pede para abrir. Mantido o banco (mais seguro): support e auditor recebem `MM004`, o menu não mostra "Pagamentos" e a M32 exibe "—". Se o produto quiser leitura para eles, é migration nova com versão sem e-mail/contato. |
| Auditoria | sim | — → **leitura (antes)**, agora — | sim → sim | **Divergência corrigida no banco.** `admin_list_audit` e `admin_list_audit_v2` aceitavam `is_platform_staff()`, então o support lia a trilha por RPC, embora a policy de `audit_logs` já negasse (pgTAP 02: "support não lê a trilha de auditoria"). Migration `20261111000100` passa a exigir master ou auditor. |
| Exportar | sim | — → **permitido (antes)**, agora — | sim → sim | **Divergência corrigida no banco.** `admin_export_csv` aceitava qualquer staff (`31_admin_export_csv` esperava "suporte exporta eventos"). Agora só master e auditor; pagamentos e impressões continuam só master. O teste 31 foi atualizado (suporte recusado, auditor exporta). |
| Revelar agora, estornar, excluir | sim | — → — | — → — | Igual: `reveal_now` só aceita o anfitrião do evento ou o master; estorno, exclusão de teste, cortesia e preços exigem `is_master()`. |
| Preços, cortesias e configurações | sim | — → — | — → — | Igual nas RPCs (`admin_list_plans`, `admin_list_codes`, `admin_set_*` exigem master). Observação: as tabelas `platform_settings` e `feature_flags` têm policy de leitura para staff, então support/auditor leriam as chaves por consulta direta; a UI não mostra e nada sensível está nessas tabelas (segredos ficam no Vault). Não alterado. |
| Equipe e papéis | sim | — → — | — → — | Igual: a policy de `platform_roles` e as RPCs de conceder/revogar são só do master. Observação: `admin_list_users_v2` devolve o `platformRole` de cada conta para qualquer staff (a aba Equipe do support mostra a equipe); sem e-mail completo. Não alterado. |
| Nota interna de impressão | sim | — → — | — → — | Igual, e mais restrito: `admin_print_orders` é inteira só do master (a lista de Impressões também). O item "Impressões" não aparece no menu de support/auditor. |

Fora da matriz do desenho: Revelações, Moderação, Storage e saúde e LGPD abrem para os três papéis (RPCs com `is_platform_staff()`); a matriz do desenho não lista essas áreas e o menu as mostra para os três.

A tela M32 do app mostra a matriz real (`ROLE_MATRIX` em `roles.ts`); a do desenho continua como padrão em `/dev/revela/Master-sem-acesso` (`REF_MATRIX`). Um teste de unidade amarra a matriz real aos fatos acima.

## 2. Textos e telas

- **M32 sem papel nenhum**: o desenho só traz o caso "Seu papel é support". Para conta logada sem papel (`forbidden`) e para o auditor foram escritos os textos paralelos: "Seu papel é auditor / Você entra no console para consultar e auditar…" e "Você não tem papel no console / Esta conta não está na equipe do Revela. O acesso não pode ser concedido por esta tela." (legenda "Acesso restrito à equipe da plataforma"). A moldura aparece sem links.
- **Anônimo / sem sessão**: continua o cartão de entrada M00 (é a única forma de o operador entrar); a M32 só aparece para quem está logado. O pedido dizia "sem papel/anônimo → tela de acesso limitado"; para não trancar o operador do lado de fora, só "sem papel" vai para a M32.
- **M32 para support/auditor em área restrita** (ex.: `/master/pagamentos`): `requireRole(area)` devolve a M32 com a legenda "Esta área é só para master" (ou "só para master e auditor" em Auditoria). Menu: cada papel vê só as áreas que abre.
- **Rodapé do menu**: "Administrador · master", "Atendimento · support" e "Auditoria · auditor" (o desenho só traz o primeiro).
- **Formato do arquivo exportado (M24)**: o desenho diz "CSV (UTF-8, separador ;)", mas `admin_export_csv` gera vírgula (e `31_admin_export_csv` garante). O componente mostra "CSV (UTF-8, separador ,)" por padrão (prop `format`). Trocar o separador para `;` é decisão de produto (Excel pt-BR prefere `;`) e exigiria mudar a RPC e o teste.
- **Folha "Revelar agora" (M25)**: mantida a legenda "A mesma folha é usada pelo anfitrião, no painel do evento." do desenho (parece anotação do desenho; é prop `caption`). No painel do anfitrião a linha "Avisos que serão enviados" não aparece (o painel não conhece a contagem; a RPC de contagem é do Master). O motivo é obrigatório (10–500) também para o anfitrião, embora o servidor aceite `reveal_now` sem motivo vindo dele.
- **Folha "Conciliar agora" (M23-r)**: a função `payments-reconcile-now` devolvia só `confirmed`, `failed` e `unattached`; a onda Visão geral · Eventos · Pagamentos a estendeu com `unchanged` e `failures[]` (ver seção 5). "levou N s" é medido no navegador.
- **Contador do motivo**: conta o texto sem espaços nas pontas (como o servidor, `admin_reason`). Acima de 500 o contador fica vermelho e o botão desliga (o campo não trava a digitação).

## 3. Álbum impresso (`printed_album`)

- A chave nasce **sem linha** (= desligada), igual a `validapay_card`; o master liga por `admin_set_feature_flag` (motivo obrigatório, auditado). A tela de Configurações é da onda 2.
- `printed_album_enabled()` é legível por qualquer `authenticated` (inclusive o convidado anônimo do Supabase, que também é `authenticated`); `anon` sem sessão recebe 42501.
- **Além do pedido**: `create_print_order` passou a recusar (`MM004`) com a chave desligada, para que ocultar a tela não deixe a RPC aberta. `31_print_orders` agora liga a chave no início.
- No modo local do app (demonstração, `NEXT_PUBLIC_MM_BACKEND` ≠ `supabase`) o recurso fica disponível, porque não há tabela de chaves; o E2E `print-order.spec.ts` continua valendo.
- Anfitrião sem a chave: 19b (`/eventos/revelados/[id]/album`) e `/eventos/pedidos` mostram "Não achamos…", e somem o botão "Ver como álbum" da galeria e a linha "Álbuns impressos" de Você.
- Master sem a chave: o item some do menu e `/master/impressoes*` responde 404 (`requirePrintedAlbum()`); com a chave, support/auditor veem a M32.

## 4. Pendências para as ondas seguintes

- Páginas antigas (`usuarios`, `organizadores`, `participantes`, `storage`, `analytics`) estão redirecionadas (308) mas o código delas e o de `ui.tsx`, `.adm-*`, `modules.ts` e `admin.css` seguem no repositório.
- O destino `/master/pessoas?aba=contas` (e `convites`) só funciona quando a onda de Pessoas criar essas abas; hoje a página trata `aba` desconhecida como o padrão.
- E2E `master-studio.spec.ts`, `session.spec.ts` e `reveal.spec.ts` continuam esperando o menu de 12 links e `.adm-table` (já estavam desatualizados); reescrever contra o menu novo (13 itens, 12 sem a chave).

## 5. Pessoas (M15 a M19): decisões da onda

- **Gasto total (M16)**: só o master recebe o valor (soma agregada no servidor, sem o limite de 500 pedidos). Para support e auditor o servidor devolve nulo e a coluna mostra "—", porque Pagamentos é área só do master (matriz da M32).
- **Equipe (M19) só do master**: a aba aparece para todos (como no desenho, com a contagem), mas `admin_list_team` nega support e auditor (MM004) e a aba mostra o estado "sem permissão" (M19.p). Conceder e revogar: só master, motivo de 10 a 500 conferido no servidor (antes só o mínimo).
- **Exportar** (contas, organizadores, convidados, convites): só master e auditor, como na matriz; o botão some para support. A exportação continua no tipo `pessoas` com as abas `contas` e `convites` acrescentadas; as colunas seguem as da tela (a coluna "mesa" de convidados saiu porque a tela nova não a tem).
- **Texto das folhas**: o desenho só traz a descrição do papel support; as de master e auditor seguem o mesmo estilo ("master: acesso total…", "auditor: consulta, exporta e lê a auditoria…").
- **Estado vazio sem filtros**: como no desenho, o estado vazio substitui busca e chips; clicar na aba limpa busca e filtro.
- **Equipe "vazia"**: aparece quando só há uma pessoa com papel (a própria), conforme "Ninguém da equipe além de você".
- **Linha de órfãos (M15)**: "N convidados órfãos…" aparece em "Todas" e "Convidados" quando N > 0.
- **Carregando** é o `loading.tsx` da rota; sem as contagens das abas (ainda desconhecidas), mostra só os nomes.
- **Paginação**: `.mpager` é absoluto no desenho; na rota real fica no fluxo (`position: static`) porque a lista tem 25 linhas.
- **CSS**: acrescentadas `.seg a`, `.mcard .seg a` e `.mtr > span > a > svg` (as abas e a seta da linha são links; mesmo visual das regras de `span`).
- **Organizador → Eventos**: a seta abre `/master/eventos?organizador=<id>`; o filtro `organizador` precisa ser tratado pela onda de Eventos.
- **admin_export_csv**: substituída (mesma assinatura) com o ramo `pessoas` delegando a `admin_export_people`; quem mexer nessa função em outra migration deve manter essa chamada.
## 5. Visão geral, Eventos e Pagamentos (M20 a M23)

Migration `20261111000300_master_visao_eventos.sql` (aditiva) e pgTAP `34_master_visao_eventos`.

**Visão geral (M20)**
- **Critério de teste unificado.** `admin_dashboard_metrics` contava eventos de teste e `admin_overview` não. A função ganhou `p_include_tests` (padrão `false`) e passou a excluí-los (eventos, entradas, fotos, falhas, revelações). A assinatura mudou (4 argumentos com padrão; chamadas antigas valem); as telas de Saúde e Storage, que a usam, agora também não contam teste. Storage (bytes) segue global.
- **Tiles.** "Receita do mês" é a do mês até hoje (`admin_overview` com os dias do mês), com a variação contra o período anterior de mesmo tamanho, não "sobre outubro" (a nota diz "sobre o período anterior"). "Fotos hoje" traz "N no mês" no lugar de "pico às 22:40" (não existe dado por hora). "Pedidos pendentes" diz "Pix aguardando" quando há pendentes.
- **Por bloco, por papel.** Receita e Pedidos pendentes são só do master (RPCs de master): support e auditor veem "—" e "só para master", sem derrubar a página. Atividade por dia aparece para os três papéis; se a RPC negar, só o cartão mostra "Sem permissão para ver estes dados.". **Exportar só para master e auditor** (o banco recusa o support, M32); para o support o botão não aparece.
- Falha de upload em vermelho na tabela (M20-t): o desenho não diz a regra; usei "pelo menos 10 e o dobro da média do período". Sem atividade nenhuma no período vira o estado vazio da tela (sem tiles), como no desenho.
- Janela da série: do início do dia de Cuiabá N-1 dias atrás até agora (7 ou 30 dias, de fato 7 ou 30 linhas).

**Detalhe do evento (M21)**
- `admin_event_detail` ganhou `plan` (nome e, só para o master, valor e método do pedido pago), `notices` (inscritos, enviados, falhas e fila: **só números**; antes da revelação os inscritos vêm de quem consentiu, depois da fila de envio), `reportsByReason` (fotos e comentários agregados; "sem motivo" e "spam" contam em "Outro motivo", "ofensivo" em "Conteúdo impróprio"; quem denunciou nunca sai), `printOrders` (só master e só com `printed_album` ligada; o código `IMP-XXXX` são as 4 primeiras letras hexadecimais do id, porque a tabela não tem código curto; a onda de Impressões pode adotar outro) e `audit` com o nome de quem agiu. A linha do tempo mostra os 8 últimos registros e traduz as ações conhecidas; ação sem tradução aparece pelo código.
- **Sem desenho:** "Desmarcar teste" (botão e folha, com motivo) e "Excluir evento de teste" aparecem no cabeçalho de um evento que já é de teste (o desenho só mostra a folha de exclusão). support e auditor leem o detalhe, mas não veem nenhum botão de ação.
- **Estados.** Em erro, sem permissão e carregando o título é o da área ("Eventos"), como manda a regra; o desenho mostra "Ana & Leo" nesses três, o que a página real não consegue saber. Id inválido, inexistente ou evento excluído mostra "Evento não encontrado" só com "Voltar" (o desenho mostra os três botões, que não fazem sentido sem evento).
- A recusa de "marcar como teste" usa o motivo do servidor ("Este evento tem pagamento confirmado em produção."), não "(Pix #RV-2041)".

**Eventos de teste (M22)**
- **Regra do pago.** Evento pago não vira teste e lote com evento real, pago ou inexistente é recusado **inteiro** (`MM005`; a mensagem é o primeiro código, `detail` é o JSON `[{id, title, code, reason}]` com o motivo de **cada** evento). "Pago" = pedido `pago` ou `em_disputa` (qualquer ambiente; o texto distingue produção e testes) ou direito ativo pago, cortesia ou código. Pix pendente em sandbox não bloqueia (é o caso "Teste checkout Pix" do desenho). A mesma função de bloqueio (`test_batch_blockers`) vale para marcar e para excluir; antes, marcar não conferia pagamento.
- **Exportar escondido na lista de teste.** `admin_export_csv` (compartilhada com outras ondas) não conhece o filtro `teste`; exportar daqui entregaria a lista de eventos reais sob o rótulo errado. Em vez de reescrever a função, o botão não aparece nessa lista; a lista de Eventos (e a Visão geral) exportam normalmente.
- Quem não é master vê a lista de teste só para leitura: sem coluna de caixas e sem a barra do lote.
- A lista M02 ganhou o sétimo chip "De teste N" (contagem `counts.teste` da `admin_events_board`); o fixture M02 do desenho segue com 6 chips. A linha do evento abre `/master/eventos/[id]`. O e-mail do organizador sai mascarado no servidor para support e auditor.
- "Desmarcar teste" no lote usa uma folha com motivo que o desenho não traz.

**Pagamentos (M23)**
- `payments-validapay-reconcile` devolve `unchanged` e `failures[]` (rótulo "#PEDIDO · evento" e uma frase curta; nunca a mensagem crua do provedor); `payments-reconcile-now` repassa. **`confirmed` passou a significar "o pedido mudou de situação"**; o que o provedor confirmou sem mudar nada conta em `unchanged` (antes entrava em `confirmed`).
- "Última: …" da espera mostra só a hora do último pedido manual (auditoria `payments.reconcile_requested`), sem o e-mail de quem pediu (a auditoria só guarda o id).
- Pagamentos vazio (sem nenhum pedido) ganhou estado próprio; o carregando não traz o botão Exportar (a página não sabe o papel antes de carregar).

**Código**
- `ExportButton.tsx` segue no repositório para as páginas das outras ondas; esta onda usa `ExportSheetButton.tsx` (abre a `ExportSheet`). Quando todas migrarem, apagar o antigo. `ReconcileButton.tsx`, `MasterVisao.tsx` (M01) e `app/master/analytics` foram apagados.

