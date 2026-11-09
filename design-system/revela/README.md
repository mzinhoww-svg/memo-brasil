# Revela 2.0 — brandkit

**Revela** é a câmera descartável coletiva para eventos. O anfitrião monta uma **câmera física** para o evento (casamento, festa, aniversário, noite), escolhendo a embalagem, e os convidados entram por QR code. Cada pessoa tem um número limitado de poses e não vê o que fotografou. Depois do evento vem a **revelação**: todas as fotos aparecem para todos, ao mesmo tempo.

A 2.0 parte de um mundo concreto: **a câmera descartável em cima da mesa da festa, fotografada com flash.** Tudo o que aparece no app sai desse mundo:

- o **objeto**: a câmera 3D, com embalagem de papelão impressa, lente, flash de estrias e roda de avançar o filme;
- o **flash**: luz dura vinda de frente, fundo escuro, sombra marcada;
- a **foto impressa**: papel com borda, canto quase reto e carimbo laranja de data;
- o **confete**: a única "decoração" do sistema, e só nos momentos de festa.

## O que mudou da 1.0 para a 2.0

A 1.0 foi auditada com as regras do Impeccable (craft floor) e do taste-skill. Problemas encontrados e o que entrou no lugar:

| Na 1.0 | Por que era slop | Na 2.0 |
| --- | --- | --- |
| Rótulo em caixa alta acima dos títulos ("SUGESTÕES", "A REVELAÇÃO") | Kicker/eyebrow: muleta de hierarquia | Título forte em Gloock; cabeçalhos de lista em caixa de frase |
| Degradês radiais fingindo foto de festa | Forma geométrica no lugar de imagem real | Cenas 3D renderizadas com luz de flash e pós de filme |
| Halo colorido sem deslocamento (`shadow-glow`) | Brilho decorativo, não é profundidade | Sombras com deslocamento e desfoque: `shadow-print`, `shadow-object` |
| Grade de cards iguais (ícone + rótulo) no onboarding | Container preguiçoso | Objetos 3D e fotos impressas como conteúdo |
| Tudo em pílula e card arredondado escuro | Ritmo monótono, sem material | Pílula só em toggle e zoom; botões de 12px como teclas de câmera |
| Laranja sobre preto + serif/grotesk genéricos | Combinação de manual | Gloock (convite) + Schibsted Grotesk (interface) + Share Tech Mono (carimbo) |
| Depoimento placeholder no paywall | Prova social falsa | Nada inventado: a câmera é o argumento |
| Clone 1:1 dos fluxos do app de referência | Sem ideia própria | Conceito "monte a câmera do evento" |

## Voz (PT-BR)

- Fala como quem organiza a festa: direta, animada sem exagero, sem exclamação em série.
- Verbo primeiro nos botões: **Montar câmera**, **Revelar a festa**, **Tirar fotos**.
- Caixa de frase em tudo. Caixa alta só no carimbo (`stamp`), porque ele imita a impressão da câmera.
- Vocabulário: **câmera** (o evento), **embalagem** (o visual da câmera), **pose** (foto disponível), **revelar / revelação**, **anfitrião**, **convidados**.
- Nunca: "upload", "feed", "conteúdo", emoji.

## Cor

O tema **Noite** é o app (uso real: salão escuro, pista, jantar à luz de vela). O tema **Dia** é para site, e-mail e impressos.

- Escada de superfícies `bg → surface-1 → surface-2 → surface-3`.
- `revela` é o CTA principal, **um por tela**, mais o obturador e a seleção. Texto sobre ele é `on-revela`.
- `carimbo` é exclusivo de **datas e contadores** em Share Tech Mono, com brilho suave. Não vira cor de botão nem de ícone.
- `champanhe` aparece em casamento e no plano Ouro.
- `paper` + `on-paper` quando algo vira papel: foto impressa, convite, QR.
- `wrap-*` são as cores das quatro embalagens: tratam-se como material, não como cores de UI.
- Sem violeta ou lilás em nenhum lugar (eram o padrão da categoria).

Contraste: `ink`, `ink-muted`, `revela-text`, `carimbo` e `champanhe` passam de 4.5:1 sobre `bg` e `surface-1` nos dois temas (verificado por cálculo).

## Tipografia

- **Gloock** (`display`): títulos, nome do evento, frases-manifesto. Serifa de alto contraste, cara de convite de casamento impresso. Sempre peso 400; o tamanho dá a hierarquia.
- **Schibsted Grotesk** (`sans`): toda a interface. 400 a 800.
- **Share Tech Mono** (`stamp`): carimbo de data nas fotos e contador de poses. Nada mais.

Todas as três vêm do Google Fonts: `https://fonts.googleapis.com/css2?family=Gloock&family=Schibsted+Grotesk:wght@400;500;600;700;800&family=Share+Tech+Mono&display=swap`

## O mundo 3D

Todos os objetos foram modelados e renderizados no Blender (Cycles), com as mesmas regras. Para criar objetos novos, siga as regras abaixo para manter a família visual.

- **Luz:** key quente à esquerda e acima, rim laranja atrás à direita, fill frio fraco embaixo. Cartões emissivos fora do quadro para reflexos em lente e metal.
- **Ângulo da câmera do evento:** 3/4 frontal, girada 34° para a direita, olho levemente acima. É o "retrato oficial" do objeto.
- **Materiais:** papelão impresso com verniz leve (coat 0.25), plástico preto acetinado, metal dourado polido, látex com verniz.
- **Fundo:** transparente nos objetos; nas cenas, salão escuro com bokeh quente.
- **Embalagens:** Festa (laranja), Casamento (marfim + faixa dourada, com o nome do casal em Gloock), Aniversário (cobalto com confete), Noite (verde garrafa + champanhe). Os arquivos de textura estão em **3D** (`wrap-*.png`).

Objetos do kit (grupo **3D**): câmera nas 4 embalagens, câmera inclinada (herói), confete, globo espelhado, alianças, balões, bolo.

## Fotos de convidados (cenas)

Enquanto não há fotos reais, o sistema usa **cenas 3D fotografadas com flash** (pista, bolo, alianças, brinde, câmera na mesa, balões), com pós de câmera descartável: calor, halação nas altas luzes, vinheta, grão e carimbo laranja `'27 03 14`. Em produção, essas cenas dão lugar às fotos dos convidados; o pós de filme continua valendo como filtro "Filme 35mm".

## Movimento

Um momento autoral por tela, nunca efeito espalhado:

- **Abertura:** vídeo em loop de 4 s. A câmera flutua girando de leve, o confete cai em loop contínuo e o flash dispara uma vez. Arquivo `revela-abertura.mp4`, em **Vídeo**.
- **Disparo:** ao tocar no obturador, um clarão `flash` de 120 ms (opacidade 0 → 0,9 → 0, ease-out exponencial) e o contador gira um número.
- **Revelação:** as fotos entram uma a uma como impressões caindo na mesa (rotação aleatória de −6° a 6°, sombra `shadow-print`), 70 ms entre cada.
- Confete só em dois lugares: abertura e evento publicado.
- Respeitar "reduzir movimento": troca vídeo por imagem estática e remove clarão.

## Componentes

`components/bundle.css` traz as classes `rv-*`. Cada componente tem preview e guia:

- **Button**: primário `revela`, papel `paper`, discreto `surface-2`. Canto 12px, altura 56px.
- **Print**: foto impressa com borda de papel, carimbo e sombra.
- **CameraStage**: render 3D sobre palco escuro, com sombra de chão e o nome da embalagem.
- **WrapPicker**: seletor de embalagem (amostras de material, não bolinhas de cor).
- **ShotCounter**: contador de poses em visor, como o da câmera física.
- **Field**, **ListRow**, **Toggle**, **TabBar**, **Sheet**, **PlanCard**, **Notice**.

## Logo

Símbolo: o círculo meio revelado (contorno em cima, metade preenchida embaixo). O wordmark agora é **revela** em Gloock, em minúsculas, convertido em curvas. Mínimos: 24px (símbolo) e 88px de largura (lockup).

## Aplicando em outro projeto

1. Copie as variáveis de `tokens.css` e aplique `data-theme="dark"`.
2. Carregue as três fontes pelo link acima.
3. Mapeie primeiro as cores (fundo → `bg`, cards → `surface-1`, primária → `revela`), depois a tipografia, depois os componentes.
4. Use os renders dos grupos **3D**, **Cenas**, **Efeitos** e **Vídeo**, ou siga as regras de luz e material para criar novos.

## Documentos de implementação
- `TELAS.md`: mapa de todas as telas por jornada.
- `JORNADA-CONVIDADO.md`: QR, cota, aviso e feed.
- `PAGAMENTO-E-PRECOS.md`: paywall com preços reais, checkout ValidaPay e edição de preços no Master.
