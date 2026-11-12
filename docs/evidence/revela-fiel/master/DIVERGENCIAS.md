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
- **Folha "Conciliar agora" (M23-r)**: a função `payments-reconcile-now` devolve só `confirmed`, `failed` e `unattached`. O cartão "Sem mudança" mostra "—" e a lista de falhas por pedido não aparece até a onda de Pagamentos estender a função (campo `unchanged`, `failures[]`). "levou N s" é medido no navegador.
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

## 5. Revelações, moderação, Storage e saúde, Auditoria (M08, M25 a M28)

- **Quem age na Moderação (M26)**: Manter, Esconder e Excluir são só do master (`moderate_comment` e a nova `admin_moderate_photo` exigem `is_master()`). Support e auditor leem a fila sem os botões; o texto do comentário e o nome só voltam para o master (já era assim no servidor). Exportar a moderação: master e auditor (como toda exportação); support não vê o botão.
- **Foto na fila**: nunca renderizada; só `foto 3f1a…` (4 primeiros caracteres do id), evento, total e motivos agregados. Provado em pgTAP 35 (chaves exatas do JSON da fila, sem caminho, URL nem denunciante) e em vitest (nenhum `img` no DOM).
- **Textos que o desenho não traz**, escritos no mesmo molde: folhas "Manter esta foto?", "Excluir esta foto?" e as dos comentários; vazios das abas Comentários ("Nenhum comentário denunciado") e Participantes bloqueados ("Nenhum participante bloqueado"); a aba Participantes bloqueados (tabela do M09 antigo) não tem desenho próprio no M26 e foi mantida.
- **Excluir foto** usa o caminho do anfitrião (`status = 'removida'`): o gatilho carimba `deleted_at` e enfileira o arquivo na limpeza do storage. Manter zera as denúncias da foto (apaga `photo_reports`) e a devolve ao feed. Auditoria: `photo.kept`, `photo.hidden`, `photo.removed`, com o motivo e sem dados da imagem.
- **Botão Exportar do M26** não tinha tipo em `admin_export_csv`: criada `admin_export_moderation_csv(aba)` (sem texto de comentário, nome, foto nem denunciante). O mesmo vale para a Auditoria: `admin_export_audit_csv(categoria, evento)` leva os filtros da tela (a RPC genérica só filtrava por prefixo de ação) e não altera `admin_export_csv`, para não colidir com as outras ondas. As duas gravam `export.csv` na auditoria, com limite de 50.000 linhas.
- **M27, fila de exclusão**: o desenho não tem esse medidor, o pedido tem. Ele aparece (como sexto medidor) só quando há item na fila; com a fila vazia a tela é idêntica ao desenho. Os cinco chips de serviço são os do desenho; o antigo "Tarefas agendadas" some porque a própria tabela de jobs mostra cada status. A régua dos medidores sem cota é relativa (andamento e falha: n/200; órfãos: arquivos/10.000); com `storage_quota_bytes` definida, Fotos mostra "X de cota".
- **M27, jobs**: nomes em português por mapa (`lib/master/health.ts`); job desconhecido aparece com o nome do cron sem o prefixo `mm-`. "Última execução" e as 8 bolinhas vêm de `cron.job_run_details` via `admin_health_history(8)`; sem `pg_cron` a tela mostra o aviso do runbook e a tabela vazia.
- **M28, Ator**: o desenho mostra e-mail. O servidor devolve o e-mail completo ao master e `a***@dominio` ao auditor (`admin_list_audit_v2` estendida, só aumenta chaves). O mesmo para o alvo quando é uma conta. Ação sem tradução aparece com o código gravado.
- **M28, Alvo**: título do evento, nome do plano, e-mail (mascarado como acima), código de cortesia; exportação mostra "Pagamentos · 74 linhas". Alvos de pagamento mostram o id gravado (o "#RV-2037" do desenho é fictício; o app não tem esse formato de número).
- **M28, vazio**: no desenho o vazio some com os filtros; no app o vazio mantém categorias e evento visíveis acima do aviso, senão a pessoa não consegue "trocar a categoria ou o evento" como o texto pede. O desenho de vazio continua idêntico em `/dev/revela`.
- **M28, paginação**: a barra do desenho é fixa no rodapé (`position: absolute`); no app ela acompanha a tabela (25 linhas passam da altura da tela). Sem mudança visual no desenho.
- **M28, filtro de Evento**: campo com lista do navegador (`datalist`) alimentada por `admin_audit_events` (eventos com registro na trilha, no máximo 200 mais recentes).
- **Auditoria por categoria**: as categorias são as do servidor (`audit_category_pattern`). `photo.hidden`, `photo.kept` e `photo.removed` não pertencem a nenhuma (só aparecem em "Todas"); decisão de produto se devem entrar em Admin.
- **M08**: mantida como está; só ganhou `requireRole("revelacoes")` e o botão "Revelar agora" fica só para o master (support e auditor leem). A folha é a mesma do painel do anfitrião (`RevealNowSheet`).
- **Formato de data**: `relWhen` mostrava "10 de set 14:22" (ICU do Node); corrigido para "10 set 14:22", como no desenho (afeta as outras telas do Master do mesmo jeito).
- **Código removido**: M09, M11 (`saude` antiga) e M13 (telas, registro, ids no CHECKLIST e evidências antigas), a página `/master/storage` e `ModerateComment`. `ui.tsx`, `.adm-*`, `admin.css` e `modules.ts` seguem porque Pessoas, Visão geral, Eventos, Pagamentos, Impressões e Configurações ainda os importam; a limpeza final é do último grupo.
