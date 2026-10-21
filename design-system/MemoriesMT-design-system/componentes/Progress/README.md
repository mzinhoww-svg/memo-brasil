# Progress

Barra de 8px para envio de fotos e para ranking de momentos.

- **Envio** (`mm-progress`): trilho `divisor`, preenchimento `acao`. Cabeçalho com nome do item e estado: "Enviada", "62%", "Na fila" (em `apoio`).
- **Ranking** (`mm-progress mm-progress--evento`): trilho `evento-superficie`, preenchimento `evento-texto`, cabeçalho 14px. A maior barra ocupa 100%; as demais são proporcionais.

O consumidor fornece rótulo, valor e largura. Use `role="progressbar"` com `aria-valuenow` no envio.
