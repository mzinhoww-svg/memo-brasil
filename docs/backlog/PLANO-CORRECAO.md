# Plano de correção do lote de melhorias (itens 1 a 9)

Base: `MELHORIAS-LOTE.md` (o que você relatou) + leitura do código por 4 investigações independentes e uma crítica cruzada. Nada foi alterado no app. Cada onda abaixo é publicável sozinha, pelo procedimento de `docs/supabase/PUBLISH-AND-ROLLBACK.md` (candidato sem tráfego, validar, promover, smoke test). Só mexemos em produção depois do seu ok de cada onda.

## 1. O que a leitura do código mudou no diagnóstico

| Item | Relato | O que o código mostra |
|---|---|---|
| 1 | Carrossel de planos não rola | Confirmado. A trilha anda por `translateX` ligado ao plano escolhido, com constantes fixas (112 px, 350 px). O mesmo bloco existe também no passo 8 do assistente de criação (`CameraPublicar`) e na prévia do Master. |
| 2 | Retrospectiva errada | As 4 causas estão confirmadas. Há ainda: o gráfico agrupa por hora em UTC (erra em fusos de 30 min), "Fotógrafos" conta só as fotos que a pessoa vê (o convidado vê sempre 1) e o "Pico" mostra o início de uma janela de 10 min com o rótulo do momento do upload. |
| 3a e 9 | Anfitrião preso | Confirmado e é o mesmo problema. O layout já sabe que é o anfitrião, mas nenhuma tela usa isso. A origem também é nossa: em `/eventos`, o botão principal do dono abre o Feed do convidado em vez do painel. |
| 3b | Painel com cara de web | Em parte. Só 3 rotas usam o layout web antigo (plano, aparência, checkout). As outras 13 não recebem cabeçalho nenhum. O painel tem dois layouts incompatíveis e nenhum mobile único. |
| 4 | QR não troca de modelo | Ajuste: não existe carrossel de modelos. O cartão é um só e o "modelo" só troca o texto. As bolinhas medem 6 px, não têm teclado e não há gesto. |
| 5 | Botão do plano cortado | Só vale no ramo "nativo", ligado pela variável `NEXT_PUBLIC_VALIDAPAY_CHECKOUT`. Sem ela, a tela de plano é outra, com botão fixo e testada. **Precisamos saber qual ramo está em produção.** |
| 6 | Conteúdo "tudo preto" | Pior do que o relato: é bug funcional. A tela tem altura fixa e não rola, então fotos além da primeira tela, "Ver mais fotos" e "Revelar agora" ficam inalcançáveis. O mesmo vale para Convidados, Convites, Moderação, Downloads e Programação. |
| 7 | Ajustes levam a telas ruins e "não funcionam" | Visual confirmado. "Não funciona" não se confirma na gravação (os salvamentos passam por versão e repetição em conflito). O que está quebrado: o aviso "Salvo." aparece **atrás** da folha aberta (z-index 30 contra 50), então parece que nada aconteceu. Além disso, 3 testes e2e estão desatualizados desde o redesenho. |
| 8 | Voltar da Retrospectiva | A seta é fixa para o Feed e o Feed perde a rolagem (a rolagem é interna, o navegador não restaura). O Feed já reserva espaço para a barra de abas (92 px), mas a barra não soma a área segura do iPhone. O card da foto tem largura fixa de 350 px. |

## 2. Antes de começar (pré-requisitos, meio dia)

1. **Consertar os e2e desatualizados de `/configuracoes`:** `e2e/helpers.ts:108-118`, `audit-a1-reveal.spec.ts`, `audit-a1-journeys.spec.ts`. Sem isso, não temos rede de segurança nos Ajustes.
2. **Confirmar o ramo do checkout em produção** (`NEXT_PUBLIC_VALIDAPAY_CHECKOUT`). Rodar os e2e de plano nos dois ramos.
3. **Gerador de telas:** os arquivos em `src/revela/screens/*` são gerados por `scripts/html-to-tsx.mjs`. Se o gerador ainda roda no CI, edições manuais somem. Definir antes: ou eles passam a ser manuais, ou as mudanças vão em modificadores de CSS e wrappers.
4. **Exigir que o CI mostre os specs de painel executados.** Os e2e se pulam sozinhos quando falta o Supabase local, então podem "passar" sem rodar.
5. **Rodar a suíte inteira antes da onda 1** para ter a linha de base.

## 3. Ondas de entrega

Regra de conflito: 3a+9 sempre juntos; o 8 depois deles, nunca em paralelo (mesmos arquivos: `GuestTabs`, `ConvidadoVoce`, `FeedEvento`). `revela2.css` é tocado por quase todos, então cada tema novo vai num CSS novo.

### Onda 1: destrava o uso (risco baixo)
- **A. Rolagem das telas do painel** (item 6, e o corte do 5): modificador `scr--scroll` (ou `scr--page`) escopado ao painel, com `padding-bottom` de `env(safe-area-inset-bottom)`, em Conteúdo, Convidados, Convites, Moderação, Downloads, Programação, QR, Aviso. No Plano nativo, o botão Confirmar fica visível no fim. **Sem tocar em `pay` nem na idempotência** (`plano/page.tsx:79-103`).
- **B. Anfitrião preso** (3a+9, versão mínima): hook `useHostNav`; em Você, as linhas "Voltar ao painel" e "Meus eventos"; faixa `HostBar` no Feed ("Você está vendo como convidado · Voltar ao painel"); em `/eventos`, o botão principal do dono abre o painel (o Feed vira ação secundária).
- **C. Aviso "Salvo."** (item 7): toast com `z-index` acima das folhas, `aria-live`, e fechar "Salvar seu nome" ao concluir.
- **Testes:** `GuestTabs`/Você/HostBar (vitest), e2e `host-volta.spec.ts` (dono: Meus eventos → evento → painel → Meus eventos; convidado não vê nada disso), varredura mobile inicial.

### Onda 2: componentes isolados
- **Carousel + PlanCards** (item 1): `src/revela/Carousel.tsx` com rolagem nativa e encaixe (`scroll-snap`), setas de 44 px, teclado, `aria`. `PlanCards` unifica o JSX duplicado de `CameraPublicar` e `PagamentoTrocarPlano`. **Rolar nunca seleciona plano** (só o toque), para ninguém escolher sem querer. Entra também no passo 8 do assistente, que afeta a venda, então roda o teste do wizard.
- **QR** (item 4): N cartões (um por modelo) no Carousel, bolinhas-botão de 44 px, setas, o download usa o modelo ativo, QR renderizado só no ativo e vizinhos, cartão `min(330px, 100%)`.
- **Retrospectiva** (item 2): horas contínuas no fuso do evento (vazias com 0), barra com largura máxima (`.bars--retro`, sem afetar o Master), número sobre a barra, agrupamento em eventos longos, título por categoria ("A festa", "O evento de empresa"...), pico como faixa "19:40–19:50", estados vazio e de poucos dados.
- **8-A:** card da foto fluido e variável `--tabs-h` com área segura (CSS).
- **Testes:** `Carousel.test`, `PlanCards.test`, `QRConvite.test`, `retro.test` (0, 1, 2 fotos, dias diferentes, meia-noite, fuso de Cuiabá e de 30 min), `FeedRetrospectiva.test`; e2e `qr-download`, `motion-moments`, `reveal-visual`, `feed-revela`.

### Onda 3: reestrutura o painel
- **PainelFrame** (item 3b): `src/components/revela/PainelFrame.tsx` + `painel-frame.css`: cabeçalho fixo com seta de voltar e título único, abas com rolagem e fade nas duas bordas e aba atual visível, corpo com área segura, rodapé fixo opcional. **Uma rota por vez, atrás de flag**, nesta ordem: Conteúdo → Plano → Aparência → Ajustes → listas → resto → Visão geral por último. Estados de erro, sem permissão e carregamento do shell entram no frame.
- **Conteúdo** (item 6): grade de 2 colunas, legenda com autor e hora, filtros (todas, removidas, denunciadas, por pessoa), toque abre a foto grande com Remover/Devolver/Destacar, estado vazio com ação, esqueleto no lugar do quadrado transparente.
- **Plano** (item 5): extrair `PlanoConteudo` (sem `.scr`, sem segundo cabeçalho), botão no rodapé fixo, aviso de pagamento no fluxo, sair de `LEGACY`.
- **Aparência** (item 3b/7): prévia recolhível de ~160 px sem `sticky`, título único, Salvar no rodapé, texto do filme conforme a opção marcada.
- **Ajustes** (item 7): Plano e Aparência viram sub-telas dos Ajustes; `SheetRevela` com alvos de 44 px, rodapé fixo, teclado e área segura; "Embalagem/Filme" como folha própria. Um ajuste por PR: Feed, Nome, Poses, Fecha, Revela, Embalagem/Filme, Plano, Mais.
- **8-B:** `useSmartBack` (voltar pelo histórico com contador interno e fallback ao Feed) e restauração da rolagem do Feed (guardada no `onScroll`, com `sessionStorage` protegido por try/catch). Usar também em Programação, Aviso e Editar. A quarta aba "Painel" entra aqui, depois da faixa.
- **Testes:** `PainelFrame.test`, varredura única `e2e/painel-mobile-layout.spec.ts` (390×844 e 360×640: sem rolagem horizontal, 1 `h1`, botão principal e último item visíveis acima da área segura, alvos de 44 px), `conteudo` e `configuracoes` com repositório em memória (salvar de verdade, a tela de trás atualiza).

### Onda 4: limpeza e acabamento
Remover `LEGACY`, `app-admin*`, `Breadcrumbs`, `.dots` e `planShift`; decidir o destino do painel no desktop; acessibilidade (`a11y.spec`, `revela-a11y.spec`), tema Noite nas telas novas, PWA.

## 4. Fora do lote, mas encontrado (entra nas ondas ou vira item novo)
- `router.replace` chamado durante a renderização em `e/[code]/(app)/layout.tsx:106-109` (mover para `useEffect`).
- `PlanPicker` usa `history.back()`: em entrada direta por link, sai do app.
- Texto "Filme 35mm" aparece sempre na Aparência, mesmo com Natural marcado.
- Lista de autores (stories) do Feed corta quando há muitos.
- Interruptor "Feed com curtidas" sem rótulo acessível; cartões de plano sem navegação por setas.
- Toast de Você fixo em 84 px, sem área segura.
- Sem a barra do navegador (PWA no iOS), não existe botão de voltar: o 8 e o 9 ficam ainda mais críticos.

## 5. Riscos de publicação
- **Cache e PWA:** as rotas são pré-renderizadas e há service worker; verificar que o CSS novo chega (testar a atualização do SW) antes de promover.
- **Flag de build do checkout** precisa ser confirmada em produção.
- **iOS Safari real:** altura dinâmica, área segura, teclado nas folhas, `scroll-snap` e o gesto de voltar pela borda contra o primeiro card não se reproduzem no Chromium. Exigir checagem em iPhone antes de fechar as ondas 2 e 3.
- **Miniaturas maiores no Conteúdo:** mais links assinados por tela; manter carregamento sob demanda e paginação.
- **Animação de revelação:** o card fluido muda o recorte; rodar `motion-moments` e `reveal-visual`.

## 6. Decisões suas
1. **O botão principal do dono em "Meus eventos" deve abrir o painel** (recomendado) em vez do Feed?
2. **O painel continua existindo no desktop** (barra lateral)? Define se a onda 4 apaga o layout web de vez.
3. **Retrospectiva:** os números mostram o evento todo ou só as fotos que o convidado vê? E as reações de fotos removidas contam?
4. **Item 7, "não funciona":** se ainda tiver um caso concreto (qual ajuste, o que aconteceu), me conte. Pela leitura, só o aviso escondido atrás da folha se confirma.
5. **Qual a ordem de prioridade se quisermos publicar só parte?** Minha sugestão: Onda 1 inteira primeiro (destrava o uso), depois a 2, depois a 3.

## 7. Esforço estimado (ordem de grandeza)
Onda 1: pequena (1 a 2 dias). Onda 2: média (3 a 4 dias). Onda 3: grande (1 a 2 semanas, por rota). Onda 4: pequena. Cada onda termina com suíte completa, varredura mobile, candidato sem tráfego, validação e smoke test.
