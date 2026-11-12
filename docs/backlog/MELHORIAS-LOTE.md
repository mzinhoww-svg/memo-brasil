# Lote de melhorias (aguardando o restante antes de executar)

Status: coletando. Nada deste lote foi corrigido ainda.

## 1. Seletor de planos não rola para o lado (Painel > Plano, e checkout)
- Sintoma: o carrossel de planos (Grátis, Festa, Celebração, ...) só muda ao tocar num card; arrastar com o dedo não rola.
- Causa provável: `web/src/revela/screens/PagamentoTrocarPlano.tsx:59` move a trilha com `transform: translateX(-planShift(idx))` conforme o plano selecionado, em vez de rolagem nativa. O container `.planscroll` não rola por gesto.
- Direção da correção: trocar por rolagem horizontal nativa (`overflow-x: auto`, `scroll-snap-type: x mandatory`, `-webkit-overflow-scrolling: touch`), mantendo o card selecionado centralizado ao escolher (`scrollIntoView`) e a seleção por toque.
- Conferir: o mesmo componente/estilo no passo 8 do assistente.
