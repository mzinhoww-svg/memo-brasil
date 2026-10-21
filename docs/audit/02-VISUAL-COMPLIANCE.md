# 02 · Conformidade visual com o MemoriesMT Design System v1

Auditor A2. Evidência: `evidence/screenshots/a2-*.png` (227 capturas; 4 larguras × 2 temas), `evidence/test-results/a2-crawl-*.json`, `a2-kit-compare.json`, `a2-focus.json`, `a2-overflow.json`. Medição por estilos computados, dimensões e tokens, não por impressão visual.

**Veredito:** **fiel ao kit.** As classes `mm-*` do app são idênticas às do kit; 48 classes com estilo computado idêntico nas prévias do kit e no app, nos dois temas. Desvios reais: tela de revelação clara na Noite (A2-001), seletor de evento do painel estoura com 60 caracteres (A2-002), dois links <44 px (A2-009), borda de chip abaixo de 3:1 que vem do CSS do próprio kit (A2-010).

| Verificação | Resultado |
|---|---|
| Rotas capturadas | 284 estados de tela (12 rodadas: 4 larguras × 2 temas, mais revelação em 390 e 1440), 7.456 nós de texto |
| Alvos de toque <44px (375, 390, 768, 1440) | Só 2: link "Guia de componentes" no rodapé da home (173×21, em 375/768/1440) e skip link (169×43, só aparece no foco) |
| Contraste de texto (WCAG, dois temas) | 0 pares <4,5:1, exceto botões desabilitados (3,98:1; o kit aceita 4,0 no desabilitado) |
| Contraste não textual <3:1 | Borda do `mm-chip` e `mm-chip--sugestao`: 1,46 (Dia) e 1,54 (Noite). Vem do CSS do kit |
| Paletas do evento (4 × 2 temas, pares do README) | Todas passam (texto ≥5,0; controle ≥3,3) |
| Sombras, gradientes, emoji, `!`, travessão | 0 no DOM renderizado e 0 no código-fonte |
| Serifada por tela | Máximo 1. Fonte do evento só no nome do evento |
| REC | Máximo 0,17% da área; texto vermelho só com `rec-texto` |
| Foco por teclado (11 rotas × 2 temas) | 100% com 2px sólido, offset 2px |
| Rolagem horizontal | 0 px em todas as telas. Nome de evento de 60, convidado de 40 e legenda de 140 caracteres quebram sem estouro, exceto A2-002 |
| Console/hidratação | 0 erros ou avisos em 11 rotas (só o aviso do Playwright que bloqueia SW) |

## Achados desta frente
- **A2-001** (P2) Tela de revelação inverte no tema Noite. Evidência: docs/audit/evidence/screenshots/a2-revelacao-transicao-390-noite.png contra a2-revelacao-transicao-390-dia.png
- **A2-002** (P2) Seletor de evento do admin estoura com nome de 60 caracteres. Evidência: docs/audit/evidence/test-results/a2-overflow.json (painel-1440-*: boxH 56, childBottomMax 130, overflows true); screenshots/a2-longos-painel-1440-dia.png
- **A2-009** (P3) Links abaixo de 44px: 'Guia de componentes' e skip link. Evidência: a2-crawl-375-dia.json (home, targets.small); screenshots/a2-home-1440-dia.png
- **A2-010** (P3) Borda de chip abaixo de 3:1 e tamanhos fixos fora dos tokens. Evidência: a2-crawl-390-dia.json (design, postar-preview: nonTextContrast); src/app/page.tsx:68
- **A2-011** (P3) Faixa de abas do painel no mobile corta itens sem indício; CLS e h1 duplicado. Evidência: screenshots/a2-painel-configuracoes-390-dia.png; a2-lighthouse-painel-desktop.json; a2-crawl-390-dia.json (convite.h1)
- **A2-012** (P3) Exemplo com revelação em 2 minutos não mostra a espera ao anfitrião. Evidência: a2-revelacao-host-agora-390-dia.png; a2-revelacao-espera-390-dia.png

Itens do kit, não do app: o contraste da borda do chip (1,46 Dia / 1,54 Noite) vem de `componentes.css` do kit; o app o reproduz fielmente. Decisão a tomar com o dono do design system (BG-128).
