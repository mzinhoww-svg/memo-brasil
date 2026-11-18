# Preços simples, paywall direto e página para o Google

## Por quê
Hoje a escolha de plano pede conta: quatro planos pagos (Festa R$ 59,90 · Celebração R$ 89 · Casamento R$ 189 · Grande R$ 349),
pacote "Mais poses" por cima e um passo "Poses" (10/24/36) no assistente que muda o plano por tabela. O dono quer **poucos preços
e precificação objetiva**, no espírito do userevela.app. E quem busca "fotosdocasamento.online" no Google não acha uma página
que explique o produto: a home é uma tela de app (cliente, quase sem texto) e o site não tem `robots`/`sitemap`.

## Decidido pelo dono
| Faixa | Preço |
|---|---|
| Até 10 convidados | Grátis |
| Até 150 convidados | R$ 147 |
| Até 300 convidados | R$ 297 |
| Acima de 300 | Falar no WhatsApp |

O único eixo de preço é o **número de convidados**.

## Metas
1. Catálogo com exatamente esses 3 planos visíveis (Grátis, 150, 300) + chamada ao WhatsApp acima de 300.
2. Paywall (página `/precos`, `/painel/[id]/plano`, assistente) com uma pergunta só: "quantos convidados?".
3. Página pública indexável em `/` que ranqueia para "fotos do casamento" / "fotosdocasamento.online".

## Não-metas
- Trocar o provedor de pagamento, o fluxo de pedido/estorno ou as regras de direito (entitlement).
- Página de blog/vários artigos de SEO.

## Anti-metas (falha mesmo funcionando)
- Quem já pagou um plano antigo perder acesso ou ver o plano "sumir" do painel.
- O cliente ter de escolher número de fotos/poses para saber o preço.
- A home ficar mais lenta ou o convidado (que entra pelo QR) ser afetado.

## Abordagens consideradas
- **A. Um preço só** — mais objetivo, mas cobra igual festa de 40 e de 300.
- **B. Dois preços pagos por faixa de convidados** — escolhido pelo dono (com Grátis até 10 e WhatsApp acima de 300).
- **C. Três tamanhos com visual limpo** — muda menos, mas mantém três escolhas.

## Design

### 1. Catálogo (migration no Supabase)
- Novos planos: `ate150` "Até 150 convidados" (150 convidados, R$ 147,00) e `ate300` "Até 300 convidados" (300, R$ 297,00),
  `ate150` em destaque (`highlighted`). Grátis continua `max_guests = 10`.
- Poses por convidado: **36 nos dois pagos** (o "rolo de 36"); Grátis segue com 10. *(Chamada do Claude: elimina a variável poses
  da decisão; ajustável pelo Master depois.)*
- Planos antigos (`festa`, `celebracao`, `casamento`, `grande`, variantes `_36`) ficam com `production_active = false`, **não são
  apagados**: eventos que já os compraram continuam reconhecidos (nome, limites) via lookup por código.
- Pacote "Mais poses" sai da venda (variantes já estão desligadas em produção).

### 2. Paywall
- **`/precos`**: título "Quantos convidados vão à festa?", três cartões (Grátis · até 150 · até 300) mostrando só preço e faixa de
  convidados, destaque no de 150, e linha "Mais de 300 convidados? Fale no WhatsApp". Linha de garantias curta (sem app para
  convidados, revelação programada, download de todas as fotos).
- **Assistente (`/criar`)**: o passo "Poses" sai. O evento nasce no Grátis; o plano é escolhido depois, no painel, quando o
  anfitrião quiser mais de 10 convidados. *(Chamada do Claude: tirar o pagamento do caminho de criação reduz o abandono e deixa uma
  escolha só.)* Código de cortesia (`/c/<código>`) continua funcionando.
- **`/painel/[id]/plano`**: mesmos dois cartões pagos + WhatsApp; o resto do fluxo (pedido, Pix/cartão, pendente, pago, expirado)
  fica como está.
- WhatsApp: usa o número/link já configurado no projeto (a ser confirmado pelo construtor).

### 3. Página para o Google (`/`)
- `/` vira página **renderizada no servidor** com texto real: título `Fotos do casamento tiradas pelos convidados | Revela`,
  descrição, H1, como funciona (3 passos: cria o evento, convidados escaneiam o QR, fotos revelam na hora marcada), os preços
  acima, perguntas frequentes e CTA "Criar evento grátis".
- Os botões atuais (Google / e-mail / "Minhas câmeras" para quem já está logado) continuam no topo; o vídeo de abertura fica.
- Metadados: `metadataBase` = `https://fotosdocasamento.online`, canonical, Open Graph, JSON-LD (`Organization` + `Product` com as
  ofertas + `FAQPage`).
- `app/robots.ts` (libera `/`, `/precos`, `/ajuda`, `/privacidade`, `/termos`; bloqueia `/painel`, `/master`, `/e/`, `/api`,
  `/conta`) e `app/sitemap.ts`.
- Passo manual do dono (fora do código): verificar o domínio no Google Search Console e enviar o sitemap.

## Wireframes (aprovados)
https://claude.ai/artifact/3gAPZB7eY8HQuXiChWCXZk — home pública e paywall em 4 telas (limite no painel → escolha → pagamento → pago).

## Fica para o construtor
- Textos finais da página e do FAQ (pt-BR, tom do produto).
- Ajuste dos testes existentes de catálogo/paywall/assistente para o novo catálogo.
- Detalhes visuais seguindo o design system Revela já existente.
