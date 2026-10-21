# Button

Botão de ação em seis variantes: primário, CTA, secundário, pequeno, texto e destrutivo.

- **Primário** (`mm-btn mm-btn--primario`): a ação da tela, uma por vista. 56px, `acao` com `on-acao`, `radius-control`.
- **CTA** (`mm-btn mm-btn--cta`): postar e publicar. 64px, `radius-lg`, ícone da câmera à esquerda. `mm-btn--cta-xl` (72px) só na tela da câmera.
- **Secundário** (`mm-btn--secundario`): alternativa ao primário, borda 1,5px em `tinta`.
- **Pequeno** (`mm-btn--pequeno`): 44px, para ações em cards e barras do admin. Combine com primário ou secundário.
- **Texto** (`mm-btn--texto`): ação de baixo peso, sublinhada, em `apoio`.
- **Destrutivo** (`mm-btn--destrutivo`): bloquear, excluir. Borda e texto em `rec-texto`; nunca preenchido.

O consumidor fornece o rótulo (verbo de ação em caixa de frase), o ícone opcional como SVG inline e o `type`. Use `<button>` para ações e `<a class="mm-btn">` para navegação. Desabilitado: atributo `disabled`, que aplica `desabilitado` e `on-desabilitado`. Não use dois primários na mesma vista e não coloque ícone sem rótulo.
