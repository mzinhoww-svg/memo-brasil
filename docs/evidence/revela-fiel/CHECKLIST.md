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
| 15 | Câmera pronta | Camera-pronta | 4.06% | ![](15.png) | referência portada (dados do desenho) | não ligada ao app |
| 14a | Resumo e forma de pagamento | Pagamento-resumo | erro | ![](14a.png) | portada e ligada a dados reais | `ValidaPayCheckout`: resumo, Pix/cartão (cartão só com publicId/flag), CPF/CNPJ extra no Pix (exigido pelo provedor; não está no desenho) |
| 14b | Pix | Pagamento-pix | erro | ![](14b.png) | portada e ligada a dados reais | `ValidaPayCheckout`: QR, contagem de expiração, copia e cola, polling |
| 14c | Cartão | Pagamento-cartao | erro | ![](14c.png) | portada e ligada a dados reais | `ValidaPayCheckout`: cartão tokenizado; telefone e endereço extras (exigidos pelo provedor; só com cartão ligado) |
| 14d | Confirmação do banco | Pagamento-3ds | erro | ![](14d.png) | portada e ligada a dados reais | `ValidaPayCheckout`: aguardando o banco (3DS) |
| 14e | Confirmando | Pagamento-processando | erro | ![](14e.png) | portada e ligada a dados reais | `ValidaPayCheckout`: confirmando/verificação; "Fechar e avisar depois" consulta o servidor |
| 14f | Pago | Pagamento-aprovado | erro | ![](14f.png) | portada e ligada a dados reais | `ValidaPayCheckout`: pago |
| 14g | Não deu certo | Pagamento-falhou | erro | ![](14g.png) | portada e ligada a dados reais | `ValidaPayCheckout`: recusado, expirado, indisponível, estornado |
| 14h | Trocar de plano | Pagamento-trocar-plano | erro | ![](14h.png) | portada e ligada a dados reais | `PlanPicker` (checkout nativo) em `/painel/[id]/plano` |
| 16 | Câmeras (anfitrião) | Anfitriao-inicio | 0.79% | ![](16.png) | referência portada (dados do desenho) | não ligada ao app |
| 17 | Ajustes do evento | Anfitriao-ajustes | 1.37% | ![](17.png) | referência portada (dados do desenho) | não ligada ao app |
| 17b | Convidados | Anfitriao-convidados | 1.39% | ![](17b.png) | referência portada (dados do desenho) | não ligada ao app |
| 17c | Revisar antes de revelar | Anfitriao-moderar | 0.90% | ![](17c.png) | referência portada (dados do desenho) | não ligada ao app |
| 17d | Resumo do evento | Painel-resumo | 1.17% | ![](17d.png) | referência portada (dados do desenho) | não ligada ao app |
| 17e | Convites e mesas | Painel-convites | 2.71% | ![](17e.png) | referência portada (dados do desenho) | não ligada ao app |
| 17f | Programação e local | Painel-programacao | 1.38% | ![](17f.png) | referência portada (dados do desenho) | não ligada ao app |
| 17g | Aviso aos convidados | Painel-aviso | 1.60% | ![](17g.png) | referência portada (dados do desenho) | não ligada ao app |
| 17h | Downloads | Painel-downloads | 1.57% | ![](17h.png) | referência portada (dados do desenho) | não ligada ao app |
| 17i | Moderar comentários | Painel-moderacao | 1.93% | ![](17i.png) | referência portada (dados do desenho) | não ligada ao app |
| 17j | Excluir evento | Painel-excluir | 1.20% | ![](17j.png) | referência portada (dados do desenho) | não ligada ao app |
| 17k | Convite A5 para imprimir | Painel-convite-a5 | 0.77% | ![](17k.png) | referência portada (dados do desenho) | não ligada ao app |
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
| 25 | QR para as mesas | QR-convite | 1.24% | ![](25.png) | referência portada (dados do desenho) | não ligada ao app |
| 26 | Compartilhar | QR-compartilhar | 0.61% | ![](26.png) | referência portada (dados do desenho) | não ligada ao app |
| 27 | Você | Voce | 1.34% | ![](27.png) | referência portada (dados do desenho) | não ligada ao app |
| 28 | Sem internet | Apoio-offline | 0.60% | ![](28.png) | referência portada (dados do desenho) | não ligada ao app |
| 29 | Excluir conta | Apoio-excluir-conta | 1.30% | ![](29.png) | referência portada (dados do desenho) | não ligada ao app |
| 30 | Preços | Apoio-precos | 1.97% | ![](30.png) | referência portada (dados do desenho) | não ligada ao app |
| 31 | Termos e privacidade | Apoio-termos | 5.69% | ![](31.png) | referência portada (dados do desenho) | não ligada ao app |
| 32 | Ajuda | Apoio-ajuda | 2.46% | ![](32.png) | referência portada (dados do desenho) | não ligada ao app |
| M00 | Login | Master-login | 0.19% | ![](M00.png) | referência portada (dados do desenho) | não ligada ao app |
| M01 | Visão geral | Master-visao | 0.84% | ![](M01.png) | referência portada (dados do desenho) | não ligada ao app |
| M02 | Eventos | Master-eventos | 1.34% | ![](M02.png) | referência portada (dados do desenho) | não ligada ao app |
| M03 | Planos e preços | Master-planos | 1.27% | ![](M03.png) | referência portada (dados do desenho) | não ligada ao app |
| M04 | Confirmar novo preço | Master-plano-publicar | 0.79% | ![](M04.png) | referência portada (dados do desenho) | não ligada ao app |
| M05 | Pagamentos | Master-pagamentos | 1.35% | ![](M05.png) | referência portada (dados do desenho) | não ligada ao app |
| M06 | Detalhe do pagamento | Master-pagamento-detalhe | 1.31% | ![](M06.png) | referência portada (dados do desenho) | não ligada ao app |
| M07 | Cortesias | Master-cortesias | 0.83% | ![](M07.png) | referência portada (dados do desenho) | não ligada ao app |
| M08 | Revelações | Master-revelacoes | 1.28% | ![](M08.png) | referência portada (dados do desenho) | não ligada ao app |
| M09 | Moderação | Master-moderacao | 0.90% | ![](M09.png) | referência portada (dados do desenho) | não ligada ao app |
| M10 | Pessoas | Master-pessoas | 1.06% | ![](M10.png) | referência portada (dados do desenho) | não ligada ao app |
| M11 | Storage e saúde | Master-saude | 0.82% | ![](M11.png) | referência portada (dados do desenho) | não ligada ao app |
| M12 | LGPD | Master-lgpd | 0.82% | ![](M12.png) | referência portada (dados do desenho) | não ligada ao app |
| M13 | Auditoria | Master-auditoria | 1.16% | ![](M13.png) | referência portada (dados do desenho) | não ligada ao app |
| M14 | Configurações | Master-config | 1.02% | ![](M14.png) | referência portada (dados do desenho) | não ligada ao app |
