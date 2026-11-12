# Revela 2.0 · Master, console completo (M15 a M32)

- `html/`: um HTML por tela, 1440×900, com `assets/revela2-screens.css`. Os textos dinâmicos de cada tela estão no comentário `<!-- DINÂMICO: ... -->` no início do `<body>`.
- `png/`: captura 1440×900 de cada HTML.
- `INDICE.csv`: id, título, arquivo, rota sugerida, de onde vem cada dado e quais são as ações.
- `CLASSES-NOVAS.md`: as 13 classes novas. Nenhum token novo.

## Como ler os ids
- `M15` a `M32`: tela principal.
- `.v` vazio, `.e` erro, `.p` sem permissão, `.c` carregando.
- `.f1`, `.f2`: folhas de ação da tela. `M23`, `M24` e `M25` são folhas reutilizáveis.

## O que cada tela nova substitui
| Nova | Substitui |
|---|---|
| M15 a M19 | M10 Pessoas (e as rotas usuarios, organizadores, participantes) |
| M20 | M01 Visão geral (e a rota analytics) |
| M21, M22 | complementam M02 Eventos |
| M23, M24 | folhas de M05 Pagamentos; M24 serve a todas as listas |
| M25 | folha única de "Revelar agora" (M08, M21 e painel do anfitrião) |
| M26 | M09 Moderação |
| M27 | M11 Storage e saúde (e a rota storage) |
| M28 | M13 Auditoria |
| M29, M30 | novas: Impressões |
| M31 | M14 Configurações |
| M32 | nova: acesso limitado |

## Sobre as decisões sugeridas
Concordo com as três: as 5 rotas antigas são absorvidas, os detalhes de evento e de pedido abrem em página própria, e não há detalhe de pessoa.

## Pontos para confirmar
1. **Cartão (`validapay_card`) em M31.** Desenhei a chave como pedido. A decisão de produto anterior era só Pix agora e cartão depois pelo Stripe. Se isso continua valendo, a linha vira "Cartão e Apple Pay · em breve" e sai a chave.
2. **Impressões (M29, M30).** A decisão anterior era não vender impresso agora e deixar um interruptor no Master. As telas estão prontas; sugiro que o item "Impressões" do menu só apareça com a chave `printed_album` ligada.
3. **Matriz de papéis (M32).** As linhas seguem a regra do briefing (e-mail mascarado, sem ações sensíveis). Confira com as policies antes de publicar.
4. **Revelar agora (M25).** Mantive o aviso "Revelar antes tira a graça" e o botão principal em "Manter a hora", como decidido para o anfitrião.
5. **Foto na moderação (M26).** A M09 antiga mostrava a imagem. A M26 mostra só a identificação, como pede a regra de privacidade.
6. **CNPJ e telefone do suporte em M31** são valores de exemplo.

## Propostas (não desenhadas, fora do briefing)
- M15: ação "ver eventos desta conta" na linha de organizador, como na M16.
- M27: botão "Executar agora" em job com falha, com motivo.
- M28: filtro por ator e por período.
- M29: filtro por evento e por produto.
- M30: código de rastreio ao marcar "enviado".
- M21: atalho "Abrir pagamentos deste evento".
