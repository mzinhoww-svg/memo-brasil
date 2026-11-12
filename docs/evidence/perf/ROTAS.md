# Desempenho das rotas: antes e depois (branch `feat/perf-proute`)

Build de produção local (`NEXT_PUBLIC_MM_BACKEND=local NEXT_PUBLIC_MM_DEV_TOOLS=1 NEXT_PUBLIC_MM_TEST_CLOCK=1 NEXT_PUBLIC_VALIDAPAY_CHECKOUT=1 npm run build && next start -p 3263`).
O Next 16 não imprime mais o tamanho por rota no `next build`. A medição foi feita no servidor rodando:

- **JS gzip**: soma, em gzip, dos `<script src>` do HTML da rota (o polyfill `noModule` não entra);
- **Prefetch**: corpo da resposta a `RSC: 1` + `Next-Router-Prefetch: 1`, o mesmo pedido que o `<Link>` faz.
  "Antes" é o commit `ca3979b`; "depois" é esta branch.

| Rota | Antes | Depois | JS antes (KB) | JS depois (KB) | Δ | Prefetch antes (B) | Prefetch depois (B) |
|---|---|---|---|---|---|---|---|
| `/` | ○ s-maxage | ○ s-maxage | 237.7 | 238.3 | 0.6 | 6167 | 6269 |
| `/entrar` | ○ s-maxage | ○ s-maxage | 231.5 | 235.6 | 4.1 | 6595 | 6584 |
| `/eventos` | ○ s-maxage | ○ s-maxage | 239.1 | 239.8 | 0.7 | 6597 | 9443 |
| `/criar` | ○ s-maxage | ○ s-maxage | 246.9 | 249.6 | 2.7 | 6466 | 8106 |
| `/c/ABCD12` | ƒ no-store | ● s-maxage | 234 | 237.6 | 3.6 | 297 | 8501 |
| `/e/ABCD12` | ƒ no-store | ● s-maxage | 244.5 | 245.1 | 0.6 | 297 | 9996 |
| `/e/ABCD12/agora` | ƒ no-store | ● s-maxage | 255.7 | 255.4 | -0.3 | 379 | 15801 |
| `/e/ABCD12/minhas` | ƒ no-store | ● s-maxage | 245.2 | 244.9 | -0.3 | 380 | 16619 |
| `/e/ABCD12/voce` | ƒ no-store | ● s-maxage | 295.4 | 246 | -49.4 | 378 | 15455 |
| `/e/ABCD12/postar` | ƒ no-store | ● s-maxage | 279.4 | 279.1 | -0.3 | 380 | 12774 |
| `/e/ABCD12/rolo` | ƒ no-store | ● s-maxage | 272.5 | 272.3 | -0.2 | 378 | 14157 |
| `/eventos/revelados/x1` | ƒ no-store | ● s-maxage | 240.1 | 240.6 | 0.5 | 342 | 17410 |
| `/painel/x1` | ƒ no-store | ● s-maxage | 241.6 | 244.4 | 2.8 | 296 | 10076 |
| `/painel/x1/convidados` | ƒ no-store | ● s-maxage | 243.5 | 244.2 | 0.7 | 342 | 12269 |
| `/painel/x1/qr` | ƒ no-store | ● s-maxage | 252.9 | 254.4 | 1.5 | 334 | 12410 |
| `/painel/x1/configuracoes` | ƒ no-store | ● s-maxage | 249.4 | 252.1 | 2.7 | 345 | 12275 |

## O que mudou no prefetch
- **Antes:** as rotas `/e/[code]/*`, `/painel/[id]/*`, `/c/[code]`, `/criar/pronto/[id]` e `/eventos/revelados/[id]/*` eram `ƒ` (`private, no-store`).
  O prefetch devolvia só a árvore de segmentos (~300–380 B), sem componente nem chunks. Cada clique esperava a função (iad1) + os chunks + a renderização.
- **Depois:** todas viram `●` (SSG sob demanda: `generateStaticParams() { return [] }` + `dynamicParams = true` num layout de servidor).
  O prefetch devolve a página inteira (10–17 KB: layout, `loading.tsx`, página e as referências dos chunks) com `s-maxage=31536000`
  (`x-nextjs-prerender: 1`, `x-nextjs-cache: HIT` a partir do segundo pedido do mesmo código). Na Vercel, a casca de cada código passa a sair do cache da borda.
- Verificado com `curl -L -H 'RSC: 1' -H 'Next-Router-Prefetch: 1' http://localhost:3263/e/ABCD12/minhas`: 200, `text/x-component`, 19,5 KB,
  9 chunks referenciados, o esqueleto "Carregando suas poses…" e a casca "Carregando a festa". O Next 16 primeiro responde 307 para acrescentar `?_rsc=`.

## Bundle
- `Você` do convidado: −49 KB gzip. O JSZip (`features/admin/export`) passou a ser importado só no clique (Você, Editar e Downloads do painel).
- QR (`QrDownloadSheet`) via `next/dynamic` nas páginas qr/compartilhar/convite. Rodapé com `import()` da API de cobrança. Layout raiz sem o barrel.
- Nas demais rotas o JS inicial ficou igual (±4 KB, efeito da reorganização dos chunks pelo Turbopack: o runtime do Next passou para um chunk à parte).
  O peso comum (~235 KB) é React/Next (~125 KB) + Supabase JS (~67 KB + ~27 KB de repositórios e textos de domínio). Tudo isso chega pelo `AppProvider`
  (`features/app/provider.tsx` → `repositories/**`, `lib/supabase/client.ts`), arquivos fora do escopo deste trabalho (agente de dados). **Pendência:** carregar o
  cliente Supabase só no modo `supabase` e sob demanda, dentro do provider.
- `RevealTransition` e `RevealIntro` continuam estáticos: com `next/dynamic` a transição não abria quando a revelação acontece **sem sinal**
  (o chunk não estava no cache; `e2e/reveal.spec.ts:60` falhou). Por isso ficaram no bundle do layout do convidado.

## Região
`web/vercel.json` com `"regions": ["pdx1"]` (Portland, ao lado do Supabase em us-west-2). As rotas do convidado e do painel agora saem da borda (●); o que ainda roda como função é o Master e o `/auth/callback`, que conversam com o banco no servidor, então a função fica perto do banco e não do usuário. Root Directory `web`, framework Next.js.
Só afeta as funções que ainda rodam por pedido (`/auth/callback`, `/master/*`, `/dev/revela/[screen]`, a primeira geração de cada casca `●` e a revalidação).
Páginas estáticas e cascas já geradas saem da borda, sem região.

## Esqueletos
Capturas 390×844 em `skeletons/`: `eventos-inicio`, `revelados-grade`, `painel-resumo`, `painel-secao-lista`, `assistente-camera`. Foram tiradas do HTML
pré-renderizado com os scripts bloqueados, que é exatamente o que aparece antes da hidratação. Axe (wcag2a/aa): 0 violações no painel e no assistente. Em
`/eventos` e `/eventos/revelados` aparece só `color-contrast` nas abas inativas da `HostTabs` real (`--ink-faint` sobre `--bg`, 3,86:1). Isso já existe nas telas finais do
desenho e não vem do esqueleto.
