# Plano da Fase 2 — do protótipo ao MVP de produção

- Autor: Planejador · Data: 2026-10-13
- Nota de nome: o prompt do orquestrador chama de "Fase 2" o empacotamento para lojas. Aqui **Fase 2 = execução paralela das frentes Forja-\*** (código do MVP). As lojas ficam em `docs/lojas.md`.
- Base: `001-persistencia` (**aceita**: SQLite no MVP; item 12 Postgres+RLS pós-MVP imediato, gatilho G0 = STATUS final), `002-auth-organizador`, `003-auth-master` e `004-recados-visibilidade` (recomendadas, aguardando aceite).

## 1. O problema do `server.js` (701 linhas)

Hoje `server.js` mistura: configuração e variáveis da plataforma, VAPID, auditoria, banco JSON, token master, helpers, middlewares, ~45 rotas (organização, convidado, fotos, master, push, exportações), job de revelação, manifest e páginas. Com 10+ agentes em paralelo, **toda frente edita o mesmo arquivo** e o conflito é garantido; além disso o estado global (`db`, `settings`) impede testar com banco isolado.

### Proposta: dividir por routers, em um único PR mecânico, ANTES das frentes de código

Regra do PR de divisão (Forja-Split): **zero mudança de comportamento**, só mover código; a suíte da Forja-Testes (§4, passo 0) é a rede de segurança. Estrutura-alvo:

```
server.js                     # só: lê env, createApp(), listen()  (~20 linhas)
src/app.js                    # createApp({ repo, blobs, mailer, clock, settings }) → express app
src/config.js                 # env, DEFAULTS das variáveis da plataforma, constantes
src/lib/{ids,text,url,time}.js    # newId, clean, norm, baseUrl, lanIp, revealed(ev, clock)
src/middleware/
  maintenance.js              # modo manutenção
  event.js                    # getEvent (carrega e valida o tenant)
  org-auth.js                 # adminOnly, donoOnly      ← Forja-Auth
  master-auth.js              # masterOnly               ← Forja-Master
  errors.js                   # handler de erro, multer
src/routes/
  config.js                   # GET /api/config
  events.js                   # POST /api/events, GET /api/events/:id (publicInfo)
  org/evento.js               # host, PATCH evento, qr.png
  org/lista.js                # lista de convidados, CSV            ← Forja-Org
  org/equipe.js               # equipe
  org/moderacao.js            # moderação, apagar foto/recado
  org/exportacoes.js          # lista.csv, fotos.zip                ← Forja-Revela/LGPD
  guests.js                   # buscar, guests, rsvp, recados
  photos.js                   # upload, listagem, arquivo           ← Forja-Dados/Revela
  push.js                     # subscribe, avisos, manifest         ← Forja-Push
  master/{index,events,photos,settings,audit,avisos,politicas}.js   ← Forja-Master
  pages.js                    # rotas de HTML, sw.js, static
src/jobs/{reveal.js,retention.js}   # setInterval da revelação hoje; retenção nova
src/services/{audit,push,zip}.js    # auditoria, enviarPush, ZIP
```

Princípios:
1. **Um dono por arquivo.** Cada frente tem um diretório/arquivos próprios; `app.js` é o único ponto compartilhado e só recebe uma linha por router novo (conflito trivial).
2. **Injeção, não globais.** `createApp({repo, ...})` permite que cada teste crie app + banco em memória; é o que torna a suíte rápida e as frentes independentes. `db` e `settings` globais deixam de existir.
3. **Montagem explícita e ordenada** em `app.js` (manutenção → rotas → erro → páginas), sem importar rotas por efeito colateral.
4. **Nada de `req.ev` mutado direto** nas rotas: depois da 001, acesso via `repo`. Durante a transição, o adaptador JSON mantém o comportamento.

Por que não o contrário (frentes primeiro, divisão depois)? Porque cada PR de frente teria que ser reescrito sobre o arquivo dividido, multiplicando o conflito. O custo da divisão é pequeno e mecânico; o benefício é imediato.

## 2. Frentes (agentes Forja-\*)

Cada frente: worktree e `DATA_DIR` próprios, TDD, PR pequeno (um assunto), volta ao orquestrador pedindo a próxima tarefa. "Toca dados pessoais/auth/armazenamento" = **auditoria do Planejador obrigatória** antes do merge.

| Frente | Entrega (itens do checklist) | Dono de | Auditoria Planej. |
|---|---|---|---|
| **Forja-Testes** | Suíte node:test cobrindo criação, entrada, upload, limite por convidado, bloqueio antes/liberação depois, token, upload pós-revelação, ids inexistentes; CI (GitHub Actions) + gitleaks; relógio injetável (`clock`) (1) | `test/`, `.github/` | só configuração do gitleaks |
| **Forja-Split** | Divisão em routers/`createApp` sem mudar comportamento (§1) | estrutura `src/` | não |
| **Forja-Dados** | Interface `Repo`+`Blobs`, SQLite, migrações, script de migração do JSON, backup (3, 12 parcial) | `src/repo/`, `migrations/`, `scripts/` | **sim** (armazenamento, isolamento) |
| **Forja-Auth** | Contas de organizador, link mágico, sessões/cookie, CSRF, "aparelhos", reivindicação do token (5; decisão 002) | `src/middleware/org-auth.js`, `src/routes/auth.js`, `src/services/mailer.js` | **sim** |
| **Forja-Org** | Painel completo: QR PNG/PDF A5, fotos por convidado, encerrar/estender revelação, remover convidado, mapa por papel (6, 7 parcial) | `src/routes/org/*` | sim nas rotas que tocam fotos |
| **Forja-Master** | Login com senha+TOTP, contas nomeadas, auditoria encadeada só-inserção, "agir como", reautenticação, anti-spam na criação (13; decisão 003) | `src/middleware/master-auth.js`, `src/routes/master/*` | **sim** |
| **Forja-Push** | Service worker, VAPID, entrega real testada em aparelho, limpeza de inscrições mortas (PWA/push) | `src/routes/push.js`, `src/services/push.js`, `public/sw.js` | sim (inscrições = dado pessoal) |
| **Forja-LGPD** | Consentimento ao convidado, denúncia de foto, ocultar/apagar, exportar e apagar evento em um comando, retenção + job, política/termos (integra textos do Redator) (9) | `src/jobs/retention.js`, `src/routes/lgpd.js`, `scripts/` | **sim, obrigatória** |
| **Forja-Revela** | Revelação automática por relógio do servidor, retrospectiva slideshow, link do álbum, e-mail ao organizador, ZIP pós-revelação, **upload seguro: tipo pelo conteúdo, remoção de EXIF/GPS, recompressão, nome gerado pelo servidor** (7, 8) | `src/routes/photos.js`, `src/jobs/reveal.js`, `src/services/image.js` | **sim** (bloqueio das fotos) |
| **Forja-Obs** | Logs sem PII (pino + redação), rate limit por IP/evento, limites, `/healthz`, Sentry free, `trust proxy` (11) | `src/middleware/ratelimit.js`, `src/lib/log.js` | sim (redação de PII) |
| **Forja-Deploy** | VPS: Nginx/Caddy + TLS, systemd, PUBLIC_URL, volume, backup agendado, rollback; **plano e custo mostrados antes do 1º deploy** (4) | `deploy/`, `docs/runbook.md` | sim (segredos, exposição) |
| **Forja-CSS** | Tokens CSS (variables), identidade visual aplicada, Lighthouse ≥90, sem rolagem horizontal (10, 2) | `public/*.css`, markup | não (mas escapar texto de usuário) |
| **Forja-Painel** | Painel 127.0.0.1:3300 (stdlib Python) alimentado por `mvp-checklist.json`+TASKS+gh (14) | `tools/painel/` | não |

Agentes não-código: Designer (telas + QA visual em 390×844/1440×900, relatório em `docs/qa/`), Redator (e-mails, convite, política, termos, consentimento), QA Cruzado (nunca o autor).

## 3. Dependências

```
Testes(base) ──► Split ──► Dados ──┬──► Auth ──► Org
                   │               ├──► Master (precisa Auth p/ sessão/cookie e e-mail)
                   │               ├──► LGPD (precisa Dados p/ cascata/retenção)
                   │               └──► Revela (precisa Blobs + Auth p/ e-mail)
                   ├──► Push, Obs, CSS, Deploy(infra)  (quase independentes)
Painel: independente (só lê arquivos)
```

Detalhes que não podem ser esquecidos:
- **Forja-Testes antes de Split**: sem teste de caracterização, o PR de divisão não é verificável. Mínimo: os 10 testes atuais + os 7 casos do item 1 que faltarem. O restante da suíte cresce com cada PR.
- **Dados depende de Split** (injeção de `repo`). Enquanto Dados não entrega o SQLite, as frentes usam o adaptador JSON atrás do `Repo`; **nenhuma frente escreve em `db.events[...]` diretamente** depois do PR de Dados-interface.
- **Auth × Master compartilham** o módulo de sessão/cookie: Forja-Auth entrega `src/lib/session.js` primeiro (PR pequeno); Master o consome. Evita dois mecanismos de cookie.
- **Revela × LGPD tocam fotos** (`photos.js`, exclusão): combinar interface de "apagar foto" no Repo/Blobs antes, para ambas chamarem a mesma função.
- **Deploy (infra)** pode começar cedo (Nginx, TLS, systemd, runbook), mas o **primeiro deploy em produção** só ocorre após: Dados+migração, Auth, Obs (rate limit/healthz) e a aprovação humana do plano/custo. Preview em staging antes.
- **Ações externas** (registrar em `docs/ACTIONS.md`, bloqueiam frentes): domínio/DNS com SPF/DKIM, credencial de e-mail transacional, Turnstile, Sentry, bucket de backup, conta Google (só se 002-C).

## 4. Ordem de merge (ondas)

| Onda | PRs | Condição para a próxima |
|---|---|---|
| 0 | `docs/planejamento` (este) | aceite das decisões 002–004 (001 já aceita) |
| 1 | Testes+CI+gitleaks (base) → **Split** | CI verde na main; suíte passa idêntica antes/depois |
| 2 | Dados (interface+adaptador JSON → SQLite → migração/backup) **em paralelo com** Obs, Push, CSS, Painel, Deploy-infra | isolamento testado no Repo; sem uso direto de `db` |
| 3 | Auth (sessão → link mágico → contas/convites) → Org; Master (depois da sessão do Auth); LGPD; Revela | auditoria do Planejador em cada um |
| 4 | Testes cruzados + QA visual completo + Lighthouse + hardening | checklist 1–14 verificado com evidência |
| 5 | Deploy produção (**após aprovação humana do plano e custo**) | STATUS.md final |
| 6 | **Item 12**: Postgres + RLS (gatilho G0 da decisão 001, ou antes por G1–G4) | isolamento provado com SQL direto |

Regras de merge: CI verde + QA cruzado + Planejador (quando "sim" na tabela); autor traz a `main` por **merge** (sem force-push); 3 correções por problema, na 4ª simplificar ou cortar; PRs que mudam fotos incluem teste do bloqueio antes da revelação (rota, listagem, ZIP, miniatura, cache).

## 5. Riscos conhecidos no código atual (entram como tarefas)

1. **Token na query string** (`?token=`) em `adminOnly`, `masterOnly`, `photos/:pid/file`: vaza em logs/Referer. → Auth/Master removem; downloads por cookie ou URL assinada curta.
2. **Upload confia no `mimetype` do cliente** e não remove EXIF/GPS; limite técnico de 25 MB em memória (`memoryStorage`) com 2 uploads simultâneos pode pressionar os 2 GB da VPS. → Revela: validar por assinatura de bytes, reprocessar (sharp ou similar), limitar concorrência.
3. **`save()` síncrono reescreve o JSON inteiro** a cada foto/convidado (bloqueia o event loop com eventos grandes). → Dados.
4. **Master e organizador compartilham o mesmo cabeçalho** (`x-host-token`) e `isMaster` vale em rotas de organização. → Master/Auth separam.
5. **`fotosPorConvidado`/limites só no servidor, mas `guestId` é só um id** (sem segredo): quem adivinha/obtém um `guestId` fotografa por ele. Risco baixo (id de 64 bits), mas anotar; considerar segredo de convidado (cookie) em Auth/Revela.
6. **Limite padrão de 20.000 fotos/evento** é incompatível com 50 GB de disco; ajustar a variável e recomprimir (ver 001).
7. **Mensagens de recado e nomes**: confirmar escape na saída em todas as telas (regra do papel); Forja-CSS/Org incluem teste de XSS (`<img onerror>` em nome, título, recado, cronograma).
8. **Fotos de menores**: sem uso secundário; denúncia e remoção rápida (LGPD); registrar no texto de consentimento.

## 6. Critério de pronto da Fase 2
Checklist 1–14 do orquestrador com evidência (teste/captura) por item, `STATUS.md` final com limitações, nenhum segredo no histórico (gitleaks), custo mensal estimado ≤ R$ 100 registrado.
