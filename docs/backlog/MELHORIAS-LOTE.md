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
