# ACTIONS — pendências humanas

Itens que **só uma pessoa** pode resolver (conta, pagamento, nome, credencial). Nunca colar segredos aqui; registrar só o nome da variável. Atualizado em 2026-10-16.

> Nota: este arquivo vive em `docs/status`. Esta cópia foi trazida para o PR de publicação (item 4) para registrar as ações humanas do deploy. Ao mergear, manter a versão de `docs/status` e somar a seção **Publicação (item 4)**.

## Decisões
| # | Ação | Por quê | Bloqueia |
|---|---|---|---|
| D1 | Aceitar (ou ajustar) as decisões 002, 003 e 004 | Hoje só a 001 foi aceita; as outras três estão recomendadas | Itens 5, 9, 13 |
| D2 | Nome **Lume** já decidido por Aurimar: falta busca INPI (classes 9/42/38), domínio e handles | Strings de produto já usam "Lume" (#4) | Publicação, lojas, textos |
| D3 | Conta de desenvolvedor Apple/Google: pessoal ou organização (CNPJ) | Define nome de vendedor e DUNS | Lojas (pós-MVP) |
| D4 | Plano/custo da publicação aprovado (VPS, domínio, e-mail, backup) | Primeiro deploy só após aprovação | Item 4 |

## Credenciais e contas (não presentes)
| Variável / recurso | Uso | Observação |
|---|---|---|
| `EMAIL_PROVIDER`, `EMAIL_API_KEY` | E-mail transacional (link mágico, revelação) | Sem isto o link cai em log (B5 do #9); produção deve recusar subir |
| `MASTER_TOTP_KEY` (32 bytes aleatórios) | Cifrar segredo TOTP do master | Exigir em produção (B6 do #9) |
| `MASTER_BOOTSTRAP_*` | Criar o primeiro master | Preferir `scripts/master-criar.js` interativo, não argv |
| Google OAuth (client id/secret) | Só se a decisão 002 for a opção C | Opcional |
| Turnstile (site/secret) | Anti-spam na criação aberta (item 13) | Pendente |
| Sentry DSN | Alerta de erro (item 11) | Plano gratuito |
| Bucket de backup externo | Backup cifrado fora do host (A2 do #7) | Pendente |
| `PUBLIC_URL` (https) | QR Code, cookies `Secure` | Depois do domínio |

## Infraestrutura
- VPS `reinerscloud`: 1 vCPU, 2 GB, 50 GB, SAO2, IP existente, **compartilhada com outro serviço**. Senha inicial devolvida pela API do provedor: nunca imprimir nem commitar; trocar por chave SSH.
- Confirmar que o teto de fotos por evento cabe nos 50 GB (limite atual 20.000 fotos × 10 MB).

## Publicação (item 4) — só uma pessoa faz

Preparação de deploy pronta (`Dockerfile`, `docker-compose.yml`, `Caddyfile`, `deploy/systemd/lume.service`, `scripts/deploy.sh`, `scripts/restore.sh`, `docs/deploy.md`). **Nada foi publicado**; o primeiro deploy em produção depende dos itens abaixo.

| # | Ação (humana) | Como / onde | Bloqueia |
|---|---|---|---|
| P1 | Escolher o **domínio** definitivo e criar o registro DNS **A** (e AAAA, se houver) apontando para o IP da VPS | Painel do provedor de DNS / Registro.br | HTTPS, QR Code, `PUBLIC_URL` |
| P2 | **Liberar as portas 80 e 443** no firewall do provedor (nuvem) além do firewall da VPS | Painel do provedor LetsCloud (não é por SSH) | Let's Encrypt (HTTPS) |
| P3 | Gerar **par de chaves SSH**, instalar a pública na VPS e confirmar login sem senha; **rotacionar a senha inicial** | `ssh-keygen` local + painel da VPS | Acesso seguro, deploy |
| P4 | Criar **conta de e-mail transacional** e verificar o domínio (SPF/DKIM/DMARC); obter `EMAIL_PROVIDER` e `EMAIL_API_KEY` | Provedor de e-mail (faixa gratuita) | Link mágico, aviso de revelação (#9) |
| P5 | Criar **bucket de backup externo** e obter `BACKUP_BUCKET`, `BACKUP_ACCESS_KEY`, `BACKUP_SECRET_KEY` | Armazenamento de objetos | Restauração fora do host |
| P5b | Definir `BACKUP_PASSPHRASE` (senha longa) **ou** `BACKUP_GPG_KEY` (chave pública gpg) no `.env` | Senha gerada localmente / `gpg --gen-key` | Backup cifrado (obrigatório em produção; o deploy aborta sem isso) |
| P6 | Gerar `MASTER_TOKEN` forte e colar no `.env` do servidor (sem imprimir/commitar) | Local → `.env` na VPS | Admin master |
| P7 | **Aprovar o custo** estimado (≈ R$ 3,70/mês; cenário pior ≈ R$ 54) contra o teto de R$ 100 | Aqui / orçamento | Primeiro deploy |
| P8 | Autorizar o **primeiro deploy em produção** (`bash scripts/deploy.sh --apply`) | Decisão | Item 4 |
| P9 | Após publicar, **testar a restauração** de backup em ambiente de ensaio e guardar a evidência | VPS + bucket | Go-live |

Nenhuma ação humana é necessária para o **certificado TLS**: o Caddy emite e renova via Let's Encrypt automaticamente, desde que P1 e P2 estejam feitos.

## CI
- #1: o job `test` falha em ~2 s sem log; o QA cruzado atribui a cobrança/Actions. Regularizar o faturamento do GitHub Actions (ação humana) ou rodar a suíte localmente como evidência até lá.

## Conferir antes de usar
- Valores e prazos das lojas (Apple US$ 99/ano, Google US$ 25) estão em `docs/lojas.md` (#5) e devem ser reconferidos no momento da conta.
