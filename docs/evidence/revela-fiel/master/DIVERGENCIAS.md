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

## 5. Impressões (M29/M30) e Configurações (M31)

- **Gênero**: o desenho escreve "anfitriã"/"convidada"; o banco não guarda gênero, então a tela mostra "anfitrião"/"convidado".
- **Código do pedido** (`IMP-7K2Q`): não existia; migration `20261111000500` cria `print_orders.seq` e `print_order_code()` (único, 4 símbolos). A busca da lista aceita o código.
- **Avançar status (M30.f1)** não pede motivo, como no desenho (a folha não é a `ActionSheet`, que sempre pede motivo); o servidor audita quem e quando. **Cancelar (M30.f2)** usa a `ActionSheet` (motivo 10 a 500, irreversível). O motivo do cancelamento agora vai só para a auditoria e para a linha do tempo, sem sobrescrever a nota interna.
- **Nota interna**: o desenho não tem botão; salva ao sair do campo (`admin_set_print_order_note`, só master, até 500, auditada sem o texto).
- **Fotos**: números = posição da foto na galeria do evento; "todas as fotos" conta as prontas do evento. Mostra 18 números e "+N".
- **Linha do tempo** de pedido cancelado (não desenhada): termina em "Cancelado" com quando, quem e motivo, sem os passos por fazer.
- **Pedido não encontrado / carregando** no app: título é o da área ("Impressões") e só o botão Voltar aparece (o desenho mostra também Cancelar e Marcar).
- **Paginação** fica no fluxo da página no app (no desenho é fixa no rodapé de 900 px).
- **Configurações**: nova chave "Álbum impresso" (`printed_album`) em um cartão "Recursos", fora do desenho (exigida pela decisão 2). Folhas para ligar chaves e para alterar suporte, empresa e folga reutilizam a M31.f1/f2 com textos paralelos. O botão Salvar só recusa valor inválido ao clicar (a linha vermelha avisa na hora); o servidor valida de novo.
- **Servidor**: `admin_set_setting` recusa `payments_env`, Pix fora de 5–1.440 e valores inválidos; motivo de 10 a 500 também em `admin_set_feature_flag`; a auditoria guarda valor antigo e novo dos parâmetros públicos e das chaves. Webhook: URL da função `payments-validapay-webhook`, estado "Ativo", "Sem eventos" ou "Com falhas" a partir de `validapay_webhook_inbox`.
- M14 (`MasterConfig`) e as telas antigas de impressões foram removidas.
