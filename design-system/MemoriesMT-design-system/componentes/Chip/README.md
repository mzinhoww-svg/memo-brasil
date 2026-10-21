# Chip

Pílula de 44px para reações, filtros de momento e sugestões de legenda.

- **Reação** (`mm-chip`): "Amei 24", "Esse momento 11". Borda em `borda`; selecionado com `aria-pressed="true"` vira `acao`.
- **Filtro** (`mm-chip mm-chip--filtro`): momentos no Explorar ("O sim", "Pôr do sol"). Borda em `tinta`. Selecionado mostra a contagem: "Pôr do sol · 318".
- **Sugestão** (`mm-chip mm-chip--sugestao`): legendas prontas no fluxo de postar. Fundo `neutro`.

O consumidor fornece o rótulo, a contagem e o estado `aria-pressed`. Agrupe com `mm-chips`. Chip é sempre `<button>`. A borda de `borda` é decorativa: o estado selecionado é marcado por preenchimento, nunca só por cor de borda.
