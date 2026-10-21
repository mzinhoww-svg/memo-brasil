# 06 — Design system

**V = verificado no código (valor literal) · E = estimado de screenshot.** Tema único **escuro** (`darkColorScheme`).

## Cores (V — `Theme/Color.kt`)
| Token | Hex | Uso |
|---|---|---|
| background | `#0B0B0C` | fundo; também `onPrimary` |
| surface | `#1C1C1F` | cartões/folhas |
| surfaceVariant | `#232327` | campos, chips |
| outline | `#2A2A2E` | bordas |
| onBackground | `#F5F3EF` | texto principal (off-white quente) |
| onSurfaceVariant | `#9B9AA0` | texto secundário |
| textFaint | `#66646B` | texto terciário |
| primary | `#DA7656` | acento terracota (CTAs, destaques) |
| primaryContainer | primary @ 16% alpha | fundos de destaque |
Outros (E): botão pílula branca sobre fotos (Próximo); botão Google claro / e-mail escuro (`SocialButtonStyle.LIGHT/DARK`); "glass": preto ~30% + borda (`GlassKt`, V parcial).

## Tipografia
- **Instrument Serif** (regular/itálico) — títulos e frases-manifesto (`MemoSerif`) (V)
- **Radley** (regular/itálico) — texto editorial/alternativo (`MemoRadley`) (V)
- **Sans de sistema** (Roboto no Android) — UI/corpo (`MemoSans`) (V)
- Escala (V, sp): display 52 · 36 · 32 · 28 · 22 · corpo 16 (médio/normal) · 14 · 12 · rótulos 14 semibold, 12 médio. Mapeamento exato por estilo M3 não extraído (E).
- Web: Instrument Serif e Radley são Google Fonts (OFL) — podem ser usadas; sans → Inter/system-ui.

## Espaçamento / raios (V)
| Spacing | dp | | Radius | dp |
|---|---|---|---|---|
| xs | 4 | | sm | 12 |
| sm | 8 | | md | 20 |
| md | 16 | | lg | 28 |
| lg | 24 | | pill | 999 |
| xl | 32 | | hero bottom curve | 44 (cantos inferiores) |
Grid: `ManualGrid` (grade manual por colunas, usada em galeria/capas) (V); gutter/colunas exatos: E.
Dispositivo de referência observado: 1080×2400 @420dpi (≈ 411×914 dp).

## Elevação / efeitos
Sem sombras Material evidentes; hierarquia por superfícies escuras + bordas `outline` + "vidro" (fundo preto translúcido) sobre fotos (E). Fotos em leque rotacionado (`PhotoFan`, `FanCard` com rotação) (V nome; ângulos E).

## Ícones
Vetores próprios (`res/drawable/ic_*.xml`): camera, camera_flip, flash, collage, scribble, eraser, text_format, undo/redo, qrcode, share, copy, save, bell, clock, hourglass (3 variantes), eye, info, check, minus, photo_stack, email, passkey, password, arrow_right; propósitos: baby_shower, birthday, company, other, travelling, wedding. Logo: ícone "mão + celular" + wordmark "Memo" (serif). **Marca protegida — não reutilizar.**

## Imagens
Heros de onboarding (2), launch (praia/festa/casamento), capas genéricas (3), amostras por estilo (bw/vintage), álbum de exemplo "Tina" (5 fotos). Ver `assets-inventory/`.

## Componentes → `07-COMPONENT-INVENTORY.md`

## Microinterações e transições (EST/E)
- Splash: pulse + scale; slides com troca por botão; indicador de pontos (`PageDotsIndicator`).
- Wizard: entrada de elementos (`appeared`), leque de fotos animado.
- Câmera: `FilmDial` (contagem do rolo), chips de zoom 1×/2×.
- Toasts (`ToastOverlay`), overlays de loading/erro.
- Estados interativos: botões pílula, chips selecionáveis (cor primary), toggles (`ToggleRow`), steppers (`StepperButton`).
- Respostas de foco/pressed seguem padrões Material (INF).

## Responsivo (INF)
Mobile retrato fixo; para web: coluna central máx. ~480 px em desktop com fundo `#0B0B0C`; tablets mantêm layout mobile centrado. Calendário e grade se adaptam por colunas.

## Medidas NÃO verificadas
Alturas de botões, tamanho de FAB/disparador, margens das telas, tamanho de tiles — estimar de screenshots ao implementar.
