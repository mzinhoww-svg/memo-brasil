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
