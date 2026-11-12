# Master Revela — inventário e prova visual

Referências: `design-system/revela/html/Master-*.html` e WebP correspondentes em `design-system/revela/telas/14-master/` (os arquivos fornecidos são WebP). Cada quadro tem 1440 × 900; a composição final tem 2880 × 900, app à esquerda e desenho à direita.

As caixas da seção de inventário confirmam que o elemento foi lido no HTML e confrontado com a fixture. Elas não declaram a rota real concluída: o estado por tela e suas divergências ficam na tabela abaixo. Dados de exemplo são inventariados para preservar a ordem; rotas reais substituem somente dados. Percentual pixelmatch é diagnóstico e não critério isolado de aprovação.

| Tela | Rota/estado real | Fixture vs desenho | Estado | Evidência | Ligação ao app / divergências |
|---|---|---|---|---|---|
| M00 Login | `/master (sem sessão)` | 0.04% | Pronta | [app e desenho](../evidence/revela/M00.png) | Login real sem sessão conferido; diferença de e-mail de teste e máscara nativa. |
| M01 Visão geral | `/master` | 0.30% | Pronta | [app e desenho](../evidence/revela/M01.png) | Rota real recapturada: quatro KPIs, seletor, cinco planos inclusive zero e últimos pagamentos; diferenças só de dados locais. |
| M02 Eventos | `/master/eventos` | 0.41% | Pronta | [app e desenho](../evidence/revela/M02.png) | Rota real conferida: Exportar CSV, seis filtros, oito colunas e seis eventos; diferenças só de dados/ordem. |
| M03 Planos e preços | `/master/planos` | 0.33% | Pronta | [app e desenho](../evidence/revela/M03.png) | Rota real recapturada com Casamento destacado na massa local e rascunho não publicado de R$ 199; estrutura/controles conferidos. |
| M04 Confirmar novo preço | `/master/planos → Publicar preços` | 0.20% | Pronta | [app e desenho](../evidence/revela/M04.png) | Fluxo real com motivo anterior, confirmação/TOTP, skeleton de fundo e botões conferidos; não foi publicado preço. |
| M05 Pagamentos | `/master/pagamentos` | 0.37% | Pronta | [app e desenho](../evidence/revela/M05.png) | Rota real saudável com seis pedidos e chevrons corrigidos; cenário de divergências preservado separadamente. |
| M06 Detalhe do pagamento | `/master/pagamentos/[id]` | 0.19% | Pronta | [app e desenho](../evidence/revela/M06.png) | Cinco pares de dados, externalTxid curto e Estornar conferidos. Anfitrião real e histórico factual via admin_master_payment_context; fatos ausentes ficam sem confirmação, nunca deduzidos de paidAt. |
| M07 Cortesias | `/master/codigos` | 0.23% | Pronta | [app e desenho](../evidence/revela/M07.png) | Estrutura real corrigida. Código escolhido ligado à nova RPC admin_master_create_code, com hash, auditoria, motivo e Sheet; RPC geradora antiga preservada. |
| M08 Revelações | `/master/revelacoes` | 0.29% | Pronta | [app e desenho](../evidence/revela/M08.png) | Reenviar falhas e folha com motivo ligados. Inscrições e exibições nativas registradas em reveal_native_notices, agregadas sem identificadores; histórico desconhecido mostra —. Notificação depende do navegador aberto, sem Web Push em segundo plano. |
| M09 Moderação | `/master/moderacao` | 0.16% | Pronta | [app e desenho](../evidence/revela/M09.png) | Quatro cartões e três ações por foto conferidos. Fotos privadas substituídas por placeholder por exigência expressa do usuário; conteúdo/razões são dados locais. |
| M10 Pessoas | `/master/pessoas` | 0.30% | Pronta | [app e desenho](../evidence/revela/M10.png) | Abas e chevrons corrigidos, sete colunas conferidas; navegação das três abas e CSV de equipe com três registros passaram. |
| M11 Storage e saúde | `/master/saude` | 0.21% | Pronta: estado de saúde | [app e desenho](../evidence/revela/M11.png) | Cinco serviços e dois medidores conferidos. MNote de cron local inativo é estado real de saúde, usando o kit permitido para estados de erro. |
| M12 LGPD | `/master/lgpd` | 0.24% | Pronta | [app e desenho](../evidence/revela/M12.png) | Rota real conferida: tabela e quatro linhas/ícones/chevrons iguais; dados reais de retenção 90 dias do encerramento e IP/backups não definidos. |
| M13 Auditoria | `/master/auditoria` | 0.35% | Pronta | [app e desenho](../evidence/revela/M13.png) | Rota autenticada conferida: tabela, cinco colunas e Exportar iguais; mais registros e identificadores de auditoria são dados locais. |
| M14 Configurações | `/master/configuracoes` | 0.22% | Pronta | [app e desenho](../evidence/revela/M14.png) | Três linhas e dois toggles de plataforma conferidos. Captura mostra rascunho local NÃO salvo para tornar o estado equivalente; estado do servidor preservado em states/M14-sem-alteracoes.png. |

## Moldura comum de M01 a M14

- [x] `.dsk`, `.mside`, `.mmain`, camada de grão; fundo, espaçamentos, bordas, raios e tipografia da referência.
- [x] Marca: símbolo, wordmark Revela e selo MASTER.
- [x] Menu com 12 itens na ordem: Visão geral, Eventos, Pessoas, Planos e preços, Pagamentos, Cortesias, Revelações, Moderação, Storage e saúde, LGPD, Auditoria, Configurações; ícones correspondentes e item atual destacado.
- [x] Rodapé da barra: avatar M, Marcos e Administrador (dados substituíveis).
- [x] Barra superior: ícone de busca, campo “Buscar evento, pessoa ou pagamento”, selo Produção com cadeado (ambiente substituível).

## Inventário por tela

Itens abaixo seguem a ordem do HTML. Campos informam valor/placeholder; a estrutura acima de cada lista cobre elementos sem texto (ícones, imagens, toggles, barras, conectores e contêineres).

### M00 — Login

Fonte: `Master-login.html`. Rota: `/master (sem sessão)`.

- [x] Fundo escuro com iluminação radial e grão; cartão central com borda e raio.
- [x] Símbolo Revela, wordmark e selo MASTER.
- [x] Campos de e-mail (ícone envelope) e senha (cadeado); 6 casas de OTP, quinta ativa; botão primário Entrar.

Texto e controles visíveis, em ordem:

- [x] 01. `span.mtag` — master
- [x] 02. `h1.rv-title` — Entrar no painel
- [x] 03. `p.rv-caption` — Acesso restrito. Toda ação fica registrada na auditoria.
- [x] 04. `input` — valor: marcos@revela.app
- [x] 05. `input` — valor: ••••••••••••
- [x] 06. `p.rv-caption` — Código do app autenticador
- [x] 07. `span` — 4
- [x] 08. `span` — 8
- [x] 09. `span` — 2
- [x] 10. `span` — 1
- [x] 11. `button.rv-btn.rv-btn--block.rv-btn--primary` — Entrar

### M01 — Visão geral

Fonte: `Master-visao.html`. Rota: `/master`.

- [x] Cabeçalho com Exportar/ícone download; quatro cartões KPI na ordem da referência.
- [x] Grade 3fr/2fr: Receita por dia com 30 barras, barra laranja, seis marcas do eixo; seletor 7 dias/30 dias.
- [x] Vendas por plano: cinco medidores, totais e barras; cartão Últimos pagamentos com Ver todos e tabela de três linhas/status.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Visão geral
- [x] 02. `p.rv-caption` — Novembro de 2026 · atualizado às 08:42
- [x] 03. `button.rv-btn.rv-btn--sm` — Exportar
- [x] 04. `span` — Receita do mês
- [x] 05. `b` — R$ 12.430
- [x] 06. `small` — +18% sobre outubro
- [x] 07. `span` — Eventos ativos
- [x] 08. `b` — 41
- [x] 09. `small` — 6 revelam hoje
- [x] 10. `span` — Fotos hoje
- [x] 11. `b` — 8.912
- [x] 12. `small` — pico às 22:40
- [x] 13. `span` — Pedidos pendentes
- [x] 14. `b` — 3
- [x] 15. `small` — Pix aguardando
- [x] 16. `h2.rv-title` — Receita por dia
- [x] 17. `span` — 7 dias
- [x] 18. `span.on` — 30 dias
- [x] 19. `span` — 5
- [x] 20. `span` — 10
- [x] 21. `span` — 15
- [x] 22. `span` — 20
- [x] 23. `span` — 25
- [x] 24. `span` — 30
- [x] 25. `h2.rv-title` — Vendas por plano
- [x] 26. `span` — Grátis
- [x] 27. `b` — 214
- [x] 28. `span` — Festa
- [x] 29. `b` — 38
- [x] 30. `span` — Celebração
- [x] 31. `b` — 22
- [x] 32. `span` — Casamento
- [x] 33. `b` — 31
- [x] 34. `span` — Grande
- [x] 35. `b` — 4
- [x] 36. `h2.rv-title` — Últimos pagamentos
- [x] 37. `a.link` — Ver todos
- [x] 38. `span` — Quando
- [x] 39. `span` — Evento
- [x] 40. `span` — Plano
- [x] 41. `span` — Método
- [x] 42. `span` — Valor
- [x] 43. `span` — Situação
- [x] 44. `span` — hoje 08:42
- [x] 45. `span` — Ana & Leo
- [x] 46. `span` — Casamento
- [x] 47. `span` — Pix
- [x] 48. `span` — R$ 189,00
- [x] 49. `em.st.st--ok` — Pago
- [x] 50. `span` — hoje 08:10
- [x] 51. `span` — 30 anos do Rafa
- [x] 52. `span` — Festa
- [x] 53. `span` — Cartão
- [x] 54. `span` — R$ 29,00
- [x] 55. `em.st.st--bad` — Recusado
- [x] 56. `span` — ontem 21:55
- [x] 57. `span` — Formatura Medicina
- [x] 58. `span` — Grande
- [x] 59. `span` — Pix
- [x] 60. `span` — R$ 349,00
- [x] 61. `em.st.st--wait` — Pendente

### M02 — Eventos

Fonte: `Master-eventos.html`. Rota: `/master/eventos`.

- [x] Cabeçalho Exportar CSV com ícone download; seis chips (Todos selecionado).
- [x] Tabela com oito colunas e seis linhas, borda/raio; chips de situação com verde/âmbar/bege/vermelho.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Eventos
- [x] 02. `p.rv-caption` — 263 eventos · 41 rolando agora
- [x] 03. `button.rv-btn.rv-btn--sm` — Exportar CSV
- [x] 04. `span.chip.on` — Todos
- [x] 05. `span.chip` — Rolando
- [x] 06. `span.chip` — Aguardando revelação
- [x] 07. `span.chip` — Revelados
- [x] 08. `span.chip` — Com denúncias
- [x] 09. `span.chip` — Excluídos
- [x] 10. `span` — Evento
- [x] 11. `span` — Organizador
- [x] 12. `span` — Categoria
- [x] 13. `span` — Plano
- [x] 14. `span` — Convidados
- [x] 15. `span` — Fotos
- [x] 16. `span` — Revela
- [x] 17. `span` — Situação
- [x] 18. `span` — Ana & Leo
- [x] 19. `span` — Ana Ribeiro
- [x] 20. `span` — Casamento
- [x] 21. `span` — Casamento
- [x] 22. `span` — 32 / 250
- [x] 23. `span` — 418
- [x] 24. `span` — dom 12:00
- [x] 25. `em.st.st--ok` — Rolando
- [x] 26. `span` — 30 anos do Rafa
- [x] 27. `span` — Rafael Lima
- [x] 28. `span` — Aniversário
- [x] 29. `span` — Festa
- [x] 30. `span` — 28 / 30
- [x] 31. `span` — 210
- [x] 32. `span` — seg 10:00
- [x] 33. `em.st.st--wait` — Quase cheio
- [x] 34. `span` — Formatura Medicina UFMT
- [x] 35. `span` — Comissão 2026
- [x] 36. `span` — Formatura
- [x] 37. `span` — Grande
- [x] 38. `span` — 412 / 500
- [x] 39. `span` — 5.920
- [x] 40. `span` — revelado
- [x] 41. `em.st.st--info` — Revelado
- [x] 42. `span` — Happy hour time Produto
- [x] 43. `span` — Lu Prado
- [x] 44. `span` — Corporativo
- [x] 45. `span` — Grátis
- [x] 46. `span` — 9 / 10
- [x] 47. `span` — 86
- [x] 48. `span` — revelado
- [x] 49. `em.st.st--info` — Revelado
- [x] 50. `span` — Chá da Maria
- [x] 51. `span` — Júlia Alves
- [x] 52. `span` — Outro
- [x] 53. `span` — Celebração
- [x] 54. `span` — 41 / 100
- [x] 55. `span` — 377
- [x] 56. `span` — amanhã 18:00
- [x] 57. `em.st.st--bad` — 2 denúncias
- [x] 58. `span` — Bodas de prata
- [x] 59. `span` — Sônia Prado
- [x] 60. `span` — Casamento
- [x] 61. `span` — Casamento
- [x] 62. `span` — 0 / 250
- [x] 63. `span` — 0
- [x] 64. `span` — sáb 23:00
- [x] 65. `em.st.st--wait` — Pagamento pendente

### M03 — Planos e preços

Fonte: `Master-planos.html`. Rota: `/master/planos`.

- [x] Cabeçalho Histórico de preços com ícone histórico.
- [x] Tabela de cinco planos: nome/código, preço com prefixo R$, convidados, poses, toggles Sandbox/Produção, Destacar/Destaque e menu reticências.
- [x] Casamento alterado com contorno laranja, preço anterior riscado, linha destacada.
- [x] Nota de proteção com ícone escudo; Novo plano com ícone mais.
- [x] Prévia no celular com recorte horizontal de cartões de planos, seleção Casamento, métodos Pix/cartão e cadeado ValidaPay, botão Continuar.
- [x] Barra fixa inferior: editar, alteração pendente, resumo do diff, Descartar e Publicar preços/ícone check.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Planos e preços
- [x] 02. `p.rv-caption` — Altere o valor direto na tabela. A prévia mostra o paywall como o anfitrião vai ver.
- [x] 03. `button.rv-btn.rv-btn--sm` — Histórico de preços
- [x] 04. `span` — Plano
- [x] 05. `span` — Preço
- [x] 06. `span` — Convidados
- [x] 07. `span` — Poses
- [x] 08. `span` — Sandbox
- [x] 09. `span` — Produção
- [x] 10. `span` — Paywall
- [x] 11. `b` — Grátis
- [x] 12. `small.rv-caption` — gratis
- [x] 13. `i` — R$
- [x] 14. `input` — valor: 0,00
- [x] 15. `input` — valor: 10
- [x] 16. `input` — valor: 10
- [x] 17. `a.link` — Destacar
- [x] 18. `b` — Festa
- [x] 19. `small.rv-caption` — festa
- [x] 20. `i` — R$
- [x] 21. `input` — valor: 29,00
- [x] 22. `input` — valor: 30
- [x] 23. `input` — valor: 24
- [x] 24. `a.link` — Destacar
- [x] 25. `b` — Celebração
- [x] 26. `small.rv-caption` — celebracao
- [x] 27. `i` — R$
- [x] 28. `input` — valor: 89,00
- [x] 29. `input` — valor: 100
- [x] 30. `input` — valor: 24
- [x] 31. `a.link` — Destacar
- [x] 32. `b` — Casamento
- [x] 33. `small.rv-caption` — casamento
- [x] 34. `i` — R$
- [x] 35. `input` — valor: 199,00
- [x] 36. `small.was` — era R$ 189,00
- [x] 37. `input` — valor: 250
- [x] 38. `input` — valor: 36
- [x] 39. `em.st.st--info` — Destaque
- [x] 40. `b` — Grande
- [x] 41. `small.rv-caption` — grande
- [x] 42. `i` — R$
- [x] 43. `input` — valor: 349,00
- [x] 44. `input` — valor: 500
- [x] 45. `input` — valor: livre
- [x] 46. `a.link` — Destacar
- [x] 47. `span` — Preço novo vale só para compras novas. Quem já pagou mantém o plano e os limites que comprou. Pedido Pix aberto mantém o valor cotado.
- [x] 48. `button.rv-btn.rv-btn--text` — Novo plano
- [x] 49. `p.rv-caption` — Prévia no celular
- [x] 50. `h3.rv-title` — Escolha o plano
- [x] 51. `p.rv-caption` — Pague uma vez por evento.
- [x] 52. `span.rv-plan__tier` — Grátis
- [x] 53. `span.rv-plan__price` — Grátis
- [x] 54. `span.rv-plan__note` — 10 convidados10 poses cada
- [x] 55. `span.rv-plan__tier` — Festa
- [x] 56. `span.rv-plan__price` — R$ 29
- [x] 57. `span.rv-plan__note` — 30 convidados24 poses cada
- [x] 58. `span.rv-plan__tier` — Celebração
- [x] 59. `span.rv-plan__price` — R$ 89
- [x] 60. `span.rv-plan__note` — 100 convidados24 poses cada
- [x] 61. `span.rv-plan__tier` — Casamento
- [x] 62. `span.rv-plan__price` — R$ 199
- [x] 63. `span.rv-plan__note` — 250 convidados36 poses cada
- [x] 64. `span.rv-plan__tier` — Grande
- [x] 65. `span.rv-plan__price` — R$ 349
- [x] 66. `span.rv-plan__note` — 500 convidadosposes livres
- [x] 67. `span` — Pix ou cartão
- [x] 68. `span` — ValidaPay
- [x] 69. `span.rv-btn.rv-btn--primary.rv-btn--block` — Continuar · R$ 199
- [x] 70. `b` — 1 alteração não publicada
- [x] 71. `span.rv-caption` — Casamento: R$ 189,00 → R$ 199,00
- [x] 72. `button.rv-btn.rv-btn--sm` — Descartar
- [x] 73. `button.rv-btn.rv-btn--sm.rv-btn--primary` — Publicar preços

### M04 — Confirmar novo preço

Fonte: `Master-plano-publicar.html`. Rota: `/master/planos → Publicar preços`.

- [x] Moldura/planos ao fundo escurecidos; cartão de planos vazio e prévia do celular sob modal.
- [x] Modal central: título, legenda, bloco preço anterior riscado → novo preço laranja.
- [x] Grupo de três linhas com ícones check, Pix e histórico.
- [x] Seis casas OTP, quarta ativa; Cancelar e Publicar R$ 199.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Planos e preços
- [x] 02. `p.rv-caption` — Altere o valor direto na tabela. A prévia mostra o paywall como o anfitrião vai ver.
- [x] 03. `h3.rv-title` — Escolha o plano
- [x] 04. `p.rv-caption` — Pague uma vez por evento.
- [x] 05. `span.rv-plan__tier` — Grátis
- [x] 06. `span.rv-plan__price` — Grátis
- [x] 07. `span.rv-plan__note` — 10 convidados10 poses cada
- [x] 08. `span.rv-plan__tier` — Festa
- [x] 09. `span.rv-plan__price` — R$ 29
- [x] 10. `span.rv-plan__note` — 30 convidados24 poses cada
- [x] 11. `span.rv-plan__tier` — Celebração
- [x] 12. `span.rv-plan__price` — R$ 89
- [x] 13. `span.rv-plan__note` — 100 convidados24 poses cada
- [x] 14. `span.rv-plan__tier` — Casamento
- [x] 15. `span.rv-plan__price` — R$ 199
- [x] 16. `span.rv-plan__note` — 250 convidados36 poses cada
- [x] 17. `span.rv-plan__tier` — Grande
- [x] 18. `span.rv-plan__price` — R$ 349
- [x] 19. `span.rv-plan__note` — 500 convidadosposes livres
- [x] 20. `span` — Pix ou cartão
- [x] 21. `span` — ValidaPay
- [x] 22. `span.rv-btn.rv-btn--primary.rv-btn--block` — Continuar · R$ 199
- [x] 23. `h2.rv-title` — Publicar novo preço?
- [x] 24. `p.rv-caption` — Entra no paywall e no checkout ValidaPay assim que você confirmar.
- [x] 25. `span.rv-caption` — Casamento
- [x] 26. `b.was` — R$ 189,00
- [x] 27. `span.rv-caption` — Novo preço
- [x] 28. `b` — R$ 199,00
- [x] 29. `div.rv-row__text` — 31 eventos já pagos continuam iguais
- [x] 30. `div.rv-row__text` — 2 Pix abertos mantêm R$ 189,00 até expirar
- [x] 31. `div.rv-row__text` — Fica registrado na auditoria com seu nome
- [x] 32. `p.rv-caption` — Código do app autenticador
- [x] 33. `span` — 7
- [x] 34. `span` — 1
- [x] 35. `span` — 9
- [x] 36. `button.rv-btn.rv-btn--block` — Cancelar
- [x] 37. `button.rv-btn.rv-btn--block.rv-btn--primary` — Publicar R$ 199

### M05 — Pagamentos

Fonte: `Master-pagamentos.html`. Rota: `/master/pagamentos`.

- [x] Cabeçalho Conciliar agora/ícone refresh e Exportar/download; quatro cartões KPI.
- [x] Seis chips de filtro; tabela de oito colunas com seis linhas/status e chevrons finais.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Pagamentos
- [x] 02. `p.rv-caption` — Cobranças da ValidaPay, conciliadas com os pedidos do Revela
- [x] 03. `button.rv-btn.rv-btn--sm` — Conciliar agora
- [x] 04. `button.rv-btn.rv-btn--sm` — Exportar
- [x] 05. `span` — Pago no mês
- [x] 06. `b` — R$ 12.430
- [x] 07. `small` — 71 pedidos
- [x] 08. `span` — Pendentes
- [x] 09. `b` — R$ 727
- [x] 10. `small` — 3 Pix aguardando
- [x] 11. `span` — Recusados
- [x] 12. `b` — 9
- [x] 13. `small` — cartão sem confirmação
- [x] 14. `span` — Para estornar
- [x] 15. `b` — 1
- [x] 16. `small` — pago em duplicidade
- [x] 17. `span.chip.on` — Todos
- [x] 18. `span.chip` — Pix
- [x] 19. `span.chip` — Cartão
- [x] 20. `span.chip` — Pendentes
- [x] 21. `span.chip` — Recusados
- [x] 22. `span.chip` — Estornos
- [x] 23. `span` — Quando
- [x] 24. `span` — Pedido
- [x] 25. `span` — Evento
- [x] 26. `span` — Plano
- [x] 27. `span` — Método
- [x] 28. `span` — Valor
- [x] 29. `span` — Situação
- [x] 30. `span` — hoje 08:42
- [x] 31. `span` — #RV-2041
- [x] 32. `span` — Ana & Leo
- [x] 33. `span` — Casamento
- [x] 34. `span` — Pix
- [x] 35. `span` — R$ 189,00
- [x] 36. `em.st.st--ok` — Pago
- [x] 37. `span` — hoje 08:10
- [x] 38. `span` — #RV-2040
- [x] 39. `span` — 30 anos do Rafa
- [x] 40. `span` — Festa
- [x] 41. `span` — Cartão •4417
- [x] 42. `span` — R$ 29,00
- [x] 43. `em.st.st--bad` — Recusado
- [x] 44. `span` — ontem 21:55
- [x] 45. `span` — #RV-2039
- [x] 46. `span` — Formatura Medicina
- [x] 47. `span` — Grande
- [x] 48. `span` — Pix
- [x] 49. `span` — R$ 349,00
- [x] 50. `em.st.st--wait` — Pendente
- [x] 51. `span` — ontem 19:20
- [x] 52. `span` — #RV-2038
- [x] 53. `span` — Chá da Maria
- [x] 54. `span` — Celebração
- [x] 55. `span` — Cartão •0091
- [x] 56. `span` — R$ 89,00
- [x] 57. `em.st.st--ok` — Pago
- [x] 58. `span` — ontem 18:02
- [x] 59. `span` — #RV-2037
- [x] 60. `span` — Bodas de prata
- [x] 61. `span` — Casamento
- [x] 62. `span` — Pix
- [x] 63. `span` — R$ 189,00
- [x] 64. `em.st.st--bad` — Estornar
- [x] 65. `span` — 07 nov 15:41
- [x] 66. `span` — #RV-2036
- [x] 67. `span` — Aniversário Theo
- [x] 68. `span` — Festa
- [x] 69. `span` — Pix
- [x] 70. `span` — R$ 29,00
- [x] 71. `em.st.st--info` — Estornado

### M06 — Detalhe do pagamento

Fonte: `Master-pagamento-detalhe.html`. Rota: `/master/pagamentos/[id]`.

- [x] Cabeçalho com pedido, evento/organizador/plano e Voltar com chevron esquerdo.
- [x] Grade 3fr/2fr: Linha do tempo com cinco pontos (quatro verdes, um vermelho) e conectores verticais.
- [x] Cartão Dados com grupo de cinco pares legenda/valor.
- [x] Nota de duplicidade com alerta; Estornar/refresh primário e Consultar/busca secundário.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Pedido #RV-2037
- [x] 02. `p.rv-caption` — Bodas de prata · Sônia Prado · Casamento
- [x] 03. `button.rv-btn.rv-btn--sm` — Voltar
- [x] 04. `h2.rv-title` — Linha do tempo
- [x] 05. `b` — Pedido criado
- [x] 06. `span.rv-caption` — ontem 17:58 · R$ 189,00 cotado no banco
- [x] 07. `b` — Cobrança Pix criada na ValidaPay
- [x] 08. `span.rv-caption` — ontem 17:58 · cha_8f2…a91 · expira em 15 min
- [x] 09. `b` — Webhook payment.success recebido
- [x] 10. `span.rv-caption` — ontem 18:02 · assinatura válida
- [x] 11. `b` — Plano Casamento liberado
- [x] 12. `span.rv-caption` — ontem 18:02 · 250 convidados, 36 poses
- [x] 13. `b` — Segundo Pix pago para o mesmo pedido
- [x] 14. `span.rv-caption` — ontem 18:05 · cha_1c0…77e
- [x] 15. `h2.rv-title` — Dados
- [x] 16. `span.rv-row__meta` — Valor
- [x] 17. `span.rv-row__meta` — Método
- [x] 18. `span.rv-row__meta` — Ambiente
- [x] 19. `span.rv-row__meta` — Cobrança ValidaPay
- [x] 20. `span.rv-row__meta` — externalTxid
- [x] 21. `span` — Pago duas vezes. O plano já está liberado pela primeira cobrança. Estorne a segunda.
- [x] 22. `button.rv-btn.rv-btn--sm.rv-btn--primary` — Estornar
- [x] 23. `button.rv-btn.rv-btn--sm` — Consultar

### M07 — Cortesias

Fonte: `Master-cortesias.html`. Rota: `/master/codigos`.

- [x] Grade tabela 1.6fr / formulário 1fr. Tabela de cinco colunas, quatro códigos e chips de situação.
- [x] Cartão Novo código: nome/ícone tag, plano/ícone ticket, usos e data lado a lado; Criar código primário.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Cortesias
- [x] 02. `p.rv-caption` — Códigos que liberam um plano sem pagamento
- [x] 03. `span` — Código
- [x] 04. `span` — Plano
- [x] 05. `span` — Usos
- [x] 06. `span` — Validade
- [x] 07. `span` — Situação
- [x] 08. `span` — NOIVOS-VJ26
- [x] 09. `span` — Casamento
- [x] 10. `span` — 3 de 10
- [x] 11. `span` — 31 dez 2026
- [x] 12. `em.st.st--ok` — Ativo
- [x] 13. `span` — PARCEIRO-CBA
- [x] 14. `span` — Celebração
- [x] 15. `span` — 12 de 50
- [x] 16. `span` — 30 jun 2027
- [x] 17. `em.st.st--ok` — Ativo
- [x] 18. `span` — INFLU-BIA
- [x] 19. `span` — Grande
- [x] 20. `span` — 1 de 1
- [x] 21. `span` — —
- [x] 22. `em.st.st--info` — Esgotado
- [x] 23. `span` — TESTE-INTERNO
- [x] 24. `span` — Festa
- [x] 25. `span` — 0 de 5
- [x] 26. `span` — 05 nov 2026
- [x] 27. `em.st.st--bad` — Vencido
- [x] 28. `h2.rv-title` — Novo código
- [x] 29. `input` — valor: BUFFET-JARDIM
- [x] 30. `input` — valor: Casamento · 250 convidados
- [x] 31. `input` — valor: 20 usos
- [x] 32. `input` — valor: 31/03/2027
- [x] 33. `button.rv-btn.rv-btn--block.rv-btn--primary` — Criar código

### M08 — Revelações

Fonte: `Master-revelacoes.html`. Rota: `/master/revelacoes`.

- [x] Tabela com sete colunas, cinco linhas, chips Na fila/Revelado; três Revelar agora e Reenviar falhas/refresh.
- [x] Nota abaixo com ícone sino e texto sobre avisos por e-mail.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Revelações
- [x] 02. `p.rv-caption` — Fila do relógio do servidor. Cada evento revela uma vez só.
- [x] 03. `span` — Revela
- [x] 04. `span` — Evento
- [x] 05. `span` — Fotos
- [x] 06. `span` — Avisos no celular
- [x] 07. `span` — Avisos por e-mail
- [x] 08. `span` — Situação
- [x] 09. `span` — hoje 12:00
- [x] 10. `span` — Ana & Leo
- [x] 11. `span` — 418
- [x] 12. `span` — 29 inscritos
- [x] 13. `span` — 21 e-mails
- [x] 14. `em.st.st--wait` — Na fila
- [x] 15. `button.rv-btn.rv-btn--sm` — Revelar agora
- [x] 16. `span` — hoje 10:00
- [x] 17. `span` — Formatura Medicina UFMT
- [x] 18. `span` — 5.920
- [x] 19. `span` — 388 enviados
- [x] 20. `span` — 301 enviados · 4 falharam
- [x] 21. `em.st.st--ok` — Revelado
- [x] 22. `button.rv-btn.rv-btn--sm` — Reenviar falhas
- [x] 23. `span` — hoje 09:00
- [x] 24. `span` — Happy hour time Produto
- [x] 25. `span` — 86
- [x] 26. `span` — 9 enviados
- [x] 27. `span` — 6 enviados
- [x] 28. `em.st.st--ok` — Revelado
- [x] 29. `span` — amanhã 18:00
- [x] 30. `span` — Chá da Maria
- [x] 31. `span` — 377
- [x] 32. `span` — 35 inscritos
- [x] 33. `span` — 30 e-mails
- [x] 34. `em.st.st--wait` — Na fila
- [x] 35. `button.rv-btn.rv-btn--sm` — Revelar agora
- [x] 36. `span` — seg 10:00
- [x] 37. `span` — 30 anos do Rafa
- [x] 38. `span` — 210
- [x] 39. `span` — 22 inscritos
- [x] 40. `span` — 18 e-mails
- [x] 41. `em.st.st--wait` — Na fila
- [x] 42. `button.rv-btn.rv-btn--sm` — Revelar agora
- [x] 43. `span` — Quem não instalou o app recebe o aviso por e-mail, se deixou o endereço ao entrar. O e-mail sai pela Brevo.

### M09 — Moderação

Fonte: `Master-moderacao.html`. Rota: `/master/moderacao`.

- [x] Três chips de abas, Fotos selecionada.
- [x] Grade de quatro cartões com imagens de referência (balões/disco, brindes, bolo, balões), recorte e raio superior.
- [x] Em cada cartão: evento, nº denúncias vermelho, razão, Manter, Esconder, botão ícone lixeira vermelho.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Moderação
- [x] 02. `p.rv-caption` — Denúncias de todos os eventos que os anfitriões ainda não resolveram
- [x] 03. `span.chip.on` — Fotos 4
- [x] 04. `span.chip` — Comentários 7
- [x] 05. `span.chip` — Participantes bloqueados
- [x] 06. `b` — Chá da Maria
- [x] 07. `span.rv-caption` — 3 denúncias
- [x] 08. `span.rv-caption` — Não quero aparecer nesta foto
- [x] 09. `button.rv-btn.rv-btn--sm` — Manter
- [x] 10. `button.rv-btn.rv-btn--sm` — Esconder
- [x] 11. `b` — Chá da Maria
- [x] 12. `span.rv-caption` — 2 denúncias
- [x] 13. `span.rv-caption` — Foto constrangedora
- [x] 14. `button.rv-btn.rv-btn--sm` — Manter
- [x] 15. `button.rv-btn.rv-btn--sm` — Esconder
- [x] 16. `b` — 30 anos do Rafa
- [x] 17. `span.rv-caption` — 1 denúncias
- [x] 18. `span.rv-caption` — Outro motivo
- [x] 19. `button.rv-btn.rv-btn--sm` — Manter
- [x] 20. `button.rv-btn.rv-btn--sm` — Esconder
- [x] 21. `b` — Formatura Medicina
- [x] 22. `span.rv-caption` — 4 denúncias
- [x] 23. `span.rv-caption` — Conteúdo impróprio
- [x] 24. `button.rv-btn.rv-btn--sm` — Manter
- [x] 25. `button.rv-btn.rv-btn--sm` — Esconder

### M10 — Pessoas

Fonte: `Master-pessoas.html`. Rota: `/master/pessoas`.

- [x] Exportar/download no cabeçalho; seletor de três abas (Organizadores ativa).
- [x] Tabela com sete colunas (última sem título), cinco linhas e chevrons finais.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Pessoas
- [x] 02. `p.rv-caption` — Organizadores, convidados e contas da equipe
- [x] 03. `button.rv-btn.rv-btn--sm` — Exportar
- [x] 04. `span.on` — Organizadores 198
- [x] 05. `span` — Convidados 7.412
- [x] 06. `span` — Equipe 3
- [x] 07. `span` — Nome
- [x] 08. `span` — E-mail
- [x] 09. `span` — Entrou com
- [x] 10. `span` — Eventos
- [x] 11. `span` — Gasto total
- [x] 12. `span` — Desde
- [x] 13. `span` — Ana Ribeiro
- [x] 14. `span` — ana.ribeiro@email.com
- [x] 15. `span` — Google
- [x] 16. `span` — 1
- [x] 17. `span` — R$ 189,00
- [x] 18. `span` — nov 2026
- [x] 19. `span` — Comissão Medicina 2026
- [x] 20. `span` — formatura.med@email.com
- [x] 21. `span` — Google
- [x] 22. `span` — 1
- [x] 23. `span` — R$ 349,00
- [x] 24. `span` — out 2026
- [x] 25. `span` — Rafael Lima
- [x] 26. `span` — rafa.lima@email.com
- [x] 27. `span` — Link por e-mail
- [x] 28. `span` — 2
- [x] 29. `span` — R$ 29,00
- [x] 30. `span` — out 2026
- [x] 31. `span` — Júlia Alves
- [x] 32. `span` — julia.alves@email.com
- [x] 33. `span` — Google
- [x] 34. `span` — 3
- [x] 35. `span` — R$ 207,00
- [x] 36. `span` — set 2026
- [x] 37. `span` — Lu Prado
- [x] 38. `span` — lu.prado@email.com
- [x] 39. `span` — Google
- [x] 40. `span` — 4
- [x] 41. `span` — R$ 0,00
- [x] 42. `span` — set 2026

### M11 — Storage e saúde

Fonte: `Master-saude.html`. Rota: `/master/saude`.

- [x] Grade 3fr/2fr: cartão Serviços com cinco linhas em grupo; ícones servidor, foto, moeda, brilho e envelope; quatro status Normal e um Atenção.
- [x] Cartão Armazenamento: medidor Fotos e medidor Fila de exclusão com contagens e legendas.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Storage e saúde
- [x] 02. `p.rv-caption` — Situação dos serviços agora
- [x] 03. `h2.rv-title` — Serviços
- [x] 04. `span.rv-row__meta` — latência 38 ms
- [x] 05. `em.st.st--ok` — Normal
- [x] 06. `span.rv-row__meta` — upload médio 1,8 s
- [x] 07. `em.st.st--ok` — Normal
- [x] 08. `span.rv-row__meta` — último evento há 4 min
- [x] 09. `em.st.st--ok` — Normal
- [x] 10. `span.rv-row__meta` — próxima às 12:00
- [x] 11. `em.st.st--ok` — Normal
- [x] 12. `span.rv-row__meta` — 4 falhas na última hora
- [x] 13. `em.st.st--wait` — Atenção
- [x] 14. `h2.rv-title` — Armazenamento
- [x] 15. `span` — Fotos
- [x] 16. `b` — 412 de 1000
- [x] 17. `p.rv-caption` — 412 GB de 1 TB · 97 mil fotos
- [x] 18. `span` — Fila de exclusão
- [x] 19. `b` — 3 de 100
- [x] 20. `p.rv-caption` — 3 eventos aguardando limpeza do storage

### M12 — LGPD

Fonte: `Master-lgpd.html`. Rota: `/master/lgpd`.

- [x] Grade tabela 1.6fr / Retenção 1fr. Tabela de cinco colunas, três pedidos e chips Em andamento/Concluído.
- [x] Retenção: grupo de quatro linhas com ícone relógio em todas, legenda, duração e chevron.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — LGPD
- [x] 02. `p.rv-caption` — Pedidos de exclusão e prazos de retenção
- [x] 03. `span` — Pedido
- [x] 04. `span` — Quem
- [x] 05. `span` — Tipo
- [x] 06. `span` — Prazo
- [x] 07. `span` — Situação
- [x] 08. `span` — 08 nov
- [x] 09. `span` — rafa.lima@email.com
- [x] 10. `span` — Excluir conta
- [x] 11. `span` — 8 dez
- [x] 12. `em.st.st--wait` — Em andamento
- [x] 13. `span` — 06 nov
- [x] 14. `span` — Convidado de Ana & Leo
- [x] 15. `span` — Apagar meus dados
- [x] 16. `span` — 6 dez
- [x] 17. `em.st.st--ok` — Concluído
- [x] 18. `span` — 02 nov
- [x] 19. `span` — julia.alves@email.com
- [x] 20. `span` — Exportar dados
- [x] 21. `span` — 2 dez
- [x] 22. `em.st.st--ok` — Concluído
- [x] 23. `h2.rv-title` — Retenção
- [x] 24. `span.rv-row__meta` — Fotos depois da revelação
- [x] 25. `span.rv-row__meta` — Evento que nunca revelou
- [x] 26. `span.rv-row__meta` — Hash de IP nos logs
- [x] 27. `span.rv-row__meta` — Backups

### M13 — Auditoria

Fonte: `Master-auditoria.html`. Rota: `/master/auditoria`.

- [x] Exportar/download no cabeçalho; tabela com cinco colunas e seis registros.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Auditoria
- [x] 02. `p.rv-caption` — Toda ação sensível, só inserção
- [x] 03. `button.rv-btn.rv-btn--sm` — Exportar
- [x] 04. `span` — Quando
- [x] 05. `span` — Quem
- [x] 06. `span` — Ação
- [x] 07. `span` — Alvo
- [x] 08. `span` — Detalhe
- [x] 09. `span` — hoje 08:51
- [x] 10. `span` — Marcos (master)
- [x] 11. `span` — plan.price_changed
- [x] 12. `span` — Casamento
- [x] 13. `span` — R$ 189,00 → R$ 199,00
- [x] 14. `span` — hoje 08:42
- [x] 15. `span` — sistema
- [x] 16. `span` — entitlement.granted
- [x] 17. `span` — Ana & Leo
- [x] 18. `span` — Casamento via Pix #RV-2041
- [x] 19. `span` — hoje 08:30
- [x] 20. `span` — Ana Ribeiro
- [x] 21. `span` — photo.hidden
- [x] 22. `span` — Ana & Leo
- [x] 23. `span` — foto 3f1… · 3 denúncias
- [x] 24. `span` — hoje 07:12
- [x] 25. `span` — Marcos (master)
- [x] 26. `span` — courtesy.created
- [x] 27. `span` — BUFFET-JARDIM
- [x] 28. `span` — Casamento · 20 usos
- [x] 29. `span` — ontem 18:05
- [x] 30. `span` — sistema
- [x] 31. `span` — payment.needs_refund
- [x] 32. `span` — #RV-2037
- [x] 33. `span` — segunda cobrança paga
- [x] 34. `span` — ontem 17:40
- [x] 35. `span` — Júlia Alves
- [x] 36. `span` — participant.blocked
- [x] 37. `span` — Chá da Maria
- [x] 38. `span` — 1 convidado

### M14 — Configurações

Fonte: `Master-config.html`. Rota: `/master/configuracoes`.

- [x] Salvar/check primário no cabeçalho; grade 3fr/2fr ValidaPay/Plataforma.
- [x] ValidaPay: Ambiente e seletor Sandbox/Produção (Produção ativa); grupo Pix, Cartão, Webhook, Checkout; ícones Pix/cartão/moeda/cadeado, toggles e status Ativo.
- [x] Plataforma: cinco linhas com ícones foto/foto/envelope/comentário/sino; três pares legenda/valor com chevron e dois toggles ativos.

Texto e controles visíveis, em ordem:

- [x] 01. `h1.rv-title-lg` — Configurações
- [x] 02. `p.rv-caption` — Pagamento, avisos e recursos da plataforma
- [x] 03. `button.rv-btn.rv-btn--sm.rv-btn--primary` — Salvar
- [x] 04. `h2.rv-title` — ValidaPay
- [x] 05. `p.rv-caption` — Ambiente
- [x] 06. `span` — Sandbox
- [x] 07. `span.on` — Produção
- [x] 08. `span.rv-row__meta` — QR e copia e cola · expira em 15 min
- [x] 09. `span.rv-row__meta` — Só com confirmação do banco (3DS). Sua conta ainda não liberou.
- [x] 10. `span.rv-row__meta` — assinatura HMAC válida · último às 08:42
- [x] 11. `em.st.st--ok` — Ativo
- [x] 12. `div.rv-row__text` — Checkout ligado para anfitriões
- [x] 13. `h2.rv-title` — Plataforma
- [x] 14. `span.rv-row__meta` — Teto de fotos por evento
- [x] 15. `span.rv-row__meta` — Tamanho máximo da foto
- [x] 16. `span.rv-row__meta` — Remetente dos avisos
- [x] 17. `div.rv-row__text` — Comentários nas fotos
- [x] 18. `div.rv-row__text` — Aviso de revelação por e-mail

## Divergências verificadas e decisões de ligação

- Inventário: 839 folhas de texto/controle nos 15 HTMLs originais; após retirar 252 repetições da moldura, 587 folhas numeradas abaixo, com a moldura compartilhada descrita uma vez. As caixas acima significam inventário/fixture conferidos; não aprovam os dados e as ações da rota real.
- Recaptura das 15 fixtures após correção de fonte e ícones: HTTP 200, 0,04%–0,41%, arquivos em [fixtures](../evidence/revela/fixtures/). A família carregada é `Schibsted Grotesk Variable`, também usada no token. M06/M09 tiveram geometria reconferida; percentual não substitui inspeção visual.
- M00: o mascaramento nativo de senha difere do texto de exemplo; não se desenham credenciais reais como texto. M00 é, por definição, captura sem sessão.
- A evidência principal M00–M14 exige navegação por `/master/**` em Supabase **local**, JWT validado e papel master ativo. As fixtures não substituem essa prova. Nenhum Supabase remoto, produção, Vercel ou PR faz parte da execução.
- Ligações finais: M01 inclui planos com zero vendas; M08 inclui reenvio auditado e observações nativas; M09 mantém placeholders privados e três ações auditadas; M14 inclui limites, remetente e toggles reais. Validação local e evidências não representam implantação remota.

## Ligação de cada tela ao app e ao banco

Todas as páginas reais chamam `requireMaster()`; `masterAccess()` valida JWT por `getUser()`, claim master e `is_master()`. Leituras negadas (`MM004`) usam `MState` de permissão. RPCs existentes não são alteradas; novos contratos são migrations aditivas.

| Tela | Menu / rota | Leitura e parâmetros principais | Campos / ações ligados ou lacuna conhecida |
|---|---|---|---|
| M00 | Sem menu; `/master` sem sessão | Auth `signInWithPassword`, MFA/TOTP; autorização no servidor | E-mail, senha, OTP e Entrar. Native password mask. |
| M01 | `visao`; `/master?dias=7/30` | `admin_overview(p_days)`; `admin_payments_summary()`; `admin_list_payments(p_limit=200)` | KPIs, barras de receita, vendas por plano, últimos três pagamentos, período e `admin_export_csv(p_kind=visao,p_filters)`. Planos sem venda não aparecem na versão auditada. |
| M02 | `eventos`; `/master/eventos?f=&q=&p=` | `admin_events_board(p_filter,p_search≤80,p_limit=25,p_offset)` | Oito colunas, seis filtros, status, busca antes da paginação, exportação CSV. |
| M03 | `planos`; `/master/planos` | `admin_list_plans()`; `get_public_settings()`; `admin_list_payments(p_limit=200)` | Preço/limites/toggles/destaque, prévia e histórico; publicação via M04. |
| M04 | `planos`; folha de M03 | `admin_publish_plans(p_changes,p_reason)` com AAL2 | Motivo 10–500 em etapa anterior, diff, contadores de impacto, TOTP, cancelar/publicar. A prévia da evidência não efetiva publicação. |
| M05 | `pagamentos`; `/master/pagamentos?f=` | `admin_payments_summary()`; `admin_list_payments(p_limit=200)`; `admin_payment_divergences()` | KPIs, seis filtros, tabela, conciliação e CSV; alertas só quando há divergência. |
| M06 | `pagamentos`; `/master/pagamentos/[id]` | `admin_master_payment_context(p_order)`; `admin_payment_divergences()` | Pedido/dados/linha do tempo, voltar/consultar; estorno via RPC de reembolso, motivo e Sheet. Detalhe consultado diretamente por UUID, inclusive além dos 500 pedidos mais recentes. |
| M07 | `cortesias`; `/master/codigos` | `admin_list_codes()`; `admin_list_plans()`; `admin_list_events(p_limit=100,p_status=ativo)` | Código mascarado, plano/usos/validade/status; criar/revogar e cortesia direta com RPCs auditadas. Código completo só na resposta de criação. |
| M08 | `revelacoes`; `/master/revelacoes` | `admin_reveals_board(p_limit=100)` | Data/evento/fotos/e-mail/status; `admin_reveal_now(p_event,p_reason)` em Sheet. Contagens via admin_master_native_notice_counts; reenvio auditado via admin_master_retry_reveal_emails. |
| M09 | `moderacao`; `/master/moderacao?aba=` | `admin_moderation_queue()` | Abas fotos/comentários/bloqueados; fotos privadas são metadados. `moderate_comment(p_comment,p_action,p_reason)` em Sheet. Ações das fotos do desenho ausentes na versão auditada. |
| M10 | `pessoas`; `/master/pessoas?aba=&q=&p=` | Nova `admin_master_people(p_tab,p_limit=25,p_offset,p_search≤80)` | Organizadores/convidados/equipe, contagens e paginação; total gasto agregado completo; equipe deduplicada; e-mails mascarados e gasto nulo para staff não master. Chevron abre eventos do organizador; CSV auditado com contrato novo para equipe. |
| M11 | `saude`; `/master/saude` | `admin_health()`; `admin_dashboard_metrics()`; `admin_overview(p_days=7)`; `admin_reveals_board(p_limit=200)`; `platform_settings.storage_quota_bytes` | Cinco serviços e dois medidores do desenho; bytes/arquivos, fotos prontas, fila. Cota ausente é explicitada; não inventa capacidade. |
| M12 | `lgpd`; `/master/lgpd` | `admin_lgpd_requests()`; nova `admin_master_retention()` | Solicitações reais (exclusão de conta), prazo real 15 dias; quatro linhas de retenção com detalhes somente leitura. Retenção real é 90 dias do encerramento; IP/backups não definidos, sem fabricar valores. |
| M13 | `auditoria`; `/master/auditoria?a=&p=` | `admin_list_audit(p_limit=25,p_offset,p_action)` | Cinco colunas, filtro por prefixo e paginação; `admin_export_csv(p_kind=auditoria,p_filters)`. Filtro permanece por URL; formulário extra removido para respeitar a referência. |
| M14 | `configuracoes`; `/master/configuracoes` | `platform_settings`; `feature_flags`; `admin_overview(p_days=7)`; `get_public_settings()` | `admin_set_setting(p_key,p_value,p_reason)` e `admin_set_feature_flag(p_key,p_enabled,p_rollout,p_reason)`. Ambiente/webhook somente leitura. Campos e toggles ligados via admin_set_master_config, com consumidores no upload, comentários e fila de e-mails. |

Migrations novas: `20261111000100_master_people_design.sql` (Pessoas); `20261111000200_master_retention_design.sql` (retenção); `20261111000300_master_team_export_design.sql` (CSV de equipe). Testes de banco associados: `39_master_people_design.test.sql` e `40_master_retention_design.test.sql`.

## Respostas explícitas à seção 6 do handoff

Decisões preservam as 15 referências e os 12 itens de menu. São decisões de escopo tomadas na execução, não novas telas disfarçadas; capacidades antigas não representadas ficam listadas como lacunas.

| Nº | Decisão implementada / limite |
|---|---|
| 1 | Cinco rotas antigas redirecionam após `requireMaster()`: usuários → Pessoas/Equipe; organizadores → Pessoas/Organizadores; participantes → Pessoas/Convidados; storage → Saúde; analytics → Visão geral. As três listas preservam `q` e `p` válidos. |
| 2 | Não criar quarta aba fora do desenho. Convites continuam sem tela; `admin_search_invites` não é exposta. Tokens/hashes nunca são exibidos. |
| 3 | Manter as três abas do desenho. Equipe representa só staff; contas anônimas órfãs e contas sem evento/papel ficam sem listagem geral. Não equivale a cobrir toda a antiga `/usuarios`. |
| 4 | Manter os dois medidores de M11. Identidade visual, órfãos, derivadas, crescimento e uploads em andamento não ganham elementos extras; continuam lacunas fora do desenho. Cota só se configurada; nunca estimada. |
| 5 | Manter M01; a série tabular eventos/entradas/falhas da antiga Analytics não ganha nova aba nem cartão. Sua remoção é explícita. |
| 6 | Sem interruptor de testes ou exclusão em lote fora da referência. Critério das RPCs existentes não é alterado; a divergência `admin_dashboard_metrics`/`admin_overview` quanto a testes permanece. |
| 7 | Entrada só master. Support/auditor permanecem papéis de banco, com máscara nas novas leituras; não se amplia o acesso ao console. |
| 8 | Sem UI de gerir papéis fora do desenho. Preservar motivo, auditoria e Sheet para ações sensíveis. AAL2 continua exigido na publicação de planos; não se altera contrato das demais RPCs. |
| 9 | Sem tela nova de pessoa/evento. Chevron do organizador abre Eventos filtrados por nome. Detalhe próprio de evento/pessoa fica sem tela. |
| 10 | Manter botões CSV do desenho ligados à RPC auditada `admin_export_csv`; adicionar overload aditivo para equipe coerente com M10, sem truncamento de 200 contas antes do filtro. |
| 11 | Nova RPC aditiva agrega pagamentos por organizador sobre todos os pedidos, sem somar só os primeiros 500; pgTAP inclui caso de 501 pagamentos. |
| 12 | Atualizar E2E do Master para destinos, navegação de 12 itens e kit Revela. Execução e resultado devem ser registrados pelo responsável pelos checks; presença do teste não significa CI reativado. |
| 13 | Removidos `ui.tsx` e `modules.ts`; classes antigas retiradas dos chamadores Master alterados. `styles/admin.css` ainda existe no repositório; não declarar sua remoção. |
| 14 | Fixtures e rotas reais 15/15 capturadas localmente; login sem sessão e demais páginas com JWT master. Estados ambientais e diferenças de dados estão documentados na evidência. |

## Contratos aditivos finais

Migrations 20261111000100–20261111000900, com pgTAP 39–47: Pessoas, retenção, CSV de equipe, moderação/reenvio, configuração e consumidores, vendas por plano, avisos nativos, código escolhido e contexto factual de pagamento. Nenhuma RPC anterior foi substituída. M08 mede observações do navegador aberto, não entrega Web Push; não inventa histórico.

Paginação final: `20261111001000_master_lists_pagination_design.sql` adiciona `admin_master_list(p_kind,p_filter,p_search,p_offset)` para pagamentos, códigos, revelações, fotos/comentários/bloqueados e LGPD. Busca e filtro antecedem `LIMIT 25`; totais globais não vêm de uma lista previamente truncada. Páginas únicas não acrescentam navegação ao desenho. Auditoria usa 25 por página. Teste de banco 48 cobre os novos contratos.

## Resultado final

M00–M14 prontas conforme tabela inicial, com comparações reais commitadas. Validação: TypeScript, ESLint (zero erros), build local, 895 testes web, 195 de funções, 1.686 pgTAP em base limpa, 2 E2E de autorização e 9 checks de controles passaram. Detalhes, limites e histórico de homologação em [verification.md](../evidence/revela/verification.md). Nenhuma implantação remota foi executada.
