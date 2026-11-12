# Lote de melhorias (aguardando o restante antes de executar)

Status: coletando. Nada deste lote foi corrigido ainda.

## 1. Seletor de planos não rola para o lado (Painel > Plano, e checkout)
- Sintoma: o carrossel de planos (Grátis, Festa, Celebração, ...) só muda ao tocar num card; arrastar com o dedo não rola.
- Causa provável: `web/src/revela/screens/PagamentoTrocarPlano.tsx:59` move a trilha com `transform: translateX(-planShift(idx))` conforme o plano selecionado, em vez de rolagem nativa. O container `.planscroll` não rola por gesto.
- Direção da correção: trocar por rolagem horizontal nativa (`overflow-x: auto`, `scroll-snap-type: x mandatory`, `-webkit-overflow-scrolling: touch`), mantendo o card selecionado centralizado ao escolher (`scrollIntoView`) e a seleção por toque.
- Conferir: o mesmo componente/estilo no passo 8 do assistente.

## 2. Retrospectiva "não funciona corretamente" (/e/[code]/retrospectiva)
- Sintoma (captura de tela): com poucas fotos, o gráfico "Fotos por hora" vira um bloco laranja que ocupa a largura inteira, sem leitura possível. Evento de teste: 2 fotos, 1 fotógrafo, 0 reações.
- Causas prováveis, em `web/src/features/feed/retro.ts` e `web/src/styles/revela2.css:426-430`:
  1. `.bars div { flex: 1 }` estica cada barra até preencher a linha; com 1 ou 2 horas a barra fica gigante. Falta largura máxima e centralização.
  2. As barras mostram só as N horas com mais fotos (`slice(0, maxBars)`), então horas vazias no meio somem (ex.: 16h, 17h, 19h, 21h lado a lado). A linha do tempo fica enganosa; deveria ser contínua, do primeiro ao último horário, com as horas vazias baixas.
  3. As barras não mostram a quantidade de fotos (só a altura relativa), então com poucas fotos não dá para ler nada.
  4. Título fixo "O casamento" só quando a categoria é casamento; as demais viram "evento" (conferir se está correto para festa, aniversário etc.).
- A confirmar com você: o que exatamente parecia errado além do gráfico (números, textos, o pico "19:40 / Chegada", reações zeradas)?
- Direção: largura máxima por barra, linha do tempo contínua, número de fotos sobre a barra, estado vazio ou de poucos dados mais claro.

## 3. Anfitrião dentro do evento não consegue voltar; telas do painel com cara de "web" no celular
### 3a. Sem caminho de volta (área do convidado `/e/[code]/...`)
- Sintoma: o anfitrião entra no evento como convidado (abas Feed / Minhas / Você) e não tem como voltar ao painel nem a "Meus eventos".
- Causa provável: `web/src/app/e/[code]/(app)/layout.tsx` já sabe `isHost`, mas a barra de abas e a tela Você (`voce/page.tsx`) não oferecem nenhum link para `/painel/[id]` ou `/eventos` (só a página de convite `e/[code]/page.tsx:241` tem "Abrir o painel").
- Direção: quando `isHost`, mostrar um atalho fixo "Painel do evento" (cabeçalho do Feed e da tela Você) e um "Voltar a Meus eventos". Conferir o botão voltar do navegador depois da entrada.

### 3b. Quebras de interface no celular (painel do evento > Aparência e vizinhas)
- Sintomas na captura:
  1. A barra de abas do painel (Visão geral / Plano / Conteúdo / Convidados...) corta o último item ("Convidados") sem indicar que rola.
  2. "Prévia da câmera" fica num bloco preto com bordas desalinhadas do restante e ocupa quase uma tela inteira antes do formulário; o título "Aparência da câmera" é enorme e repete o assunto.
  3. O conteúdo do fim da tela fica por baixo da barra flutuante do navegador (o aviso do anfitrião e "Embalagem" ficam cobertos): falta respiro inferior (`padding-bottom` com `env(safe-area-inset-bottom)`).
  4. Migalhas "Meus eventos › Nosso casamento › Aparência" ocupam espaço de tela pequena e duplicam a navegação.
- Causa provável: o painel usa o layout de web (`web/src/styles/app.css`, `.studio-grid`, `.studio-previa`) em vez do padrão mobile Revela; a prévia só vira coluna lateral e fixa a partir de 1024 px.
- Direção: revisar o painel `/painel/[id]/*` em 390 px: abas com rolagem e sombra de borda, prévia menor (ou recolhível), título único, espaço inferior com safe area, migalhas compactas.
- Pendente: a lista completa de telas com quebra (você vai mandar mais capturas); varrer todas as rotas do painel em 390 px antes de corrigir.

## 4. QR para as mesas: não dá para trocar de modelo (/painel/[id]/qr)
- Sintoma: aparece "Modelo 2 de 4" e quatro bolinhas, mas não há como ir para os outros modelos. Arrastar o cartão não faz nada e tocar nas bolinhas não acerta.
- Causa provável: `web/src/revela/screens/QRConvite.tsx` troca o modelo só pelo clique nas bolinhas (`onModel`, ligado em `painel/[id]/qr/page.tsx`). As bolinhas medem 6 px com 6 px de espaço (`revela2.css:262-264`), muito abaixo dos 44 px de área de toque recomendados, e o cartão não tem gesto de deslizar nem setas.
- Direção:
  1. Deslizar o cartão para os lados troca o modelo (arrastar com `pointer events` ou `scroll-snap` horizontal com os 4 cartões lado a lado).
  2. Aumentar a área de toque das bolinhas (mantendo o visual pequeno) e adicionar setas anterior/próximo.
  3. Teclado: setas esquerda/direita.
  4. Mesma ideia vale para o botão de proporção, que hoje é só um ícone sem rótulo ("Proporção"): mostrar qual está ativa (retrato × quadrado).
- Conferir: o mesmo padrão de bolinhas em outras telas (convite A5, QR compartilhar).

## 5. Painel > Plano sem layout mobile (/painel/[id]/plano)
- Sintomas na captura (390 px):
  1. A tela de plano é a tela inteira de celular (`PagamentoTrocarPlano`, classe `.scr`) colocada dentro do painel, que já tem abas, migalhas e título. Resultado: três cabeçalhos empilhados (abas, migalhas "Meus eventos › Nosso casamento › Plano", "Nosso casamento · Plano") e, dentro do bloco preto, mais um cabeçalho "Plano do evento" com seta de voltar.
  2. O bloco preto fica "encaixotado": margens laterais, cor diferente do fundo da página e título repetido.
  3. `.scr` tem `height: 100dvh` e `overflow: hidden` (`revela2.css:124`); dentro do painel, que já gasta ~500 px com cabeçalhos, o fim da tela é cortado: o botão de confirmar o plano e o aviso "Pix ou cartão, sem sair do app · ValidaPay" ficam fora de alcance e escondidos pela barra do navegador. Risco real: o anfitrião pode não conseguir concluir a compra no celular.
  4. A seta de voltar do bloco não deve existir dentro do painel (a navegação já está nas abas).
  5. Carrossel de planos: o card selecionado fica de fora/parcial na borda e a trilha só se move por seleção (mesmo problema do item 1).
- Direção: renderizar o plano no painel como conteúdo de página (sem `.scr` de altura fixa e sem segundo cabeçalho), com rolagem normal da página, botão de confirmar visível (fixo no rodapé, com `safe-area`), carrossel nativo com encaixe e o texto de pagamento no fluxo, não no rodapé fixo.
- Conferir: o mesmo padrão em outras telas do painel que encaixam telas de celular dentro do painel (Conteúdo, Convidados, Convites, QR, Downloads). Ligação direta com o item 3b: o painel precisa de um layout mobile único.
