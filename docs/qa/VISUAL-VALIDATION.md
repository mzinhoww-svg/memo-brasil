# Validação visual — MemoriesMT × Design System v1

Data: 2026-10-20 · Build de produção (`next build` + `next start`) · Chromium (Playwright 1.x) · todos os números abaixo vêm de execuções reais; os arquivos estão em `docs/qa/screenshots/` (52 PNGs) e `docs/qa/lighthouse/` (JSON).
Reproduzir: `cd web && npm run e2e` (`e2e/visual.spec.ts`, `e2e/a11y.spec.ts`).

## 1. O que foi comparado e como
| Verificação | Método | Resultado |
|---|---|---|
| **Paridade de componentes com os previews oficiais** | Para 19 componentes/variantes (Button ×8 variantes, Chip, Field, OptionGroup, Tabs, CountBadge, LiveIndicator, Notice, StatTile, avatar do PostCard, TabBar, TableCard), o teste abre o `preview.html` do kit (`?tema=dia|noite`) e a rota `/design` do app e compara **15 propriedades computadas** (altura, raio, borda, família, tamanho, peso, tracking, caixa, cor, fundo, padding, gap) | **Sem divergência** nos dois temas (2 testes) |
| Tokens | Lê `getComputedStyle(:root)` e compara com `tokens.json` (`--tinta #1C1917`, `--rec #E1261C`, `--space-6 24px`, `--radius-control 14px`, `--size-campo 56px`, `--size-cta 64px`) | Igual |
| Fontes | `document.fonts.check` para Bricolage Grotesque 800 e Instrument Serif itálico (arquivos locais do ZIP) | Carregadas |
| Rolagem horizontal | 4 viewports × 2 temas × 12 rotas (home, design, Agora, Explorar, Você e as 7 telas do painel); em 390 px mais Postar, Criar, Entrar e QR | **0** ocorrências (375, 390, 768, 1440 px) |
| Contraste das paletas do evento | Teste unitário nos pares do README do kit (texto 4,5:1; controle 3:1) | 4 paletas × 2 temas aprovadas |
| Acessibilidade (axe, WCAG 2 A/AA) | 15 rotas × 2 temas, nível mobile 390 px | **0** violações críticas/graves |
| Lighthouse mobile (home) | perf 99, acessibilidade 100, boas práticas 100, SEO 100; `/entrar` e `/design` perf 100 (FCP/LCP 1,4–1,6 s, CLS ≤ 0,011, TBT ≤ 60 ms; throttling simulado) | ver `docs/qa/lighthouse/` |

## 2. Capturas (amostra; matriz completa na pasta)
| Tela | 390 · Dia | 390 · Noite |
|---|---|---|
| Home (capa do kit, wordmark, CTA) | `screenshots/390-dia-home.png` | `screenshots/390-noite-home.png` |
| Agora (EventHeader/Notice/PostCard/TabBar) | `390-dia-agora.png` | `390-noite-agora.png` |
| Explorar | `390-dia-explorar.png` | `390-noite-explorar.png` |
| Você | `390-dia-voce.png` | `390-noite-voce.png` |
| Postar daqui (câmera de teste) | `390-dia-postar.png` | `390-noite-postar.png` |
| Criar evento | `390-dia-criar.png` | `390-noite-criar.png` |
| QR Code Studio (TableCard A6) | `390-dia-qr.png` | `390-noite-qr.png` |
| Painel · Visão geral / Conteúdo | `390-dia-painel-*.png` | `390-noite-painel-*.png` |
Matriz 375/390/768/1440 × Dia/Noite para `home`, `design` (página inteira), `agora`, `painel-visao-geral` e `painel-conteudo`. O guia `/design` é o espelho do `index.html` do kit em React.

## 3. Itens conferidos a olho nas capturas
Tipografia (Bricolage 800 com tracking negativo nos títulos; Instrument Serif itálico só em mensagens emocionais, um por tela); vermelho REC só no ponto "Ao vivo" e no contador; sem sombras, gradientes ou emoji; foto sem moldura com raio `radius-lg`; CTA "Postar daqui" fixo acima da TabBar; tema Noite com tokens próprios (`#141211`, ação clara com texto escuro), não inversão; AdminNav de 256 px no desktop e navegação por abas no mobile.

## 4. Divergências encontradas e corrigidas durante a validação
1. `Button variant="pequeno"` renderizava só `mm-btn--pequeno` (sem cor). No kit, "pequeno" é modificador de tamanho: corrigido para `primario + pequeno`; novo `small` para secundário/destrutivo (teste de componente + paridade).
2. O reset do Tailwind (`line-height: 1.5` no `html`) deslocava alturas (ex.: `StatTile` 45 px × 36 px do kit): `html { line-height: normal }`; texto corrido usa `.app-p` (17/1,4) em vez de herdar do `body`.
3. `body` com `font-size: 17px` alterava containers do kit (Notice, TableCard): removido; tamanhos vêm das classes do kit.
4. Tabs da galeria apontavam `aria-controls` para painel inexistente (axe, crítico): painel adicionado.

## 5. O que esta validação NÃO prova
- Não é comparação de pixels contra o `index.html` do kit (é paridade de estilos computados dos componentes + inspeção das capturas). Telas compostas do app (feed, wizard, painel) não existem no kit; a fidelidade delas é a dos componentes e dos tokens usados.
- Só Chromium. Safari/iOS e Firefox não foram executados (riscos conhecidos: `getUserMedia`/zoom, `localStorage` em modo privado, push).
- Contraste conferido pelo axe em 390 px nos dois temas e pelos pares das paletas; não houve auditoria manual com leitor de tela.
- Dados das capturas são de exemplo (imagens vetoriais geradas, marcadas "exemplo" apenas na semente; fotos reais variam).
