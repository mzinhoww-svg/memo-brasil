# Identidade Memo Brasil — proposta (Designer, 2026-10-13)

> **Status: proposta.** O nome definitivo, o domínio e a marca são decisão do usuário. "Lume" é só o nome de trabalho usado nos arquivos para ter algo concreto; nada aqui é final nem foi registrado como tal.

## 1. Três nomes candidatos
Critérios: curto, pronunciável em pt-BR, sem relação com a marca "Memo" do app de referência, remete a "ver a foto só na hora certa".

| Nome | Ideia | Pontos fortes | Riscos / checar antes |
|---|---|---|---|
| **Lume** | "Lume" = luz, chama; a foto "acende" na revelação | 4 letras, fácil de falar e escrever, sotaque sem ambiguidade, bom como logo | palavra comum; buscar INPI (classe 9/42/45) e domínio `.com.br` |
| **Revela** | verbo "revelar": a foto aparece na hora marcada | explica o produto em uma palavra, tom de casamento | muito genérico para busca; "revela.app" pode estar tomado |
| **Contraluz** | foto à contraluz: luz do fim de tarde, memórias | poético, forte para comunicação e fotos de casamento | 9 letras, longo para ícone de app; já usado por outras marcas |

Recomendação do Designer: **Lume** (melhor marca em ícone e na placa do QR). Decisão do usuário.

## 2. Conceito
"A luz que revela." Quatro cantos de visor ao redor de um ponto de luz âmbar: câmera descartável (viewfinder) + momento que se acende. Quente, noturno (festa) e discreto o bastante para ficar numa placa de casamento.

- Logotipo: `docs/design/logo.svg` (ícone 64×64) e `logo-horizontal.svg` (ícone + palavra). Desenho original em SVG, sem fontes embutidas no ícone.
- Área livre: 1/4 da altura do ícone em todos os lados. Mínimo: 24 px de largura (ícone), 96 px (horizontal).
- Não: esticar, colocar o ponto âmbar sobre fundo âmbar, aplicar sombra ou contorno.

## 3. Paleta (valores em `tokens.css`)

| Papel | Token | Valor | Uso |
|---|---|---|---|
| Âmbar (acento convidado) | `--marca-ambar` | `#E8A94D` | botão de destaque, ponto de luz, foco |
| Vinho (acento organização) | `--marca-vinho` | `#8E3B34` | botão primário, links no tema claro |
| Oliva | `--marca-oliva` | `#4F6B52` | confirmado/sucesso (decorativo) |
| Fundo escuro | `--cor-fundo` | `#14110E` | tema do convidado |
| Superfície escura | `--cor-superficie` | `#1E1A16` | cartões |
| Papel | `--cor-papel` | `#F2E8D8` | convite, botão primário do convidado |
| Fundo claro | `--cor-fundo` (`.tema-claro`) | `#FAF7F2` | tema da organização/master |

**Contrastes medidos (WCAG, razão):** texto/fundo escuro 16,5; texto suave/fundo escuro 8,6; texto sobre âmbar 8,9; texto/fundo claro 16,1; suave/fundo claro 6,8; branco sobre vinho 7,4; sucesso claro 5,9; aviso claro 6,4; erro claro 6,1. Todos ≥ 4,5 (AA).

Os dois temas usam os **mesmos nomes de token**; a troca é só `class="tema-claro"` no `<html>`. Convidado fica em `:root` (escuro). Organização/master recebem a classe.

## 4. Tipografia
- **Títulos:** Fraunces (serifada com personalidade, variável, OFL) — substitui Cormorant/Playfair. Pesos 500–700.
- **Texto e interface:** Figtree (sans geométrica amigável, variável, OFL), no lugar da pilha do sistema.
- Auto-hospedar WOFF2 em `/fonts` (sem CDN: privacidade/LGPD e offline no PWA); `font-display: swap`; fallback Georgia / system-ui, então nada quebra se o arquivo faltar.
- Escala: 12 / 14 / 16 / 20 / 28 / 40 px (`--texto-xs…2xl`). Campo de formulário nunca abaixo de 16 px (iOS não dá zoom). Linha 1,5.

## 5. Componentes, espaçamento e forma
- Espaçamento base 4 px (`--esp-1…8`); alvos de toque ≥ 44 px (`--alvo-toque`).
- Raios 8 / 12 / 18 e pílula; sombra só em elevação real (envelope do convite, modais).
- Ícones: trocar emoji por SVG de traço 1,75 px próprio (consistência entre iOS/Android/desktop). Lista a desenhar: câmera, álbum, relógio/programação, coração/presença, recado, QR, aviso, equipe.
- Botão primário: convidado = papel (`--cor-papel`) com texto escuro; organização = vinho com texto branco. Foco visível: anel 2 px `--cor-foco`.
- Movimento: 180 ms, respeitar `prefers-reduced-motion`.

## 6. Aplicação (para o Programador de identidade)
1. Carregar `tokens.css` antes de `app.css`/`admin.css`; mapear as variáveis antigas (`--bg`→`--cor-fundo`, `--card`→`--cor-superficie`, `--accent`→`--cor-acento`, `--a-*`→mesmos tokens com `.tema-claro`).
2. Adicionar `class="tema-claro"` em `index.html`, `painel.html`, `master.html`.
3. Corrigir V1 (`minmax(0,1fr)`) e V2 (tabela rolável) do `docs/qa/baseline-visual.md`.
4. `<link rel="icon" href="/icons/logo.svg">` e regenerar `icon-192/512/maskable` a partir do logo.
5. Nome na tela: usar uma única constante (`MARCA`) para trocar facilmente quando o usuário decidir o nome.
6. Revisar o texto com o Redator (tom acolhedor, pt-BR). O CSS aplicado nas telas **não** está neste PR.

## 7. Pendências
- Nome, domínio e busca de marca (INPI) — decisão do usuário.
- Arquivos WOFF2 das fontes (baixar das fontes oficiais OFL) — Programador de identidade.
- Lighthouse ≥ 90 (item 10) só mede depois do CSS aplicado.
