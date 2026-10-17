# Publicação do Lume (Memo Brasil) — item 4

Guia da **preparação** de publicação: imagem Docker, HTTPS automático (Caddy), alternativa
systemd, backup/restauração, checklist de go-live, rollback e custo.

> **Nada aqui foi executado em produção.** Este documento prepara o deploy; o primeiro deploy
> em produção depende de ações humanas listadas em [`ACTIONS.md`](./ACTIONS.md) (domínio/DNS,
> chave SSH, aprovação de custo). O deploy não foi feito e nenhum servidor foi acessado.

## Arquitetura

```
                 Internet (HTTPS)
                        │  80/443
                        ▼
             ┌─────────────────────┐
             │  Caddy (container)  │  certificado Let's Encrypt automático
             │  {$DOMINIO}         │  cabeçalhos de segurança, gzip, log com filtro
             └─────────┬───────────┘  (só recebe DOMINIO — B3)
                       │ rede interna do compose (porta 3210, não publicada)
                       ▼
             ┌─────────────────────┐
             │  lume (Node 24)     │  usuário 10001:10001 (não-root)
             │  server.js + src/   │  scripts/ (backup roda aqui dentro)
             │  scripts/backup.sh  │
             └─────────┬───────────┘
                       │
              volume /data  ──▶  memo.db (SQLite), photos/, tokens, chaves VAPID, backups/
```

- O app **não** publica porta no host: só o Caddy fala com ele. HTTPS fica no Caddy.
- Os dados vivem no volume `lume-data` (`/data`); a imagem é descartável e pode ser reconstruída.
- O site é servido pela mesma porta 3210 (`/api/config` é o healthcheck).
- O app usa SQLite (`memo.db`) por padrão (`src/store`); o `db.json` antigo é importado na 1ª vez.

## Pré-requisitos

- VPS Linux (x86-64) com Docker Engine + plugin `docker compose` (v2).
- Domínio com registro DNS **A** apontando para o IP da VPS (e **AAAA** se houver IPv6).
- Portas **80** e **443** liberadas no firewall da VPS e no painel do provedor (Let's Encrypt usa a 80).
- Chave SSH própria para a VPS (nunca senha). A senha inicial deve ser trocada.
- Repositório clonado na VPS (ex.: `/opt/lume`).

## Passo a passo

### 1. Preparar o servidor (uma vez)

```bash
# na VPS, como usuário com sudo
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
# Docker Engine + compose plugin (script oficial) — conferir a versão atual na doc oficial
curl -fsSL get.docker.com | sudo sh
sudo usermod -aG docker "$USER"     # relogar para valer

sudo mkdir -p /opt/lume && sudo chown "$USER" /opt/lume
git clone https://github.com/mzinhoww-svg/memo-brasil.git /opt/lume
cd /opt/lume
```

### 2. Configurar variáveis

```bash
cp .env.example .env
$EDITOR .env      # preencher no servidor; NUNCA commitar o .env
```

Obrigatórias para publicar (o `deploy.sh --apply` recusa sem elas):

| Variável | O que é |
|---|---|
| `DOMINIO` | domínio público, sem barra no fim (ex.: `lume.exemplo.com.br`) |
| `PUBLIC_URL` | URL completa com `https`, usada no QR Code e no healthcheck |
| `MASTER_TOKEN` | **legado/dev**: em `https` o token estático não vale; crie a conta master (passo 6) |
| `MASTER_TOTP_KEY` | 32 bytes aleatórios: cifra o segredo TOTP do master — **exigido em produção** |
| `VAPID_CONTACT` | contato das notificações push (ex.: `mailto:contato@…`) |
| `TRUST_PROXY` | `1` atrás do Caddy (um proxy). Ver abaixo |
| `BACKUP_PASSPHRASE` (ou `BACKUP_GPG_KEY`) | cifra do backup — **obrigatória em produção** (LGPD) |

**Fail-closed na subida (produção).** Com `NODE_ENV=production` **ou** `PUBLIC_URL` `https`, o
servidor **não sobe** sem: `PUBLIC_URL` começando com `https://`, `MASTER_TOTP_KEY` e um provedor de
e-mail **real** (`smtp`/`resend` com credenciais) — exceto ensaio com `EMAIL_CONSOLE_PERMITIDO=sim`.
Confira `docker compose logs lume` depois de subir.

### 2b. E-mail transacional (Brevo via SMTP)

O MVP envia e-mail em dois momentos: **link mágico de acesso** (item 5/#9) e **aviso de
revelação** para a organização (item 8). Os dois usam o mesmo módulo (`src/email`), com
`EMAIL_PROVIDER=smtp` — hoje via Brevo, em `smtp-relay.brevo.com:587` com STARTTLS.

| Variável | O que é |
|---|---|
| `EMAIL_PROVIDER` | `smtp` em produção. `console` só em dev/teste (em produção é recusado). |
| `SMTP_HOST` | padrão `smtp-relay.brevo.com`. |
| `SMTP_PORT` | padrão `587` (STARTTLS). A `465` usa TLS direto. |
| `SMTP_USER` | usuário SMTP do Brevo. |
| `SMTP_PASS` | **segredo**: a chave SMTP do Brevo. Nunca no git. |
| `EMAIL_FROM` | remetente (precisa ser domínio/e-mail verificado no Brevo). `MAIL_FROM` também é aceito. |
| `EMAIL_VERIFICADOS` | endereços liberados manualmente (separados por vírgula) para receber o aviso de revelação, enquanto a confirmação por link mágico não entra. |
| `EMAIL_TIMEOUT_MS` / `SMTP_TIMEOUT_MS` | limites de tempo (padrão 10s) do job e do SMTP. |
| `EMAIL_CONSOLE_PERMITIDO` | `sim` autoriza o provedor de console em produção (só para ensaio). |

Regras que valem no deploy:

- **Fail-closed.** Sem `SMTP_USER`/`SMTP_PASS` (ou com `EMAIL_PROVIDER=console`) em produção, o
  servidor **não** inicia o envio: registra `[email] envio de e-mail desativado: …` e segue
  rodando sem e-mail. Melhor não enviar do que fingir que enviou.
- **Só endereço verificado.** O aviso de revelação vai apenas para o contato confirmado da
  organização (`contatoVerificado`) ou para um endereço em `EMAIL_VERIFICADOS`. Contato não
  verificado não recebe nada (fica registrado no evento o motivo).
- **PII.** O log nunca mostra o endereço completo (sai mascarado, ex.: `ra**@e**.com`) nem link
  com token de acesso.
- **Teste de verdade.** Antes de considerar pronto, peça um link mágico e confirme que o e-mail
  chega (pasta de spam inclusive) com `EMAIL_PROVIDER=smtp` e `SMTP_PASS` real **apenas no `.env`
  do servidor**.

**`TRUST_PROXY` (obrigatório atrás do Caddy).** O `docker-compose.yml` já fixa
`TRUST_PROXY: "1"` no serviço `lume`. Sem isso, `req.ip` é o IP do Caddy: o rate limit do login
(#9) bloquearia todos os clientes juntos e o hash de IP do log (#12) ficaria constante.
O `deploy.sh` recusa quando `PUBLIC_URL` é `https` e o `TRUST_PROXY` efetivo (do `.env` ou do
compose) é vazio ou `0`.

### 3. Conferir o plano (dry-run — padrão, não muda nada)

```bash
bash scripts/deploy.sh
```

### 4. Publicar

```bash
bash scripts/deploy.sh --apply
```

O script é **idempotente** e faz, em ordem: registrar a imagem anterior (para rollback),
**rodar `scripts/backup.sh` dentro do container antes de subir** (se o backup falhar, o deploy
aborta), construir, subir com `compose up -d`, reetiquetar `latest`, esperar o healthcheck e
limpar imagens antigas. Rodar de novo não duplica nada.

O `deploy.sh` **não faz `source` do `.env`**: lê apenas as chaves que usa (`DOMINIO`,
`PUBLIC_URL`) por grep, então valores sensíveis não são exportados nem impressos.

> Primeira publicação: não há container em execução, então não há o que copiar; o passo de
> backup é pulado com aviso. Use `--skip-backup` só conscientemente.

### 5. Verificar

```bash
curl -fsS "https://SEU_DOMINIO/api/config"      # deve responder JSON com criacaoAberta
docker compose ps                               # lume healthy, caddy running
docker compose logs --tail=50 caddy             # certificado emitido sem erro
```

Abrir no navegador do celular (390x844): o convite `https://SEU_DOMINIO/e/<id>` deve pedir
câmera (getUserMedia exige HTTPS — é para isso que o Caddy existe).

### 6. Criar o primeiro master (obrigatório em `https`)

Em `https` o token estático e a janela de bootstrap do `MASTER_TOKEN` **não valem**: a única forma
de entrar em `/master` é criar a conta com `scripts/master-criar.js` (já copiado para a imagem).
A senha vem de `MASTER_SENHA` (ambiente) ou do prompt sem eco — **nunca** por argumento.

```bash
# com o serviço no ar (usa o mesmo DATA_DIR/volume /data)
docker compose exec -e MASTER_SENHA='senha-longa-e-unica' lume \
  node scripts/master-criar.js dono@exemplo.com.br 'Nome do responsável'

# sem -e, ele pede a senha no prompt (sem eco):
docker compose exec lume node scripts/master-criar.js dono@exemplo.com.br 'Nome do responsável'
```

O script imprime **uma única vez** o `totpSecret`, a URI `otpauth://…` e os códigos de recuperação:
guarde no gerenciador de senhas (nunca no git). Depois entre em `https://SEU_DOMINIO/master` com
e-mail + senha + o código do app autenticador (TOTP).

Notas:

- `MASTER_TOTP_KEY` precisa estar definido (passo 2) para a conta master funcionar.
- Antes do primeiro `up` dá para criar sem o serviço no ar:
  `docker compose run --rm -e MASTER_SENHA='…' lume node scripts/master-criar.js …`
- `MASTER_BOOTSTRAP_*` faz o mesmo no boot; prefira o `master-criar.js` (senha fora do `.env`).

## Alternativa: systemd (sem Docker)

Para quem preferir rodar Node direto no host, existe `deploy/systemd/lume.service`.
Use **uma** abordagem (Docker **ou** systemd), não as duas. Passos no topo do próprio arquivo;
resumo:

```bash
sudo install -d -o lume -g lume /opt/lume /var/lib/lume
sudo rsync -a --delete --exclude data --exclude node_modules ./ /opt/lume/
(cd /opt/lume && npm ci --omit=dev)
sudo install -m 640 -o root -g lume .env.example /etc/lume/lume.env   # depois editar
sudo install -m 644 deploy/systemd/lume.service /etc/systemd/system/lume.service
sudo systemctl daemon-reload && sudo systemctl enable --now lume
journalctl -u lume -f
```

A unidade roda como usuário `lume` (não-root), com `NoNewPrivileges`, `ProtectSystem=strict` e
só `/var/lib/lume` gravável. Neste modelo, o HTTPS fica a cargo do Caddy **ou** de um proxy já existente.

## Backup e restauração

O backup é um `tar.gz` do conteúdo do `DATA_DIR`, produzido por `scripts/backup.sh`:
contém `memo.db` (SQLite, via `.backup`), `photos/`, `audit.log`, `settings.json` e `vapid.json`.
Em produção o backup **exige cifra**: defina `BACKUP_PASSPHRASE` ou `BACKUP_GPG_KEY`, ou o script
recusa gerar cópia em claro (LGPD). O arquivo sai em `DATA_DIR/backups/memo-<stamp>.tar.gz.gpg`.

O `deploy.sh --apply` já roda esse backup **dentro do container** antes de subir (a imagem traz
`bash`, `sqlite3` e `gnupg`). Se o backup falhar, o deploy não continua.

```bash
# manualmente (dentro do container em execução)
docker compose exec lume bash scripts/backup.sh
# cópia externa (fora do host) — exemplo com o volume do compose
docker run --rm -v mb-deploy_lume-data:/data -v "$PWD/offsite:/destino" alpine \
  sh -c 'cp -a /data/backups/. /destino/'
# e então envie ./offsite para o bucket externo (rclone/scp/console do provedor)
```

Restaurar (dry-run por padrão; só altera com `--apply`):

```bash
docker compose stop lume                                   # pare antes de escrever
bash scripts/restore.sh --backup data/backups/memo-2026-10-17.tar.gz.gpg --data-dir data
bash scripts/restore.sh --backup data/backups/memo-2026-10-17.tar.gz.gpg --data-dir data --apply --yes
docker compose up -d
```

O `restore.sh`:

- **decifra `.gpg`** antes de extrair (usa `BACKUP_PASSPHRASE` via `--passphrase-fd`, ou `BACKUP_GPG_KEY`);
- aceita o banco **SQLite (`memo.db`)** ou o formato antigo (`db.json`);
- **reaplica as exclusões** do backup: não traz a pasta `backups/`, nem `*.wal`/`*.shm`/`*.journal`/`*.tmp`
  (um `-wal` antigo ao lado de um banco novo corrompe o SQLite) e não toca no `master.token` do host;
- **reaplica o `excluidos.log` (LGPD)**: lê o túmulo atual (no host/volume, fora do backup) **e** o do
  backup, faz a união, apaga cada evento (`DELETE FROM events WHERE id = ?`) e as fotos
  (`photos/<id>`), antes de reiniciar. Em dry-run só lista os ids. Sem isso, restaurar um backup
  antigo ressuscitaria eventos que foram apagados.
- preserva os bancos atuais como `*.pre-restore.<timestamp>` antes de sobrescrever.

## Endurecimento dos containers

O `docker-compose.yml` roda os dois serviços com:

- `read_only: true` (sistema de arquivos somente-leitura) e `tmpfs: /tmp` para o que precisa escrever;
- `cap_drop: [ALL]`; o Caddy recebe de volta só `cap_add: [NET_BIND_SERVICE]` para abrir 80/443;
- `security_opt: [no-new-privileges:true]`;
- `pids_limit` e `mem_limit` (lume 256 pids / 512 MB; caddy 128 pids / 256 MB).

Na imagem, o código fica em `/app` como `root:root` e **só `/data` é gravável** pelo usuário `10001`
(antes `/app` era do usuário da app). O healthcheck usa `/healthz` (#12).

## Região, cifra de disco e retenção

- **Região da VPS**: escolher a região mais próxima dos convidados (o Brasil, SAO2, reduz a latência
  da câmera e do upload). É uma decisão humana — ver [`ACTIONS.md`](./ACTIONS.md).
- **Cifra de disco**: as fotos são de pessoas (incluindo menores) e ficam em `/data`. Ativar a
  **cifra de disco em repouso** da VPS (LUKS no volume ou o recurso do provedor) é fortemente
  recomendado; o backup já sai cifrado (`BACKUP_PASSPHRASE`/`BACKUP_GPG_KEY`).
- **Retenção do backup**: o `backup.sh` (#15) usa `BACKUP_RETENTION_DIAS` (padrão 30) — manter **≤**
  o prazo de retenção da plataforma (`retencaoDiasAposRevelacao`, padrão 365 dias) e apagar cópias
  externas no mesmo prazo. O `excluidos.log` é a garantia de que uma restauração não desfaz uma
  exclusão pedida pelo titular.

## Checklist de go-live

Só marcar depois de conferir, com evidência (saída de comando ou captura):

- [ ] DNS `A` propagado (`dig +short SEU_DOMINIO` = IP da VPS).
- [ ] Portas 80/443 abertas (painel do provedor + firewall da VPS).
- [ ] `.env` preenchido e com permissão restrita (`chmod 600 .env`); nada de segredo no git.
- [ ] `bash scripts/deploy.sh` revisado e `--apply` concluído sem erro.
- [ ] `https://SEU_DOMINIO/api/config` responde 200; `/healthz` responde 200; certificado válido no navegador.
- [ ] `PUBLIC_URL` = `https://SEU_DOMINIO` (QR Code aponta para o domínio certo).
- [ ] `TRUST_PROXY` efetivo = `1` (o `docker compose config` mostra no environment do `lume`).
- [ ] Câmera aberta no Safari iOS e no Chrome Android via HTTPS.
- [ ] Bloqueio de foto antes da revelação: `GET .../photos/<id>/file` devolve **403** (coberto por teste e por smoke no container).
- [ ] Backup gerado e copiado para fora do host; **restauração testada** em ambiente de ensaio,
      inclusive a **reapresentação das exclusões** (restaurar um backup antigo e conferir que o
      evento apagado não volta — `excluidos.log`).
- [ ] `npm test` verde na VPS (`node --test`).
- [ ] Log do Caddy sem token nem IP (B2): `docker compose logs caddy` / `access.log` não mostra
      `X-*-Token`, `Authorization`, `Cookie`, `X-Forwarded-For`, `?t=`/`?q=` nem IP completo (só a rede /24).
- [ ] Containers do Caddy só com `DOMINIO` (B3): `docker compose exec caddy env` não lista segredos.
- [ ] Master: conta criada com `scripts/master-criar.js` (senha por `MASTER_SENHA`, nunca argumento),
      TOTP e códigos de recuperação guardados; login em `/master` funcionando.
- [ ] E-mail (Brevo): `EMAIL_PROVIDER=smtp` com `SMTP_USER`/`SMTP_PASS` e `EMAIL_FROM` verificado; link
      mágico e aviso de revelação entregues de verdade (conferir spam).
- [ ] E-mail nunca loga endereço completo nem token: `docker compose logs lume` não mostra e-mail completo.
- [ ] Região da VPS definida e **cifra de disco em repouso** ativada (fotos de pessoas e menores).
- [ ] Rotacionar a senha inicial da VPS e confirmar login por chave SSH.
- [ ] Monitoramento/healthcheck externo apontando para `/healthz`.

## Segredos na borda (B2 e B3)

- **B2 — log do Caddy sem segredo e sem IP completo.** O `Caddyfile` usa `format filter` e:
  - apaga da URI os parâmetros `token`, `key`, `host_token`, `hostToken`, `master`, **`t`** (link
    mágico do #9), **`q`** (busca de convidado, PII) e **`guestId`**;
  - **apaga os cabeçalhos de token** `X-Host-Token`, `X-Master-Token`, `X-Guest-Token`, além de
    `Authorization`, `Cookie`, `X-Forwarded-For` e `X-Real-Ip` (os tokens trafegam em cabeçalho,
    não só na query);
  - **mascara o IP** com `ip_mask` (`ipv4 24` / `ipv6 48`) em `request>remote_ip` e
    `request>client_ip` — guarda a rede, não o endereço do convidado.

  Verificado com o `Caddyfile` real rodando: requisição para `/api/auth/entrar?t=…&q=…&guestId=…`
  com todos esses cabeçalhos grava no log só `User-Agent`, `Accept` e `?manter=ok`, com
  `remote_ip`/`client_ip` reduzidos a `192.168.65.0`. Revisar a lista a cada rota nova que aceite
  segredo ou PII na query.
- **B3 — o Caddy só recebe `DOMINIO`.** Antes o serviço do Caddy usava `env_file: .env` e recebia
  *todas* as variáveis (incluindo `MASTER_TOKEN`, chaves de e-mail e de backup) num container
  exposto na 80/443. Agora o compose injeta apenas `DOMINIO: ${DOMINIO:?…}`. Só o serviço `lume`
  usa `env_file`.

## Rollback

O deploy registra a imagem anterior em `.deploy/previous-tag` — **sem sobrescrever** quando a
versão em execução é a mesma que está sendo publicada (um redeploy da versão atual, ou de uma
versão quebrada, preserva o último rollback bom).

```bash
bash scripts/deploy.sh --rollback          # volta para a imagem anterior e sobe
# ou manual:
IMAGE_TAG=<sha-anterior> docker compose up -d
```

Rollback de dados: restaurar o último backup com `scripts/restore.sh --apply` (para o serviço
antes). Rollback não reescreve histórico git nem apaga o volume.

## Custo mensal estimado (R$) vs teto de R$ 100

Estimativas para **2026**, com câmbio assumido de **US$ 1 ≈ R$ 5,50**. Valores de terceiros
**devem ser reconferidos** na contratação; nada aqui foi pago.

| Item | Estimativa/mês | Observação |
|---|---|---|
| VPS existente (LetsCloud, compartilhada) | **R$ 0,00** marginal | Já contratada; o Lume divide a máquina com outro serviço. Uma VPS dedicada ~R$ 45–60. |
| Certificado TLS | **R$ 0,00** | Let's Encrypt via Caddy, automático e gratuito. |
| Domínio `.com.br` | **R$ 3,33** | ~R$ 40/ano ÷ 12 (registro no Registro.br; sem renovação antecipada). |
| E-mail transacional | **R$ 0,00** | Faixa gratuita (≈3.000 e-mails/mês) cobre link mágico e avisos. Passar disso estoura o item → manter no gratuito. |
| Backup externo | **R$ 0,35** | ~10 GB em armazenamento de objetos ~US$ 0,006/GB/mês. Faixa gratuita de 25 GB também serve. |
| **Total estimado** | **≈ R$ 3,70** | **~4% do teto de R$ 100/mês** (folga ≈ R$ 96). |
| Cenário com VPS dedicada nova | ≈ R$ 54 | VPS ~R$ 50 + domínio + backup; ainda abaixo do teto. |

Gatilhos que apertam o teto (revisar antes de ocorrer): e-mail acima da faixa gratuita,
backup acima de ~50 GB, VPS dedicada, ou ferramenta paga de erro/observabilidade no lugar do
plano gratuito. Enquanto o volume ficar na casa dos GB, o custo fica na casa de **R$ 4/mês**.

## Validação local (evidência)

Executado neste worktree, com Docker instalado:

```
$ docker run --rm -i -v "$PWD/.hadolint.yaml:/.hadolint.yaml:ro" hadolint/hadolint < Dockerfile
(sem avisos — exit 0; DL3018 ignorado com justificativa no .hadolint.yaml)

$ docker build -t memo-brasil:test .
=> exporting … DONE   (node:24-alpine + bash/sqlite/gnupg, ~85 MB)

$ docker run -d -p 33210:3210 memo-brasil:test
$ docker exec lume-test id              -> uid=10001(lume) gid=10001(lume)   # não-root
$ docker exec lume-test sh -c 'ls src/store scripts'   # B1: src/ e scripts/ na imagem
$ docker exec lume-test ls /data        -> memo.db, memo.db-wal, photos/ …    # SQLite no volume
$ curl -fsS http://127.0.0.1:33210/healthz      -> 200
$ curl -fsS http://127.0.0.1:33210/api/config   -> 200 JSON
$ curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:33210/   -> 200
$ (upload de foto em evento não revelado) GET .../file -> HTTP 403    # bloqueio do servidor intacto
$ docker inspect -f '{{.State.Health.Status}}' lume-test -> healthy

$ # container endurecido (--read-only --tmpfs /tmp --cap-drop ALL --no-new-privileges)
$ docker exec <c> stat -c '%U:%G' /app  -> root:root     # código não gravável pela app
$ docker exec <c> stat -c '%U:%G' /data -> lume:lume     # só /data é gravável
$ docker exec <c> sh -c 'touch /app/x'  -> falha (read-only)
$ # caddy endurecido (--read-only --cap-drop ALL --cap-add NET_BIND_SERVICE) sobe sem erro e abre :80

$ docker exec lume-test bash scripts/backup.sh                       # sem chave
  -> "em produção o backup deve ser cifrado…" (deploy abortaria; gate OK)
$ docker exec -e BACKUP_PASSPHRASE=… lume-test bash scripts/backup.sh
  -> /data/backups/memo-<stamp>.tar.gz.gpg (cifrado)
$ BACKUP_PASSPHRASE=… bash scripts/restore.sh --backup …gpg --data-dir /tmp/x   # decifra e mostra o plano
$ # restore com excluidos.log: evento apagado por LGPD NÃO volta (teste + smoke)

$ DOMINIO=exemplo.test PUBLIC_URL=https://exemplo.test docker compose config   # precisa de .env
$ docker run --rm -e DOMINIO=exemplo.test -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" \
    caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  -> "Valid configuration"   (HTTPS automático + redireciona HTTP->HTTPS; log com filtro)

$ # smoke do log com o Caddyfile REAL (DOMINIO apontando para um http local):
$ curl -H 'X-Host-Token: …' -H 'X-Master-Token: …' -H 'X-Guest-Token: …' \
       -H 'Authorization: …' -H 'Cookie: …' -H 'X-Forwarded-For: 203.0.113.9' -H 'X-Real-Ip: 203.0.113.9' \
       '…/api/auth/entrar?t=…&q=Nome+da+Convidada&guestId=…&manter=ok'
$ cat /data/access.log
  -> headers só User-Agent/Accept; uri "/api/auth/entrar?manter=ok";
     remote_ip/client_ip 192.168.65.0 (/24); nada de token/PII/Authorization/Cookie
$ npm test                     -> 158 testes, 0 falhas
```

`hadolint` foi rodado via imagem Docker (o binário local não está instalado). Sem Docker no
ambiente, a validação ficaria registrada como **não verificada**. `docker compose config` exige
que `.env` exista (o serviço usa `env_file`), por isso ela é criada a partir de `.env.example`
na validação e na VPS.

## O que só uma pessoa pode fazer

Ver [`ACTIONS.md`](./ACTIONS.md) → seção **Publicação (item 4)**: DNS/domínio, chave SSH,
abertura de portas no provedor, contas de e-mail/backup, aprovação de custo e o primeiro deploy.
