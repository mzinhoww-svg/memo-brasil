# Baseline visual — checklist item 2 (Designer, 2026-10-13)

**Método.** App da branch `main` (469792b) com `DATA_DIR` temporário e porta 3277, um casamento de teste (3 convidados na lista, 1 convidado entrou, 1 foto, 1 recado, programação com 2 itens). Chrome real (Google Chrome, headless via Playwright) em **390x844** (celular, toque) e **1440x900**. Para cada tela: rolagem horizontal (`scrollWidth` > largura da janela), erros e avisos de console, respostas HTTP ≥ 400 e captura de página inteira. Script reproduzível: `docs/qa/qa-visual.js`; resultado bruto: `docs/qa/.resultado.json`.

> O portal do Maestri caiu no meio da bateria (`Connection refused`); a rodada válida usa o Chrome headless, não o portal. A câmera ao vivo não foi validada: o headless usa câmera falsa e o quadro aparece preto. **Câmera real em iOS/Android continua pendente** (item 4).

## Resultado

| Tela | 390x844 | 1440x900 |
|---|---|---|
| `/` criar evento | OK, sem rolagem horizontal | OK |
| `/e/:id` convite | OK | OK |
| `/e/:id/inicio` | OK | OK |
| `/e/:id/camera` | OK (quadro preto = câmera falsa) | OK |
| `/e/:id/album` | OK | OK |
| `/e/:id/programacao` | OK | OK |
| `/e/:id/recados` | OK | OK |
| `/e/:id/presenca` | OK | OK |
| `/painel/:id` (8 abas) | **FALHA: rolagem horizontal, página com 1248 px** | OK |
| `/master` (6 abas) | OK na página; **tabela de casamentos cortada** | OK |

Console: zero erros em todas as telas, exceto um `404` em `/favicon.ico` (nenhuma página declara ícone).

## Defeitos

| # | Gravidade | Onde | Descrição | Causa e correção sugerida |
|---|---|---|---|---|
| V1 | Alta | Painel, 390 px | Toda a página fica com 1248 px: o painel inteiro rola na horizontal e o conteúdo some à direita. Reprovou o critério "sem rolagem horizontal". | `.shell{grid-template-columns:1fr}` no `@media (max-width:760px)` de `admin.css`: a coluna `1fr` herda o `min-content` do `.nav` com `white-space:nowrap`. Trocar por `minmax(0,1fr)`. **Verificado no navegador:** 1248 → 390 px. |
| V2 | Média | Master, 390 px | Tabela de casamentos corta as colunas depois de "Revelação" (sem rolagem própria). | Envolver tabelas em contêiner com `overflow-x:auto` ou virar cartões em telas estreitas. O master é desktop-first, então fica abaixo de V1. |
| V3 | Baixa | Todas | `GET /favicon.ico` → 404. | Adicionar `<link rel="icon">` com o logotipo (ver `docs/design/logo.svg`). |
| V4 | Baixa | Painel, Resumo | O card "Hora da revelação" tem área vazia sob o botão Salvar. | Remover altura mínima / mensagem vazia reservada. |
| V5 | Baixa | Início (convidado) | Aviso "Instale o app" com altura sobrando e texto em cor diferente do resto (branco puro). | Usar `--cor-texto-suave` e padding uniforme. |
| V6 | Info | Convidado/organização | Identidade provisória "MEMO BRASIL" em texto, sem logotipo; ícones em emoji (renderizam diferente por sistema). | Resolve com a identidade nova e ícones SVG próprios (docs/design/identidade.md). |

## Observações de fluxo
- O convidado cai direto na câmera disponível pelo Início em 1 toque; o fluxo "QR → convite → nome → hub" está coerente com a referência (placa com QR e câmera descartável).
- Texto de usuário (`<b>` num recado de teste) aparece escapado no álbum/recados/painel: sem HTML injetado.
- Álbum antes da revelação mostra só cartões bloqueados com contagem; nenhuma foto vazou nas capturas.

## Capturas
`docs/qa/<tela>-m.png` (390x844) e `docs/qa/<tela>-d.png` (1440x900); abas do painel como `painel-<aba>-*`, abas do master como `master-<aba>-*`. Páginas inteiras (altura variável).
