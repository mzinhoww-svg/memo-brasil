# Desempenho de dados no cliente (feat/perf-pdata)

Queixa: trocar de página e carregar telas era muito lento. Todas as telas de `/e/[code]` e `/painel/[id]` são client e
o atraso vinha de idas ao Supabase **em série** no navegador (projeto em us-west-2, ~310 ms por ida a partir do Brasil).

## Como foi medido

Não há Supabase local, então as idas foram contadas com um cliente Supabase falso (`web/src/perf/fake-supabase.ts`):
cada consulta PostgREST, RPC, chamada de Storage ou `auth.getUser()` conta como 1 ida e só responde depois de `LATENCY`
no relógio falso do vitest; `auth.getSession()` é local (como no SDK enquanto o token vale). "Em série" = quantos degraus
de latência até a tela ter o que mostrar (o tempo de espera ≈ em série × 310 ms). Cenário: evento com 20 fotos, sem
miniaturas `.thumb` no Storage (o app hoje não grava miniaturas). O "antes" foi medido no commit `ca3979b` com o mesmo
cliente; o "depois" está fixado em `web/src/perf/round-trips.test.ts` (roda no `npx vitest run`).

| Tela / ação | Antes | Depois | Espera estimada (antes → depois) |
|---|---|---|---|
| Feed do convidado (evento + 20 fotos) | 46 idas / 45 em série | 7 idas / 3 em série | ~14 s → ~0,9 s |
| `readEventScoped` convidado (layout, polling 45 s) | 6 / 5 | 6 / 2 | ~1,6 s → ~0,6 s |
| `readEventScoped` anfitrião (layout do painel) | 6 / 5 | 5 / 2 | ~1,6 s → ~0,6 s |
| Painel › Conteúdo (evento + 20 miniaturas) | 66 / 65 | 6 / 3 | ~20 s → ~0,9 s |
| Abertura do app (provider: identidade + `canCreate`) | 3 / 3 | 1 / 1 | ~0,9 s → ~0,3 s |
| `/eventos` (lista + contagens do destaque) | 4 / 3 (+1 em série e N idas com festas de terceiros) | 4 / 2 | ~0,9 s → ~0,6 s |
| Curtir no feed (até a tela mostrar a curtida) | 9 / 8 (react + refresh completo) | 0 / 0 (otimista) | ~2,5 s → imediato |
| Curtir: idas em segundo plano | — | 4 (gravação inalterada + releitura só das reações) | — |
| Voltar ao feed com as mesmas 20 fotos (+ abrir uma) | 40 / 40 (cache era por componente; URL nova a cada assinatura) | 0 / 0 (cache de módulo, mesma URL) | ~12 s → imediato |

Navegação (contada com repositório espião nos testes de `useEventData`/`useCachedQuery` em `web/src/features/app/hooks.test.tsx`):

| Navegação | Antes | Depois |
|---|---|---|
| Convite `/e/[code]` → câmera `/e/[code]/postar` (já membro) | 2 leituras completas (12 idas, 10 em série) e "Carregando a festa" de novo | 1 leitura; a câmera abre do cache, sem tela de carregando e sem ida (relê por baixo só se a leitura tiver mais de 15 s ou depois de uma escrita) |
| Convite → câmera (acabou de entrar) | idem | a leitura como membro sai no botão "Entrar" (6 idas / 2 em série) e a câmera abre direto |
| `/eventos` → `/painel/[id]` → `/eventos` | refaz lista e contagens com skeleton | mostra na hora; relê por baixo se tiver mais de 15 s ou depois de uma escrita |
| Painel → outra aba do painel | layout persiste (sem mudança) | idem |

## O que mudou

- **URLs de foto** (`repositories/supabase/index.ts`, `features/app/photo-urls.ts`, `usePhotoUrls`): caminho
  `${event_id}/${id}` montado no cliente (constraint `photos_path_matches`; miniatura `${caminho}.thumb`, confirmado nas
  migrations de Storage e purga) e assinatura em lote com `createSignedUrls(paths, 3600)`. Para `thumb`, miniatura e
  original vão no mesmo lote e a original vence quando não há miniatura (sem sondagem por foto). Cache de módulo por
  (foto, tamanho), renovado 5 min antes de vencer, mesma URL entre telas (o navegador reaproveita a imagem). Object URLs
  locais continuam com dono e são liberados ao desmontar. Feed: lista em `thumb`, foto aberta e vizinhas em `full`.
- **`readEventScoped`** (`features/access/read.ts`): depois do evento, participação, fotos, contagens, participantes e
  reações num único `Promise.all`; anfitrião não consulta a própria participação; recusas do lote (ex.: `event_counts`
  para quem não é membro) só valem depois de confirmada a participação, e quem ainda é "convite" recebe só a prévia.
- **Provider** (`features/app/identity.ts`, `users.current/save`): id e `is_anonymous` de `auth.getSession()`;
  `canCreate` do mesmo resultado; sem o segundo `auth.getUser()`.
- **Cache SWR de módulo** (`features/app/data-cache.ts`): `useEventData` (chave pessoa + código/id) e `/eventos`
  (`useCachedQuery`). Invalidação: escrita em qualquer repositório marca como velho (`features/app/invalidate.ts`), troca
  de pessoa/logout limpa, curtida atualiza o cache na hora (`features/feed/optimistic.ts`).
- **`listMine`**: eventos criados e eventos em que entrou (embed `participants → events`) em paralelo; `loadMyEvents`
  não confere participação de novo quando o servidor já filtrou.

## Segurança

Nada disso move autorização para o cliente. O cache guarda só o que o servidor (RLS/RPC/política do Storage) ou a
fronteira `readEventScoped` já entregaram para a sessão atual, com o id da pessoa na chave, e é limpo na troca de pessoa.
`getSession()` decide apenas o que a interface mostra; toda consulta leva o JWT, que o servidor valida.

## Verificação

- `npx tsc --noEmit`: 0 erros. `npx eslint .`: 0 erros (19 avisos, os mesmos de antes). `npx vitest run`: 1177 testes ok
  (uma rodada teve 1 falha intermitente em `features/photos/postar.test.tsx` "cancela Avançar antes da travessia", área
  da câmera, não tocada aqui; passou nas duas rodadas seguintes da suíte inteira).
- E2E no build de produção local (`NEXT_PUBLIC_MM_BACKEND=local ... npm run build && npx next start -p 3262`,
  `pw.local.config.ts`): **124 ok / 62 skipped** (12,3 min).

## Pendências (fora da área deste trabalho)

- O app não gera miniaturas `.thumb` (envio em `features/photos/**`, área da câmera): grade e feed baixam a original. Gerar
  a miniatura no envio cortaria os bytes baixados; o código de leitura já prefere a miniatura quando ela existir.
- `postar/**` chama `refresh()` completo depois de cada foto (agora 2 idas em série em vez de 5); poderia atualizar
  `counts.mine` de forma otimista.
- `loading.tsx`/skeletons/layouts de rota não foram tocados (área de rotas).
