# QA baseline — API (main @ 469792b)

Fase 1, QA cruzado. Nenhum código foi alterado.

## Método
- Worktree próprio da `main`, `DATA_DIR` temporário, `PORT=3299`, `MASTER_TOKEN` descartável.
- `npm test`: **10/10 passam** (o próprio teste usa `DATA_DIR` temporário).
- Bateria de ataques por HTTP real (Node `fetch`): entradas vazias, ids adivinhados, upload falso/grande, concorrência, reexecução, evento suspenso/encerrado, e leitura de foto antes da revelação por URL, listagem, ZIP e miniatura.
- Código-fonte lido inteiro (`server.js`, `public/common.js`, `sw.js`, trechos de `public/*.html`). Itens marcados *(estático)* foram deduzidos do código e **não** exercitados.

## Resultado em uma linha
O bloqueio das fotos antes da revelação **resiste** a todos os caminhos testados. Os problemas estão em abuso de cota/capacidade, validação do upload e tratamento de entrada inválida.

## Falhas por severidade

### Alta
**A1. Cota de fotos por convidado é burlável e o evento pode ser lotado por anônimos** (C2, L1)
- `POST /api/events/:id/guests` não tem dedupe, autenticação nem rate limit. Mesmo nome entra N vezes, cada `guestId` ganha cota própria.
- Teste: cota=1, mesmo nome entrou 5x → 6 fotos aceitas, 6 "pessoas". Com limite de 20 convidados, 20 entradas anônimas iguais → entrada 21 e 22 recebem 409 "Evento lotado" (convidados reais barrados).
- Causa raiz: a cota é por `guestId` (`server.js:425`) e o `guestId` é emitido livremente (`server.js:352-365`); o servidor não amarra a identidade a nada (nome, dispositivo, token).

**A2. Upload é bufferizado em memória antes de qualquer checagem; sem rate limit** (M1)
- 6 uploads simultâneos de 24 MB **sem `guestId` válido** (todos respondem 403) levaram o RSS do processo de ~77 MB para ~198 MB. Sem autenticação para disparar.
- Causa raiz: `multer.memoryStorage()` com teto de 25 MB (`server.js:119`) roda antes de `getEvent`/guest/suspensão/limite (`server.js:414-424`). O limite configurável (10 MB) só é conferido depois que o arquivo inteiro já está na RAM. Nenhuma rota tem rate limit; `POST /api/events` é aberto e ilimitado.

### Média
**M1. Upload aceita qualquer conteúdo declarado como imagem** (U1–U4b)
- HTML com `<script>` enviado como `image/jpeg`, `image/png`, SVG com script como `image/webp`, arquivo de 0 byte e 1 KB de lixo: todos `201`.
- O arquivo é servido depois da revelação com `Content-Type: image/jpeg`, **sem** `X-Content-Type-Options: nosniff` (Z1), e entra no ZIP. O álbum exibe imagem quebrada; o ZIP entrega lixo/HTML ao casal.
- Causa raiz: confia no `mimetype` enviado pelo cliente (`server.js:423`), sem checar assinatura (magic bytes) nem decodificar. Sem `nosniff`.

**M2. `revealAt` nulo ou no passado cria evento já revelado** (E4, E5)
- `revealAt: null` → `new Date(null)` = 1970 → `201`, evento nasce revelado: uploads dão 409 e a lista de fotos (vazia) é pública. Passado explícito idem.
- Causa raiz: `isNaN(new Date(x))` é o único teste (`server.js:163-166`, `:211-214`); `null`, `0`, `true` viram datas válidas, e não há exigência de data futura.

**M3. Qualquer membro da organização antecipa a revelação para todos, sem auditoria** (R20–R22)
- Um cerimonial (token de equipe) fez `PATCH revealAt=2020-01-01`: `200`, e a foto passou a sair sem token para qualquer pessoa. Nada foi para `audit.log`; só a versão do master audita `revelacao.alterada`.
- Causa raiz: `PATCH /api/events/:id` é `adminOnly` sem `donoOnly` e não chama `audit` para `revealAt` (`server.js:208-214`). Conforme o README o cerimonial "faz tudo, menos equipe"; confirmar com o produto se desbloquear o álbum é desejado. Corrigindo `revealAt` para trás também não reseta `revealNotified`, então o push de revelação não sai.

**M4. Evento suspenso continua servindo o álbum e aceitando interações** (S1–S4)
- Suspenso: `GET photos` 200, arquivo 200, `POST recados` 201, `POST rsvp` 200. Só `guests` e `photos` (upload) checam `suspenso`.
- Causa raiz: a flag `suspenso` é verificada ad hoc em 2 handlers, não num middleware (`getEvent`). Para suspensão por conteúdo impróprio isso é furo.

**M5. Inscrição push aceita qualquer endpoint https (SSRF cego)** *(estático)*
- `subscriptionOk` só exige `^https://` (`server.js:527`); o servidor depois chama `webpush.sendNotification` para esse endpoint no aviso/revelação. Qualquer convidado (basta um `guestId`) faz o servidor emitir POSTs para hosts internos.
- Causa raiz: sem allowlist de provedores push (fcm.googleapis.com, updates.push.services.mozilla.com, *.push.apple.com, *.notify.windows.com). Não exercitado por falta de endpoint externo.

### Baixa
**B1. 500 em vez de 4xx para entrada inválida** (E1, E6, E8, E13, E14, I2–I4)
- Sem body / sem `content-type` (`req.body` fica `undefined`) → `TypeError` → 500 em `POST /events`, `POST /guests`, `PATCH /events`, `POST /lista`. JSON malformado → 500 (deveria ser 400).
- ids `constructor`, `__proto__`, `toString`, `hasOwnProperty` passam por `getEvent` (`db.events` é objeto simples; `server.js:122`) e estouram 500 em todas as rotas do evento. O processo não cai, mas gera ruído e stack traces.
- Causa raiz: sem validação do body, `db.events[...]` sem `hasOwn`, e o handler de erro (`server.js:459`) devolve 500 para erros do `express.json` (que trazem `status: 400`).

**B2. Tipos não string viram texto** (E7): `titulo: {a:1}` → `201`, título `"[object Object]"`. Causa: `String(s)` em `clean` (`server.js:90`).

**B3. `retencaoDiasAposRevelacao` não é aplicada** *(estático)*: a variável existe em `DEFAULTS` mas nada a lê; as fotos nunca expiram. README já diz "retenção só registrada" — risco LGPD, não regressão.

**B4. Tokens em query string**: `?token=` aceito em todas as rotas de organização/master e as URLs de `moderacao`/`master/photos` expõem o caminho; tokens vão para logs de acesso e `Referer`. Comparação do `hostToken` com `===` (`server.js:132`), não constante em tempo.

**B5. `Host` define o link do convite/QR** quando `PUBLIC_URL` não está definida (`server.js:99-104`): host header injection afeta `linkConvite`, QR e links de equipe. Definir `PUBLIC_URL` em produção.

**B6. ZIP**: nome de convidado `..` cai na raiz do ZIP (o archiver normaliza `../001.jpg` para `001.jpg`; **não** há zip-slip). Arquivo ausente em disco durante o streaming interrompe o ZIP sem erro visível (`z.on('error', () => res.end())`).

## O que passou (sem falha)
| Ataque | Resultado |
|---|---|
| Foto antes da revelação: sem token, token=guestId, hostToken de outro evento, id inexistente, `..%2F`, Range, HEAD, If-None-Match | sempre 403, mesma mensagem (não revela existência) |
| Listagem pré-revelação | só `{id, bloqueada, minha}`, sem URL nem autor |
| ZIP pré-revelação | 403 sem token; 409 para casal; só master baixa |
| Miniatura | não existe rota (`thumb`, `thumbnail`, `miniatura`, `thumbs` → 404); nada a vazar |
| Estáticos (`/data/db.json`, `/photos/...`) | 404; `data/` fora de `public/` |
| Isolamento entre eventos (guestId de outro evento, hostToken de outro) | 403 |
| Concorrência: cota=1, 8 uploads simultâneos | 1×201 e 7×409, 1 foto gravada (check-and-write síncrono) |
| Cliente com relógio errado | o servidor decide a revelação; o cliente usa `agora` do servidor (`relogio()` em `common.js`) |
| Upload após revelação, `text/html`, `image/gif`, 11 MB, 26 MB | 409 / 400 / 413 |
| Textos de usuário | servidor guarda cru; o cliente usa `textContent`. Os 3 `innerHTML` recebem só mensagens fixas do servidor *(estático, não validado em navegador)* |
| Listas colada duplicada | deduplicada por nome normalizado |

## Reprodução
Script de ataque: variáveis `DATA_DIR`, `PORT=3299`, `MASTER_TOKEN` e `node attack.js`. IDs de teste: A1 `C2`/`L1`, A2 `M1`, M1 `U1–U4b`, M2 `E4/E5`, M3 `R20–R22`, M4 `S1–S4`, B1 `E1/E6/E8/I2`.

## Não coberto
- Entrega real de push, navegador/celular, HTTPS, PWA.
- Retenção/expiração por tempo (não há código para testar).
- Carga sustentada e corrupção do `db.json` sob queda (escrita atômica por rename, sem fsync).
