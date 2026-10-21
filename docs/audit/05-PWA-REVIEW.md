# 05 · Revisão de PWA

Auditor A2. Evidência: `evidence/test-results/a2-pwa.json`, `a2-offline-post.json`, screenshots `a2-pwa-*` e `a2-idb-*`.

**Veredito:** manifest válido e instalável; **offline parcial.** Postar foto offline funciona e persiste; páginas já visitadas abrem offline; **rotas nunca visitadas caem em `/offline`** (A2-003) e **cada atualização do SW apaga as páginas guardadas**, recacheando só a casca (A2-004). Sem IndexedDB o app segue em memória e confirma ações que não persistem (A2-005). Não se declara suporte offline completo.

PWA:

| Item | Resultado |
|---|---|
| Manifest | Válido: ícones 192/512 (PNG, dimensões reais conferem), maskable 512 com zona segura, apple-touch 180, start_url e scope `/`, `/sw.js` com `no-cache` |
| Instalabilidade | Critérios atendidos (manifest, ícones, SW com fetch). Não testei o prompt de instalação |
| Estratégia do SW | Estáticos cache-first; navegação rede-primeiro com cópia local; `/offline` como fallback; 40 páginas no máximo (medido: 40 de 50) |
| Dados sensíveis no cache | Nenhum dado de evento ou foto: só HTML-casca (16 KB) e estáticos. As chaves contêm código do convite e UUID do evento |
| Offline, páginas visitadas | agora, explorar, voce, postar, entrar, criar, painel, home: abrem e hidratam, com 12 fotos do IndexedDB |
| Offline, nunca visitadas | /e/CODE/retrospectiva, /painel/ID/qr, /design, outro código: caem em `/offline` |
| Postar offline | Funciona (3 de 3 execuções isoladas, 0,6 s). Persiste após recarregar e após limpar o cache do SW |
| Limpar cache do SW e ficar offline | Páginas deixam de abrir; dados seguem no IndexedDB |
| Atualização `?v=AAA` para `?v=BBB` | Troca o SW, apaga o cache antigo, clients.claim sem aviso. Só a casca é recacheada (A2-004) |
| Falha parcial na instalação (`/criar` com 500) | Instala normalmente (allSettled) |
| IndexedDB indisponível (`undefined` ou `open` lançando erro) | App segue com repositório em memória, sem erro de console (A2-007) |

## Achados
- **A2-003** (P2) Offline só funciona para URLs já visitadas online. Evidência: a2-pwa.json: offlineNeverVisited (4 de 4 em /offline); screenshots/a2-pwa-offline-nunca-visitada-390-dia.png
- **A2-004** (P2) Pré-cache só de HTML; atualização apaga as páginas guardadas. Evidência: a2-pwa.json: cacheAfterFirstVisit (sem /_next/static); swUpdate.cachesAfterB (só 5 URLs)
- **A2-005** (P2) Sem IndexedDB, o app confirma ações que não persistem. Evidência: a2-pwa.json: idb_undefined (afterReloadText, wizardEnd); idb_throws; screenshots/a2-idb-undefined-criar-390-dia.png
- **A2-008** (P3) Manifest sem variante escura e com orientação travada. Evidência: a2-pwa.json: manifest, head.themeColors
- **A2-014** (P3) Endurecimento do SW: chaves com códigos, evicção e troca silenciosa. Evidência: a2-pwa.json: cacheAfterVisits (URLs com /e/CODE e /painel/UUID); swUpdate.pagesCachedAfter50Fetches
