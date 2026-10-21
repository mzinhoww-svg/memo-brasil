# 06 · Relatório de performance

Auditor A2. Ambiente: Apple M4, macOS, Chromium do Playwright 1.64, Lighthouse 13.5.0 (headless). Performance medida numa **cópia de produção sem relógio de teste** (porta 3312). Lighthouse mobile = simulado (4x CPU, 1,6 Mbps, 150 ms). Evidência: `evidence/test-results/a2-lighthouse-*.json`, `a2-perf-*.json`.

**Veredito:** boa. Lighthouse acessibilidade/boas práticas/SEO 100 em todas as rotas; performance mobile 93–95 (LCP 2,9–3,3 s simulado), desktop 100 (exceto CLS 0,322 no painel sem dados, estado "não achamos o evento" do perfil novo). Com dados: LCP mobile ≈2,2 s, CLS ≈0. 200 fotos: feed paginado, 200 imagens em 1,7 s, heap JS ≈10 MB. Pontos a melhorar: jszip carregado ao abrir Downloads (A2-007), fontes decorativas pré-carregadas em todas as rotas (A2-006), imagens sem lazy/decoding e /voce sem paginação (A2-013), nenhum `import()` dinâmico.

Lighthouse (produção; mobile = simulado 4x CPU, 1,6 Mbps, 150 ms; desktop = preset desktop). Perf/A11y/BP/SEO:

| Rota | Mobile | Desktop |
|---|---|---|
| / | 93/100/100/100, LCP 3,2 s | 100/100/100/100, LCP 0,4 s |
| /entrar | 94/100/100/100, LCP 3,1 s | 100, LCP 0,5 s |
| /criar | 93/100/100/100, LCP 3,2 s | 100, LCP 0,7 s |
| /design | 95/100/100/100, LCP 2,9 s | 100, LCP 0,5 s |
| /e/ABCDEFGH/agora | 93/100/100/100, LCP 3,3 s | 100, LCP 0,6 s |
| /painel/<uuid> | 93/100/100/100, LCP 3,2 s | 84/100/100/100, CLS 0,322 |

Limite: Lighthouse usa perfil novo sem IndexedDB, então as rotas de evento mostram o estado "não achamos o evento". As rotas com dados foram medidas por PerformanceObserver (tabela abaixo).

Rotas com dados (Playwright, produção, cache desligado, SW bloqueado; mobile = 4x CPU + 1,6 Mbps/150 ms, 390×844@3x):

| Rota | LCP mobile | CLS | Requisições | JS (descomprimido) |
|---|---|---|---|---|
| /e/CODE/agora | 2.184 ms | 0 | 34 | 520 KB |
| /e/CODE/explorar | 2.204 ms | 0,0002 | 34 | 520 KB |
| /painel/ID | 2.144 ms | 0 | 26 | 513 KB |
| /painel/ID/downloads | 2.384 ms | 0 | 25 | 702 KB |
| Desktop, mesmas rotas | 64 a 124 ms | ≤0,0001 | 27 a 35 | 520 a 721 KB |

Bundle (produção): chunks de 1,37 MB brutos, 601 KB gzip no total; base comum de 8 chunks = 150 KB gzip; cada rota carrega 153 a 218 KB gzip. Maior: react-dom 224 KB, jszip 190 KB (só em /downloads). Nenhum `import()` ou `dynamic` no código.

200 fotos (JPEG 1200×1600 q0,85, média 446 KB, 82 MB no total): feed paginado de 20 em 20 (botão "Ver mais fotos"). Primeira imagem em 80 ms; 9 cliques e 200 imagens carregadas em 1,7 s; heap JS 9,4 a 10,5 MB; 3.884 nós; página de 118.620 px. /voce com 150 fotos próprias (sem paginação): 307 ms, 150 imagens. ZIP do álbum: 689 ms, 81,9 MB.

## Achados
- **A2-006** (P3) Fontes decorativas pré-carregadas em todas as rotas; fonte da interface sem preload. Evidência: a2-perf-routes-mobile.json (fonts); HTML de /entrar; Lighthouse a2-lighthouse-home-mobile.json
- **A2-007** (P3) jszip carregado ao abrir Downloads; sem import dinâmico. Evidência: a2-perf-routes-desktop.json (jsFiles: 0_t7ot-9xac4y.js 190 KB); build em /tmp/a2-build
- **A2-013** (P3) Imagens do feed sem lazy/decoding e /voce sem paginação. Evidência: a2-perf-200fotos-b.json; src/features/photos/capture.ts
