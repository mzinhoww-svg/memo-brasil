# Revela: Filme 35mm novo e sistema de animações

Branch `feat/revela-redesign` (PR #29). Anexo: `Revela-movimento-filme35.zip`.

O zip traz código pronto e testado. **Copie os arquivos como estão. Não reescreva o algoritmo, as curvas nem as durações.**

## 1. Filme 35mm
Copie `film/` para `web/src/features/photos/film/`:
- `film35.ts`: aplica o filme nos pixels (halação → LUT 3D → vinheta → grão). Puro, sem DOM.
- `film35-lut.ts`: o LUT 17³ embutido (gerado; não edite).
- `film-canvas.ts`: `renderFilm(canvas, source, sw, sh, opts)`, `drawStamp` e `stampText`.
- `film35.test.ts`: 11 testes vitest. Têm que passar sem alteração.

Troque o filtro atual:
- Em `features/photos/capture.ts`, substitua `applyStylePixels` e o carimbo por `renderFilm`. Mapeamento: estilo de filme → `look: "filme35"`; preto e branco → `look: "pb"`; natural → `look: "natural"`.
- `seed`: use o horário do disparo em milissegundos, para o grão mudar a cada foto.
- `stamp`: `stampText(dataDoDisparo)`, só quando o evento usa filme.
- No editor (`23e`), os chips "Filme 400" e "Vintage" usam `filme35`; "Preto e branco" usa `pb`; "Sem filme" usa `natural`. Remova os filtros antigos.
- No visor ao vivo, aplique a classe `rv-film-preview` no `<video>` e a camada `rv-film-preview-vignette` por cima. É só uma aproximação: a foto salva usa o LUT.
- A foto enviada ao servidor é a já processada, como hoje. Não processe no servidor.
- Rode o processamento depois do flash, fora do toque. Em foto de 1600 px leva cerca de 0,3 s em notebook; em celular, mais. Se travar a tela, mova para um worker com `OffscreenCanvas`.

`film/revela-filme35.cube` e `revela-pb.cube` (33³) são para edição fora do app. `receita/` tem o Python que gera o LUT; não entra no build.

## 2. Animações
Copie `motion/revela-motion.css` para os estilos globais (depois de `tokens.css`) e `motion/revela-motion.ts` para `web/src/lib/motion/`. Remova os keyframes antigos equivalentes (`rv-flash`, `confetti-cai`, `develop`, `pulse`).

Onde cada uma entra:

| Onde | O que usar |
|---|---|
| Todo botão | classe `rv-press` |
| Entrada de listas e telas | `rv-rise` com `--i` para o atraso em sequência |
| Folhas (assistente, pagamento, confirmações) | `rv-sheet-motion` + `data-open`, fundo `rv-backdrop` |
| Passos do assistente | `rv-step` com `data-dir="next"` ou `"back"`; traços `rv-seg` + `data-on` |
| Câmera 3D (abertura, assistente, câmera pronta) | `rv-cam-in` na entrada, `rv-float` parada, `tilt(el)`; troca de embalagem com `flipWrap(img, src)` |
| Disparo (`21`/`22`) | `shoot({ flash, shutter, button, wheel, counter, remaining })` com as camadas `rv-flash-layer` e `rv-shutter-layer` sobre o visor |
| Contador de poses e contagem regressiva | `odometer(el, valor)` |
| Pose salva indo para "Minhas" | `flyTo(el, abaMinhas)` |
| Feed antes da revelação (`23b`) | `rv-blurred` na miniatura borrada, `rv-lock-nudge` no cadeado, `rv-pop` em foto nova |
| Virada da revelação no feed | `revealFeed(itens, swap)`: troque a miniatura pela foto real dentro de `swap` |
| Tela "Revelou." (`24c`) e "Câmera pronta" (`15`) | `revealMoment({ title, prints, canvas, flash })`; em `15`, `confetti(canvas)` |
| Fotos impressas aparecendo (`18`, e-mail não) | `dealPrints(prints)`; foto abrindo pela primeira vez: `rv-develop` |
| Pago (`14f`), Pix expirou (`14g`) | `stampSlam(carimbo, papel)` + `confetti` só no pago |
| Curtir e reações | `heartPop(botao)` |
| Aguardando Pix, confirmando, carregando | `rv-live-dot`, `rv-dots`, `rv-skeleton`, `rv-spin` |
| Avisos no topo, sem internet | `rv-toast-in` / `rv-toast-out` |
| Carimbo de data aparecendo | `typeStamp(el, texto)` |
| Navegação entre rotas | View Transitions (os keyframes `rv-vt-*` já estão no CSS) |

Regras:
- **Movimento reduzido:** o CSS e o TS já tratam `prefers-reduced-motion`. Não crie animação fora do kit.
- Anime só `transform`, `opacity` e `filter`.
- Confete só em três lugares: câmera pronta, pago e "Revelou.".
- `demo/index.html` mostra todas rodando: abra para conferir o resultado esperado.

## 3. Vídeo e cenas
- Troque o vídeo da abertura por `assets/revela-abertura.mp4` (556 KB) e o poster.
- Troque as fotos de `/exemplo` por `assets/sc-*.jpg`, que já usam o filme novo.

## Aceite
- `film35.test.ts` verde; lint, typecheck e E2E verdes.
- Uma foto real tirada no app, antes e depois, anexada ao PR.
- Vídeo curto de tela (ou GIF) do disparo, da virada do feed e da tela "Revelou.".
- Com "reduzir movimento" ligado, nada desliza, pisca ou gira.
- Não publique em produção sem minha confirmação.
