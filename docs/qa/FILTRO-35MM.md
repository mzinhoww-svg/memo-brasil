# Filtro Filme 35mm (LUT 3D)

O "Filme 35mm" é uma LUT 3D 33×33×33 (negativo colorido tipo Portra/Kodak Gold), não ajustes soltos.

## Onde está
| O quê | Arquivo |
|---|---|
| Construção da LUT, trilinear, `.cube`, tira 2D | `web/src/features/photos/film-lut.ts` |
| Halation, vinheta, grão (`FILM_FX`) | `web/src/features/photos/film-fx.ts` |
| Foto guardada (`renderPhoto`) | `web/src/features/photos/capture.ts` |
| Prévia ao vivo (shader WebGL) | `film-gl.ts`, `film-canvas.tsx`, uso em `postar/page.tsx` |
| Arquivo para outras ferramentas | `web/public/revela/lut/filme35.cube` |
| Gerador + amostras | `web/scripts/gen-film-lut.mjs` (`npm run gen:lut`) |

## Pipeline
Foto: LUT (trilinear) → halation nos realces → vinheta + grão (semente = hora da foto) → carimbo `'AA MM DD`.
"natural" não passa pela LUT. vintage e preto e branco seguem como antes.
Prévia: a mesma LUT como textura 1089×33 (x = azul×33 + vermelho, y = verde); o shader faz bilinear em R/G e mistura as duas fatias de azul (trilinear). O canvas é reduzido a 720 px no maior lado, ~30 fps via `requestAnimationFrame`, `pointer-events: none`, `aria-hidden`. Vinheta e grão na prévia vêm do overlay CSS `.rv-cam__film`; a halation só existe na foto. Sem WebGL (ou contexto perdido) volta o filtro CSS `FILM_CSS_FALLBACK`.

## Parâmetros (`FILM_LUT_PARAMS`, valores 0..1 em sRGB)
| Parâmetro | Valor | Efeito |
|---|---|---|
| `sCurve` | 0,42 | Curva em S (0 linear, 1 smoothstep) |
| `lift` | 0,022 / 0,036 / 0,042 | Pretos levantados R/G/B, verde-azulados |
| `fade` | 0,035 | Branco puro vira 0,965 |
| `saturation` | 0,90 | Saturação geral |
| `greenDesat` | 0,38 | Perda extra de saturação nos verdes |
| `greenToYellow` | 0,05 | Verdes puxados para o amarelo |
| `highlightTint` | +0,045 / +0,02 / −0,045 | Âmbar nos realces (peso: luminância 0,45→1) |
| `shadowTint` | −0,012 / +0,008 / +0,02 | Verde-azulado nas sombras (peso: 0,5→0) |
| `skinWarmth` | 0,03 | Calor em peles (R>G>B, saturação média) |

Efeitos (`FILM_FX`): `halation` 0,34, `halationThreshold` 0,7, `vignette` 0,28, `grain` 9 (0..255, mais forte nos meios-tons).

## Como ajustar
1. Edite `FILM_LUT_PARAMS` (ou `FILM_FX`) e rode `cd web && npm run gen:lut`: regenera `filme35.cube` e as amostras `public/revela/lut/amostra-bolo-lut.jpg` (só LUT) e `amostra-bolo-filme35.jpg` (pipeline sem carimbo), a partir de `sc-bolo-natural.jpg`.
2. Confira as amostras ao lado de `sc-bolo-natural.jpg` e `sc-bolo.jpg`.
3. Rode `npx vitest run src/features/photos`. O teste do `.cube` falha se o arquivo não estiver em dia com o código. Tolerâncias: cantos neutros a até 0,08 da identidade.
4. Não há hex no código: são números de cor da LUT.

## Estáticas do assistente
Passos 6 e 17 usam `sc-bolo-natural.jpg` × `sc-bolo.jpg`, mantidas. `sc-bolo.jpg` (arte de referência, carimbo gravado) é um pouco mais marrom nas sombras que a LUT (que é verde-azulada), mas concorda em realces âmbar, grão e carimbo. Se quiser igualar, use `amostra-bolo-filme35.jpg` como base.

## Uso em outras ferramentas
`ffmpeg -i in.jpg -vf lut3d=web/public/revela/lut/filme35.cube out.jpg`; ou importe o `.cube` no Resolve, Lightroom ou Photoshop.
