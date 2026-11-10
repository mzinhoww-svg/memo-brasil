# Revela 2.0: fidelidade tela a tela

Referência (esquerda) | implementação com os dados do desenho (centro) | diferença pixelmatch (direita). 390×844; Master 1440×900. Geradas por `web/scripts/revela-evidence.mjs`.

| Tela | Título | HTML | Diff | Prova | Estado do markup | Ligação ao app |
|---|---|---|---|---|---|---|
| 00 | Splash | Abertura-splash | 6.38% | ![](00.png) | referência portada (dados do desenho) | não ligada ao app |
| 01 | Abertura com vídeo | Main | 15.18% | ![](01.png) | referência portada (dados do desenho) | não ligada ao app |
| 02 | Telefone | Cadastro-telefone | 0.93% | ![](02.png) | referência portada (dados do desenho) | não ligada ao app |
| 03 | Código | Cadastro-codigo | 0.42% | ![](03.png) | referência portada (dados do desenho) | não ligada ao app |
| 04 | Seu nome | Cadastro-perfil | 0.76% | ![](04.png) | referência portada (dados do desenho) | não ligada ao app |
| 05 | Para que vai usar | Cadastro-ocasiao | 1.51% | ![](05.png) | referência portada (dados do desenho) | não ligada ao app |
| 06 | Monte a câmera | Camera-montar | 3.25% | ![](06.png) | referência portada (dados do desenho) | não ligada ao app |
| 07 | Embalagem | Camera-embalagem | 10.44% | ![](07.png) | referência portada (dados do desenho) | não ligada ao app |
| 08 | Nome impresso | Camera-nome | 0.64% | ![](08.png) | referência portada (dados do desenho) | não ligada ao app |
| 09 | Até quando | Camera-data | 1.93% | ![](09.png) | portada e ligada a dados reais | passo 3 do assistente (`features/events/wizard.tsx`): dia, começa, termina; vira a meia-noite |
| 10 | Poses por pessoa | Camera-poses | 1.32% | ![](10.png) | portada e ligada a dados reais | passo 4: opções 10/24/27/36, legenda pelo catálogo; rolo da câmera é só visual (sem campo no evento) |
| 11 | Quando revelar | Camera-revelacao | 1.83% | ![](11.png) | portada e ligada a dados reais | passo 5: 4 opções calculadas no fuso do evento; bloqueia revelar antes do fim |
| 12 | Filme | Camera-filtro | 0.82% | ![](12.png) | referência portada (dados do desenho) | não ligada ao app |
| 13 | Quem vê o quê | Camera-privacidade | 0.99% | ![](13.png) | referência portada (dados do desenho) | não ligada ao app |
| 14 | Publicar | Camera-publicar | 1.59% | ![](14.png) | portada e ligada a dados reais | passo 8: planos do catálogo, pré-seleção pelas poses, aceites em diálogo "Antes de criar" |
| 15 | Câmera pronta | Camera-pronta | 4.07% | ![](15.png) | portada e ligada a dados reais | `/criar/pronto/[id]`: compartilhar convite (Web Share/cópia) e imprimir QR; código e link só em elemento oculto para teste |
| 14a | Resumo e forma de pagamento | Pagamento-resumo | 2.38% | ![](14a.png) | portada e ligada a dados reais | `ValidaPayCheckout`: resumo, Pix/cartão (cartão só com publicId/flag), CPF/CNPJ extra no Pix (exigido pelo provedor; não está no desenho) |
| 14b | Pix | Pagamento-pix | 1.61% | ![](14b.png) | portada e ligada a dados reais | `ValidaPayCheckout`: QR, contagem de expiração, copia e cola, polling |
| 14c | Cartão | Pagamento-cartao | 1.27% | ![](14c.png) | portada e ligada a dados reais | `ValidaPayCheckout`: cartão tokenizado; telefone e endereço extras (exigidos pelo provedor; só com cartão ligado) |
| 14d | Confirmação do banco | Pagamento-3ds | 0.67% | ![](14d.png) | portada e ligada a dados reais | `ValidaPayCheckout`: aguardando o banco (3DS) |
| 14e | Confirmando | Pagamento-processando | 7.75% | ![](14e.png) | portada e ligada a dados reais | `ValidaPayCheckout`: confirmando/verificação; "Fechar e avisar depois" consulta o servidor |
| 14f | Pago | Pagamento-aprovado | 4.30% | ![](14f.png) | portada e ligada a dados reais | `ValidaPayCheckout`: pago |
| 14g | Não deu certo | Pagamento-falhou | 1.08% | ![](14g.png) | portada e ligada a dados reais | `ValidaPayCheckout`: recusado, expirado, indisponível, estornado |
| 14h | Trocar de plano | Pagamento-trocar-plano | 3.41% | ![](14h.png) | portada e ligada a dados reais | `PlanPicker` (checkout nativo) em `/painel/[id]/plano` |
| 16 | Câmeras (anfitrião) | Anfitriao-inicio | 0.81% | ![](16.png) | portada e ligada a dados reais | `/eventos`: câmera em destaque + prateleira (criadas e convidadas); abas `HostTabs` |
| 17 | Ajustes do evento | Anfitriao-ajustes | 1.39% | ![](17.png) | portada e ligada a dados reais | `/painel/[id]/configuracoes`: plano, fim (folha com prorrogar e guarda das fotos), revelação (folha), poses (folha, limites do plano), feed (liga/desliga reações); "Mais" abre convidados, quem vê as fotos, seu nome, código de presente e exclusão. Filme e embalagem levam a Aparência. Divergência: o feed liga/desliga só as reações (não há campo de comentários no evento). |
| 17b | Convidados | Anfitriao-convidados | 1.40% | ![](17b.png) | portada e ligada a dados reais | `/painel/[id]/convidados`: quem entrou, poses usadas, "ainda não entraram" (capacidade menos entradas); tocar na pessoa bloqueia/desbloqueia (folha); "+" abre Compartilhar. O anfitrião não entra na lista. |
| 17c | Revisar antes de revelar | Anfitriao-moderar | 0.91% | ![](17c.png) | portada e ligada a dados reais | `/painel/[id]/conteudo`: grade das fotos (tocar abre folha: tirar/devolver ao álbum, destacar, excluir); "Revelar agora" antecipa a revelação para o próximo minuto (updateReveal, mesmo caminho de "Quando revelar"; não existe RPC de anfitrião, `admin_reveal_now` é só do Master). Só aparece com revelação pendente. Paginação de 60 em 60. |
| 17d | Resumo do evento | Painel-resumo | 1.18% | ![](17d.png) | portada e ligada a dados reais | `/painel/[id]` (resumo): números reais, lotação (`gauge--warn`), 8 atalhos. O checklist "Antes do grande dia" e o cartão de plano antigos saíram (o desenho não os tem); "Denúncias" soma fotos e comentários denunciados. |
| 17e | Convites e mesas | Painel-convites | 2.89% | ![](17e.png) | portada e ligada a dados reais | `/painel/[id]/convites`: Geral, uma linha por mesa (`event.tables`) e convites com nome (`repos.invitations`); folha com link, copiar e revogar; "+" cria convite e ajusta o nº de mesas. Divergência: não há limite por convite nem revogado persistido (revogar apaga), então "limite N" e a linha "Revogado" só existem no desenho. |
| 17f | Programação e local | Painel-programacao | 1.39% | ![](17f.png) | portada e ligada a dados reais | `/painel/[id]/momentos`: local (`event.place`) e momentos (`HH:MM|nome`) com edição em folha e Salvar. O ranking de fotos por momento do painel antigo saiu. |
| 17g | Aviso aos convidados | Painel-aviso | 1.78% | ![](17g.png) | portada e ligada a dados reais | `/painel/[id]/aviso`: aviso de até 140 caracteres, "Agora" ou "Agendar" (novo campo `notice.startsAt` no JSON do evento, respeitado no Agora do convidado). Um aviso por vez; apagar na própria tela. |
| 17h | Downloads | Painel-downloads | 1.59% | ![](17h.png) | portada e ligada a dados reais | `/painel/[id]/downloads`: ZIP do álbum (com progresso), CSV de convidados e Retrospectiva (abre depois da revelação; botão vira "Abrir"). A nota de guarda segue `photosAvailableUntil` (90 dias após o encerramento), não os 12 meses do desenho; o tamanho em GB não é mostrado. |
| 17i | Moderar comentários | Painel-moderacao | 1.94% | ![](17i.png) | portada e ligada a dados reais | `/painel/[id]/moderacao`: Fotos denunciadas (Manter/Esconder), Comentários (RPC `list_comments_for_moderation` e `moderate_comment`; modo local não tem comentários) e Bloqueados (desbloquear). "Comentários ligados" = `reactionsEnabled`; "Esconder ao receber 3 denúncias" é regra fixa do servidor (só leitura). |
| 17j | Excluir evento | Painel-excluir | 1.21% | ![](17j.png) | portada e ligada a dados reais | `/painel/[id]/excluir`: exige digitar o nome do evento; "Encerrar o filme sem excluir" usa endEventNow. Acesso: Ajustes > Mais > Excluir evento. |
| 17k | Convite A5 para imprimir | Painel-convite-a5 | 0.94% | ![](17k.png) | portada e ligada a dados reais | `/painel/[id]/convite`: prévia A5 com QR real, "Baixar PDF" (A5 com sangria; fontes Gloock, Schibsted Grotesk e Share Tech Mono embutidas) e "Imprimir" (folha vetorial só no papel). Layout do PDF ajustado às novas métricas. |
| 18 | Revelação | Revelados-galeria | 0.57% | ![](18.png) | referência portada (dados do desenho) | não ligada ao app |
| 19 | Foto aberta | Revelados-foto | 0.24% | ![](19.png) | referência portada (dados do desenho) | não ligada ao app |
| 19b | Álbum impresso | Revelados-album | 1.66% | ![](19b.png) | referência portada (dados do desenho) | não ligada ao app |
| 20a | Leitura do QR | Convidado-qr | 0.25% | ![](20a.png) | referência portada (dados do desenho) | não ligada ao app |
| 20b | Entrar no evento | Convidado-entrar | 1.27% | ![](20b.png) | referência portada (dados do desenho) | não ligada ao app |
| 20c | Código do convite | Convidado-codigo | 0.89% | ![](20c.png) | portada e ligada a dados reais | `/entrar` (código de 8 caixas) |
| 20d | Consentimento | Convidado-consentimento | 1.85% | ![](20d.png) | referência portada (dados do desenho) | não ligada ao app |
| 20e | Convite inválido | Convidado-invalido | 0.87% | ![](20e.png) | referência portada (dados do desenho) | não ligada ao app |
| 20f | Câmera lotada | Convidado-lotado | 0.90% | ![](20f.png) | referência portada (dados do desenho) | não ligada ao app |
| 20g | Carregando a festa | Convidado-carregando | 5.25% | ![](20g.png) | portada e ligada a dados reais | carregando a festa em `/e/[code]` (nome omitido até o convite carregar) |
| 20h | Código não confere | Convidado-codigo-erro | 1.39% | ![](20h.png) | portada e ligada a dados reais | `/entrar?erro=` (código não confere) |
| 21 | Câmera | Convidado-camera | 0.07% | ![](21.png) | referência portada (dados do desenho) | não ligada ao app |
| 22 | Disparo | Convidado-flash | 0.07% | ![](22.png) | referência portada (dados do desenho) | não ligada ao app |
| 23 | Acesso à câmera | Convidado-permissao | 0.92% | ![](23.png) | referência portada (dados do desenho) | não ligada ao app |
| 24 | Filme acabou | Convidado-fim | 1.47% | ![](24.png) | referência portada (dados do desenho) | não ligada ao app |
| 23b | Feed antes da revelação | Convidado-laboratorio | 2.55% | ![](23b.png) | portada e ligada a dados reais | `/e/[code]/agora` antes da revelação |
| 23c | Minhas poses | Convidado-minhas | 0.87% | ![](23c.png) | portada e ligada a dados reais | `/e/[code]/minhas` |
| 23d | Enviar do rolo | Convidado-postar | 0.85% | ![](23d.png) | portada e ligada a dados reais | sheet "Do rolo da câmera" em `/postar` |
| 23e | Editar foto | Convidado-editar | 0.89% | ![](23e.png) | portada e ligada a dados reais | `/e/[code]/editar/[photoId]` |
| 23f | Programação | Convidado-programacao | 0.98% | ![](23f.png) | portada e ligada a dados reais | `/e/[code]/programacao` |
| 23g | Você (convidado) | Convidado-voce | 1.48% | ![](23g.png) | portada e ligada a dados reais | `/e/[code]/voce` |
| 24b | Aviso de revelação | Feed-aviso | 0.70% | ![](24b.png) | referência portada (dados do desenho) | não ligada ao app |
| 24c | Revelou | Feed-revelou | 12.58% | ![](24c.png) | referência portada (dados do desenho) | não ligada ao app |
| 24d | Feed do evento | Feed-evento | 0.37% | ![](24d.png) | referência portada (dados do desenho) | não ligada ao app |
| 24e | Comentários | Feed-comentarios | 1.81% | ![](24e.png) | referência portada (dados do desenho) | não ligada ao app |
| 24f | Reações | Feed-reacoes | 0.40% | ![](24f.png) | referência portada (dados do desenho) | não ligada ao app |
| 24g | Denunciar | Feed-denunciar | 1.21% | ![](24g.png) | referência portada (dados do desenho) | não ligada ao app |
| 24h | Retrospectiva | Feed-retrospectiva | 4.05% | ![](24h.png) | referência portada (dados do desenho) | não ligada ao app |
| 24i | Aviso por e-mail | Feed-email | 1.87% | ![](24i.png) | referência portada (dados do desenho) | não ligada ao app |
| 24j | Sair dos avisos por e-mail | Feed-email-sair | 1.00% | ![](24j.png) | referência portada (dados do desenho) | não ligada ao app |
| 25 | QR para as mesas | QR-convite | 1.41% | ![](25.png) | portada e ligada a dados reais | `/painel/[id]/qr`: cartão de mesa em 4 modelos (4 redações; o 2 é o do desenho); "Proporção" alterna retrato/quadrado; "Imprimir" imprime um cartão por mesa. "Salvar PDF" abre o mesmo diálogo de impressão (Salvar como PDF), sem arquivo próprio. |
| 26 | Compartilhar | QR-compartilhar | 0.62% | ![](26.png) | portada e ligada a dados reais | `/painel/[id]/compartilhar`: link do evento (copiar), WhatsApp (wa.me), Stories (folha de compartilhar do aparelho; cópia se não houver), QR na tela (folha) e Imprimir (leva ao convite A5). |
| 27 | Você | Voce | 1.36% | ![](27.png) | portada e ligada a dados reais | `/eventos/voce`: conta, extras e ajuda; "Nome e foto", "Telefone" e "Ícone do app" só informativos (conta Google, sem campo no produto) |
| 28 | Sem internet | Apoio-offline | 0.87% | ![](28.png) | portada e ligada ao app | `/offline` (fallback do service worker): tocar na faixa, no disparo ou em Fechar; título "Revela" e contador "—" porque o fallback estático não conhece o evento nem a fila (a contagem de fotos esperando não é exibida) |
| 29 | Excluir conta | Apoio-excluir-conta | 1.31% | ![](29.png) | portada e ligada a dados reais | `/conta/excluir` (nova rota; sem link em Você porque `app/eventos/**` é de outro agente): pedido via RPC `request_account_deletion`, contagem de eventos da conta; "Baixar meus dados antes" leva a `/eventos` (não há exportação de conta no produto) |
| 30 | Preços | Apoio-precos | 2.15% | ![](30.png) | portada e ligada a dados reais | `/precos`: planos de `listPublicPlans` (destaque = plano `highlighted` ou Casamento); sem pagos ativos mostra só o Grátis e "Os planos pagos voltam em breve"; chip de provedor ValidaPay/Mercado Pago conforme o checkout; "Montar câmera" abre `/criar` |
| 31 | Termos e privacidade | Apoio-termos | 2.83% | ![](31.png) | portada e ligada a dados reais | `/termos` e `/privacidade`: textos de `lib/legal-text` e versões de `lib/consent` inalterados (selo mostra data e versão); abas alternam as rotas; aviso de rascunho se a versão terminar em `-rascunho` |
| 32 | Ajuda | Apoio-ajuda | 2.47% | ![](32.png) | portada e ligada a dados reais | `/ajuda`: busca e acordeão reais; 5 perguntas do desenho com respostas do produto (plano pela diferença, guarda 90/30 dias, pagamento conforme provedor); "Falar com o suporte" = mailto do e-mail público (`get_public_settings`) |
| M00 | Login | Master-login | 0.19% | ![](M00.png) | portada e ligada ao app | `app/master/layout.tsx`: cartão de entrada (também para modo local e sem permissão); no lugar de e-mail, senha e código entra o botão Google (o operador não tem senha; o TOTP é pedido em M04) |
| M01 | Visão geral | Master-visao | 0.85% | ![](M01.png) | portada e ligada a dados reais | `/master`: `admin_overview` (receita, eventos ativos, fotos hoje, 7/30 dias), `admin_payments_summary` e `admin_list_payments`; vendas por plano = pedidos pagos (sem Grátis); botão Exportar omitido (não há exportação) |
| M02 | Eventos | Master-eventos | 1.35% | ![](M02.png) | portada e ligada a dados reais | `/master/eventos`: nova RPC aditiva `admin_events_board` (6 filtros com contagem, categoria, plano, denúncias); sem página de detalhe do evento; Exportar CSV omitido |
| M03 | Planos e preços | Master-planos | 1.29% | ![](M03.png) | portada e ligada a dados reais | `/master/planos`: `PricesEditor` (rascunho, destaque, prévia ao vivo, ativação sandbox/produção); Histórico de preços leva a `/master/auditoria?a=plan.` |
| M04 | Confirmar novo preço | Master-plano-publicar | 0.82% | ![](M04.png) | portada e ligada a dados reais | modal de publicação com TOTP (aal2) via `admin_publish_plans`; impacto = pedidos pagos e Pix abertos por plano; campo de motivo mantido (exigido pelo servidor, ausente no desenho) |
| M05 | Pagamentos | Master-pagamentos | 1.36% | ![](M05.png) | portada e ligada a dados reais | `/master/pagamentos`: resumo, filtros e divergências; "Conciliar agora" e Exportar omitidos (a conciliação exige token de serviço e roda sozinha); método sem final do cartão |
| M06 | Detalhe do pagamento | Master-pagamento-detalhe | 1.32% | ![](M06.png) | portada e ligada a dados reais | `/master/pagamentos/[id]`: linha do tempo montada com os campos do pedido (sem eventos de webhook); Estornar = `RefundButton` existente (motivo + payments-refund); Consultar recarrega |
| M07 | Cortesias | Master-cortesias | 0.85% | ![](M07.png) | portada e ligada a dados reais | `/master/codigos`: lista de códigos, revogar, cortesia direta a um evento (veio de Pagamentos); o código é gerado pelo servidor, então o campo "Código" virou "Para quem / nota" |
| M08 | Revelações | Master-revelacoes | 1.29% | ![](M08.png) | portada e ligada a dados reais | `/master/revelacoes`: nova RPC aditiva `admin_reveals_board` (só números do aviso por e-mail); "Revelar agora" via `admin_reveal_now` com motivo; avisos no celular "—" (sem push no produto); sem Reenviar falhas (a fila reenvia sozinha) |
| M09 | Moderação | Master-moderacao | 0.91% | ![](M09.png) | portada e ligada a dados reais | `/master/moderacao`: nova RPC aditiva `admin_moderation_queue`; fotos só como metadados (sem imagem: o console não exibe fotos privadas) e sem ações; comentários com Manter/Esconder/Remover via `moderate_comment` com motivo; bloqueados listados |
| M10 | Pessoas | Master-pessoas | 1.07% | ![](M10.png) | portada e ligada a dados reais | `/master/pessoas`: organizadores (gasto = pedidos pagos), convidados (nome, evento, mesa; sem contato) e equipe; busca e paginação; Exportar omitido |
| M11 | Storage e saúde | Master-saude | 0.83% | ![](M11.png) | portada e ligada a dados reais | `/master/saude`: `admin_health`, `admin_overview`, métricas de storage; cota de storage só se existir `storage_quota_bytes`; linha extra de tarefas agendadas |
| M12 | LGPD | Master-lgpd | 0.84% | ![](M12.png) | portada e ligada a dados reais | `/master/lgpd`: `admin_lgpd_requests` (só exclusão de conta, prazo de 15 dias); retenção em vigor (política v1) só leitura, sem edição |
| M13 | Auditoria | Master-auditoria | 1.16% | ![](M13.png) | portada e ligada a dados reais | `/master/auditoria`: `admin_list_audit` com filtro por prefixo e 50 por página; Exportar omitido |
| M14 | Configurações | Master-config | 1.04% | ![](M14.png) | portada e ligada a dados reais | `/master/configuracoes`: ambiente e webhook só leitura; validade do Pix (5–1440 min, `validapay_pix_expiry_minutes`), chave `validapay_card` (padrão desligada) e checkout gravam por `admin_set_setting`/`admin_set_feature_flag` com motivo e auditoria; `payments-validapay` action config só devolve publicId com a chave ligada; parâmetros reais (suporte, empresa, folga) no lugar de teto de fotos/remetente/comentários, que não têm chave |
