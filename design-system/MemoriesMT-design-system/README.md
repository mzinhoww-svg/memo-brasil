# MemoriesMT · Design System

Versão 1. Abra `index.html` no navegador para ver o guia completo, com cores, tipos, logos, ícones e componentes nos temas Dia e Noite.

## Como usar no projeto

1. Copie `tokens/tokens.css` e a pasta `fonts/` para o projeto, mantendo `fonts/` ao lado de `tokens/` (as fontes são carregadas por `../fonts/`).
2. Importe `tokens/tokens.css` no CSS global. Defina o tema em `<html data-theme="dia">` ou `data-theme="noite"`.
3. Use as variáveis: `var(--tinta)`, `var(--space-4)`, `var(--radius-lg)`. As classes de texto (`.corpo`, `.titulo-tela`, `.eyebrow`) já vêm prontas.
4. Com Tailwind, use `tokens/tailwind.preset.js` como preset: `bg-acao`, `text-on-acao`, `rounded-lg`, `p-4`, `h-campo`.
5. `componentes/componentes.css` traz as classes `mm-*` usadas nas prévias. Use como referência de implementação.
6. A fonte do nome do casal (`--font-evento`) troca a cada evento; o exemplo, Birthstone Bounce, vem do Google Fonts.

## Arquivos

- `tokens/tokens.json`: fonte de verdade dos tokens.
- `tokens/tokens.css`: variáveis CSS, temas e classes de texto.
- `tokens/tailwind.preset.js`: preset para Tailwind v3.
- `fonts/`: Bricolage Grotesque (variável, 200 a 800) e Instrument Serif (regular e itálico). Licença OFL em `licencas/`.
- `logos/`: wordmark, selo e ícone do app em SVG vetorizado.
- `icones/`: ícones de interface em SVG.
- `componentes/`: guia e prévia de cada componente.

MemoriesMT é uma câmera coletiva para eventos. O convidado aponta a câmera para o QR, entra com o nome e posta. Cada foto aparece na hora no feed da festa, organizada por momento e por mesa, com a identidade do evento na frente e a marca MemoriesMT só como assinatura.

Personalidade: espirituosa, afetuosa, precisa. Não é fofa. A interface é editorial e calma; quem dá cor à festa é o evento.

## Nome e marca

- Em texto corrido, escreva **MemoriesMT**: uma palavra, com M e MT em maiúscula. Nunca "Memories MT", "memoriesmt" ou "Memories".
- O logotipo é o wordmark `memoriesmt-wordmark.svg`: "memories" em caixa baixa, Bricolage Grotesque 800, tracking -0,04em, seguido do selo MT. Use `memoriesmt-wordmark-negativo.svg` sobre tinta ou fotos escuras.
- O selo `memoriesmt-selo.svg` é um disco cheio com "MT" vazado. Ele vira ícone do app, favicon, avatar de perfil e assinatura pequena.
- Construção do wordmark: diâmetro do selo = 0,72 do corpo da palavra; espaço entre palavra e selo = 0,16 do diâmetro; base do selo na linha de base.
- Construção do selo: "MT" em Bricolage Grotesque 800, largura de 0,66 do diâmetro, centralizado no círculo.
- Área de proteção: 25% do diâmetro do selo em todos os lados.
- Tamanho mínimo: selo com 16px; wordmark com 96px de largura.
- Ícone do app: `memoriesmt-icone-app.svg`, fundo tinta com cantos `radius-icone` e selo branco. Durante um evento ao vivo, use `memoriesmt-icone-app-ao-vivo.svg`, com o ponto `rec` no canto.
- Não distorça, não recolora fora de tinta e branco, não contorne e não separe o selo do wordmark em peças de marca.
- Em telas e impressos do evento, a marca aparece só como assinatura discreta (componente Signature): "por" + selo + MemoriesMT, em `apoio`, 13px.

## Cor

- Dois temas: **Dia** (padrão) e **Noite** (pista, festa à noite). Todo componente funciona nos dois.
- Proporção de referência no Dia: branco 48 · tinta 28 · neutro 16 · apoio 5 · REC 3.
- Texto principal em `tinta` sobre `fundo`, `neutro` ou `evento-superficie`. Texto secundário em `apoio`.
- Ação principal em `acao` com texto `on-acao`. Na Noite, `acao` fica claro e o texto escuro; nunca fixe branco sobre `acao`.
- `rec` é o ponto vermelho de gravando: "Ao vivo", "acabaram de postar", ícone ao vivo. Use no máximo 10% da tela, nunca como fundo grande e nunca em texto. Texto vermelho usa `rec-texto`.
- `borda` é decorativa (1,5:1). Campos e botões secundários usam borda de 1,5px em `tinta`.
- Separe áreas por superfície (`fundo` contra `neutro`) e por `divisor`. Não use sombras.
- Foco do teclado: contorno de 2px em `foco` com 2px de afastamento, em todo elemento interativo.
- Cores do evento ficam nos tokens `evento-*`. Veja a seção Camada do evento.

## Tipografia

- Bricolage Grotesque (`sans`) para marca e interface. Títulos em 800 com tracking negativo: `display-xl`, `display`, `titulo-pagina`, `titulo-tela`, `titulo-card`.
- Texto corrido em `corpo`, 17px. No mobile, nada de leitura abaixo de 17px; `meta` (13px) só para metadados.
- `eyebrow` sempre em caixa alta, 12px, peso 600, tracking +0,08em, em `apoio` ou `evento-profundo`.
- Instrument Serif itálico (`serif`) só para emoção: confirmação ("Sua visão entrou na história."), abertura de descoberta, capa de retrospectiva. Um por tela, no máximo.
- A fonte do evento (`evento`) aparece só no nome do casal. Nunca em botões, rótulos ou texto corrido.
- Números no padrão brasileiro: 1.284 fotos; horário 21h40; data 12 · 12 · 2026.

## Espaço, raio e alvo

- Margem lateral no mobile: `space-4`. Padding de tela: `space-6`. Admin: `space-8` vertical e `space-9` horizontal.
- Cantos crescem com o elemento: `radius-md` em abas e botões pequenos, `radius-control` em campos e botão de 56px, `radius-lg` em fotos e CTA de 64px, `radius-xl` em CTA de 72px.
- Pessoas e status são redondos: avatar, ponto `rec`, contador e chips usam `radius-pill`.
- Alvo mínimo de toque: `size-alvo` (44px). Ação principal: `size-campo` (56px), `size-cta` (64px) ou `size-cta-xl` (72px).
- No mobile, a ação de postar fica fixa no rodapé, acima da barra de navegação, sempre alcançável com o polegar.

## Iconografia

- Ícones de traço: grade de 24px, traço de 2px (2,2px no item ativo), terminações e cantos arredondados, sem preenchimento. Exceção: `mais` (três pontos cheios).
- Tamanho de uso: 22px na navegação, 24px em botões, 28px em estados vazios.
- Os arquivos do grupo Icones são de uma tinta só (`#1C1917`). Para recolorir, insira o SVG inline com `stroke="currentColor"`.
- Ícone sozinho sempre com `aria-label`. Sem emoji na interface.

## Imagens

- A foto do convidado é o conteúdo: sem moldura, sem filtro, cantos `radius-lg` no feed e `radius-control` nas miniaturas.
- Enquanto a foto carrega, mostre o espaço em `evento-superficie`.
- Tags sobre fotos ("Escolha dos noivos") usam fundo `fundo`, texto `tinta`, `eyebrow` em 11px e `radius-pill`.

## Acessibilidade

- Contraste mínimo de 4,5:1 para texto e 3:1 para ícones e bordas de controle, nos dois temas. As notas de cada token trazem os pares medidos.
- `on-desabilitado` sobre `desabilitado` fica em 4,0:1 no Dia: aceito só no estado desabilitado.
- Estados nunca dependem só de cor: "Ao vivo" tem o ponto e a palavra; erro tem texto; item atual tem peso 800 e `aria-current`.
- Botões são `<button>`, links são `<a href>`, campos têm `<label>`.

## Conteúdo e voz

MemoriesMT fala com quem está na festa: de perto, rápido, com humor leve. A interface nunca compete com o momento.

### Regras

- Português do Brasil. Trate o convidado por "você". A marca fala em primeira pessoa do plural só quando age por ele ("A gente termina daqui.").
- Frases curtas. Um verbo de ação por botão, em tom de convite: "Postar daqui", "Entrar na festa", "Ver no Agora".
- Sem emoji, sem travessão, sem exclamação na interface. Exclamação só nas sugestões de legenda, que são a voz do convidado.
- Caixa de frase em títulos e botões. Caixa alta só em `eyebrow`.
- Nomes de seção fixos: **Agora** (feed ao vivo), **Explorar** (momentos e mesas), **Você** (suas fotos).
- O ponto de vista de cada pessoa é uma **visão**: "Visão da Mesa 8", "Visão do bar", "Visão de Ana".
- Erro diz o que aconteceu e o que fazer: "Código não confere. Confira no card da mesa."
- Falta de sinal tranquiliza: as fotos ficam guardadas e sobem sozinhas.

### Frases de assinatura

- "A festa vista por todo mundo."
- "Todo mundo viu um casamento diferente. Agora dá para ver todos."

### Microcopy de referência

| Momento | Texto |
|---|---|
| Entrada | A visão da Emy. A visão do Igor. Agora, a sua. |
| Campo de nome | Como te chamam na festa? |
| Consentimento | Ao postar, você autoriza os noivos a guardar e compartilhar a foto. |
| Dentro da festa | Você está dentro, Ana. |
| Postar | Viu alguma coisa boa? Posta. |
| Enviando | Pode guardar o celular. A gente termina daqui. |
| Sem sinal | Sem sinal agora. Suas 3 fotos estão guardadas. |
| Publicado | Sua visão entrou na história. |
| Explorar | Enquanto você estava na pista… |
| Descoberta | Você perdeu isso. |
| Card de mesa | Essa mesa também faz parte da história. |
| Painel dos noivos | Seu casamento por todos os ângulos. |
| QR Code Studio | Cada QR sabe de onde veio. |
| Pedido de remoção | Mais opções, incluindo pedir para remover |

### Dados e números

- Milhar com ponto (1.284), horário com "h" (21h40), data com pontos médios (12 · 12 · 2026).
- Metadado no formato "Momento · tempo": "Pôr do sol · há 2 min".
- Dados fictícios em telas de exemplo sempre marcados como "dados de exemplo".

## Camada do evento

Cada evento veste o produto com a própria identidade: paleta e monograma do convite, fonte do nome do casal. O produto continua em tinta, neutro e REC; o evento entra por cinco cores e uma fonte.

### O que cada evento define

| Token | Papel | Regra |
|---|---|---|
| `evento-superficie` | Faixa de entrada, aviso, espaço de foto, trilho do ranking | Clara no Dia; `tinta` precisa ter 4,5:1 ou mais sobre ela |
| `evento-grafismo` | Grafismo e superfície decorativa | Nunca texto |
| `evento-controle` | Borda e controle no tema | 3:1 ou mais sobre `fundo`; nunca texto |
| `evento-texto` | Avatar, barra do ranking, destaque | 4,5:1 ou mais sobre `fundo` e `evento-superficie`; `on-evento` sobre ela também |
| `evento-profundo` | Nome do casal, eyebrow do evento | 4,5:1 ou mais sobre `fundo` e `evento-superficie` |
| família `evento` | Nome do casal | Só no nome; nunca em botões ou texto corrido |

### Como montar o tema

1. Extraia a paleta e o monograma do convite.
2. A cor mais característica do convite costuma reprovar como texto. Use-a em `evento-grafismo` e derive uma versão escura para `evento-texto` e `evento-profundo`.
3. Meça os pares acima nos temas Dia e Noite antes de publicar.
4. No tema Noite, a cor original do convite costuma passar como texto sobre `fundo`; use-a em `evento-texto`.
5. Mantenha `rec`, `acao` e `tinta` do produto. O evento não troca a cor de ação nem o ponto de gravando.

### Exemplo: Emy e Igor, sálvia

| Token | Dia | Noite |
|---|---|---|
| `evento-superficie` | `#E8ECE4` | `#262D24` |
| `evento-grafismo` | `#AAB4A2` | `#5B6752` |
| `evento-controle` | `#889082` | `#889082` |
| `evento-texto` | `#5B6752` | `#AAB4A2` |
| `evento-profundo` | `#4A5543` | `#C9D1C1` |
| família `evento` | Birthstone Bounce | Birthstone Bounce |

A sálvia original (`#AAB4A2`) mede 2,2:1 sobre branco e reprova como texto no Dia; na Noite mede 8,7:1 e vira o texto do evento.

### Marca MemoriesMT no evento

- Identidade do evento na frente; MemoriesMT só como assinatura (componente Signature) no rodapé da entrada, do card de mesa e dos PDFs.
- Em contratos com parceiros, a assinatura pode trocar "MemoriesMT" pelo nome do cerimonial: "Experiência por Cerimonial X".

## Componentes

- `componentes/AdminNav/`: Menu lateral do admin: wordmark, seletor de evento e seções.
- `componentes/Button/`: Botão de ação em seis variantes: primário, CTA, secundário, pequeno, texto e destrutivo.
- `componentes/Chip/`: Pílula de 44px para reações, filtros de momento e sugestões de legenda.
- `componentes/CountBadge/`: Contador em pílula de 24px para pendências: pedidos de remoção, fotos novas para moderar.
- `componentes/Cover/`: capa do sistema.
- `componentes/DataRow/`: Lista de linhas com rótulo e valor, para acessos por QR e rankings do admin.
- `componentes/EventHeader/`: Faixa de abertura com data, local e nome do casal: a identidade do evento na frente.
- `componentes/Field/`: Campo de texto de 56px com rótulo, ajuda e erro.
- `componentes/LiveIndicator/`: Ponto `rec` com rótulo em `eyebrow`, para sinalizar que o evento está ao vivo ou que algo acabou de acontecer.
- `componentes/Notice/`: Aviso do cerimonial fixado no topo do feed, na cor do evento.
- `componentes/OptionGroup/`: Grupo de opções exclusivas em botões de 48px, para configurações do admin.
- `componentes/PostCard/`: Post do feed Agora: autor, momento, foto, legenda e reações.
- `componentes/Progress/`: Barra de 8px para envio de fotos e para ranking de momentos.
- `componentes/Signature/`: Assinatura discreta da marca nas telas e impressos do evento: "por" + selo + MemoriesMT.
- `componentes/StatTile/`: Card de número para o painel dos noivos e o admin.
- `componentes/Stepper/`: Contador numérico com botões de menos e mais, para escolher o número da mesa.
- `componentes/TabBar/`: Rodapé fixo do convidado: o CTA "Postar daqui" acima de três abas.
- `componentes/TableCard/`: Card de mesa impresso em A6 com QR Code da mesa.
- `componentes/Tabs/`: Abas de 44px para alternar filas e filtros no admin.
- `componentes/VisionTile/`: Miniatura de uma visão no Explorar: a foto de capa com o nome da visão no rodapé.
