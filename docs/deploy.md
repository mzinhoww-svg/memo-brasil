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
| `MASTER_TOKEN` | senha do admin master (string longa e aleatória) |
| `VAPID_CONTACT` | contato das notificações push (ex.: `mailto:contato@…`) |
| `TRUST_PROXY` | `1` atrás do Caddy (um proxy). Ver [`ACTIONS.md`](./ACTIONS.md) |
| `BACKUP_PASSPHRASE` (ou `BACKUP_GPG_KEY`) | cifra do backup — **obrigatória em produção** (LGPD) |

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

- **decifra `.gpg`** antes de extrair (usa `BACKUP_PASSPHRASE` ou `BACKUP_GPG_KEY`);
- aceita o banco **SQLite (`memo.db`)** ou o formato antigo (`db.json`);
- **reaplica as exclusões** do backup: não traz a pasta `backups/`, nem `*.wal`/`*.shm`/`*.journal`/`*.tmp`
  (um `-wal` antigo ao lado de um banco novo corrompe o SQLite) e não toca no `master.token` do host;
- preserva os bancos atuais como `*.pre-restore.<timestamp>` antes de sobrescrever.

## Checklist de go-live

Só marcar depois de conferir, com evidência (saída de comando ou captura):

- [ ] DNS `A` propagado (`dig +short SEU_DOMINIO` = IP da VPS).
- [ ] Portas 80/443 abertas (painel do provedor + firewall da VPS).
- [ ] `.env` preenchido e com permissão restrita (`chmod 600 .env`); nada de segredo no git.
- [ ] `bash scripts/deploy.sh` revisado e `--apply` concluído sem erro.
- [ ] `https://SEU_DOMINIO/api/config` responde 200; certificado válido no navegador.
- [ ] `PUBLIC_URL` = `https://SEU_DOMINIO` (QR Code aponta para o domínio certo).
- [ ] Câmera aberta no Safari iOS e no Chrome Android via HTTPS.
- [ ] Bloqueio de foto antes da revelação: `GET .../photos/<id>/file` devolve **403** (coberto por teste e por smoke no container).
- [ ] Backup gerado e copiado para fora do host; **restauração testada** em ambiente de ensaio.
- [ ] `npm test` verde na VPS (`node --test`).
- [ ] Log do Caddy sem token (B2): `docker compose logs caddy` não mostra `?token=`.
- [ ] Containers do Caddy só com `DOMINIO` (B3): `docker compose exec caddy env` não lista segredos.
- [ ] Rotacionar a senha inicial da VPS e confirmar login por chave SSH.
- [ ] Monitoramento/healthcheck externo apontando para `/api/config`.

## Segredos na borda (B2 e B3)

- **B2 — log do Caddy sem token.** O `Caddyfile` usa `format filter` e apaga da URI registrada os
  parâmetros `token`, `key`, `host_token`, `hostToken` e `master`. Sem isso, um acesso com
  `?token=...` gravaria o segredo em texto puro no log de acesso.
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
$ curl -fsS http://127.0.0.1:33210/api/config   -> 200 JSON
$ curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:33210/   -> 200
$ (upload de foto em evento não revelado) GET .../file -> HTTP 403    # bloqueio do servidor intacto
$ docker inspect -f '{{.State.Health.Status}}' lume-test -> healthy

$ docker exec lume-test bash scripts/backup.sh                       # sem chave
  -> "em produção o backup deve ser cifrado…" (deploy abortaria; gate OK)
$ docker exec -e BACKUP_PASSPHRASE=… lume-test bash scripts/backup.sh
  -> /data/backups/memo-<stamp>.tar.gz.gpg (cifrado)
$ BACKUP_PASSPHRASE=… bash scripts/restore.sh --backup …gpg --data-dir /tmp/x   # decifra e mostra o plano

$ DOMINIO=exemplo.test PUBLIC_URL=https://exemplo.test docker compose config   # precisa de .env
$ docker run --rm -e DOMINIO=exemplo.test -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" \
    caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  -> "Valid configuration"   (HTTPS automático + redireciona HTTP->HTTPS; log com filtro)
$ npm test                     -> 65 testes, 0 falhas
```

`hadolint` foi rodado via imagem Docker (o binário local não está instalado). Sem Docker no
ambiente, a validação ficaria registrada como **não verificada**. `docker compose config` exige
que `.env` exista (o serviço usa `env_file`), por isso ela é criada a partir de `.env.example`
na validação e na VPS.

## O que só uma pessoa pode fazer

Ver [`ACTIONS.md`](./ACTIONS.md) → seção **Publicação (item 4)**: DNS/domínio, chave SSH,
abertura de portas no provedor, contas de e-mail/backup, aprovação de custo e o primeiro deploy.
