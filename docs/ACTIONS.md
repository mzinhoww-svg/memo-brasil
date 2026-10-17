# ACTIONS — pendências humanas

Itens que **só uma pessoa** pode resolver (conta, pagamento, nome, credencial). Nunca colar segredos aqui; registrar só o nome da variável. Atualizado em 2026-10-17.

> Nota: este arquivo vive em `docs/status`. Esta cópia foi trazida para os PRs #9 (proxy e válvulas do master) e de publicação (item 4, ações humanas do deploy). Ao mergear, manter a versão de `docs/status` e somar estas linhas e a seção **Publicação (item 4)**.

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
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (ou `EMAIL_API_KEY` para `resend`) | E-mail transacional (link mágico e aviso de revelação) | Módulo do #16 já na main. Em `PUBLIC_URL` https o servidor exige provedor **real** (`smtp`/`resend`) para subir; sem ele `/api/auth/link` responde 503 (console só em dev/teste ou com `EMAIL_CONSOLE_PERMITIDO=sim`) |
| `MASTER_TOTP_KEY` (32 bytes aleatórios) | Cifrar segredo TOTP do master | Exigir em produção (B6 do #9) |
| `MASTER_BOOTSTRAP_*` | Criar o primeiro master | Em https é o **único** caminho (token estático não vale). Preferir `scripts/master-criar.js <email> <nome>` com a senha em `MASTER_SENHA` ou no prompt — nunca como argumento |
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
| P4 | Criar **conta de e-mail transacional** (Brevo via SMTP) e verificar o domínio (SPF/DKIM/DMARC); obter `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM` | Provedor de e-mail (faixa gratuita) | Link mágico, aviso de revelação (#16) |
| P5 | Criar **bucket de backup externo** e obter `BACKUP_BUCKET`, `BACKUP_ACCESS_KEY`, `BACKUP_SECRET_KEY` | Armazenamento de objetos | Restauração fora do host |
| P5b | Definir `BACKUP_PASSPHRASE` (senha longa) **ou** `BACKUP_GPG_KEY` (chave pública gpg) no `.env` | Senha gerada localmente / `gpg --gen-key` | Backup cifrado (obrigatório em produção; o deploy aborta sem isso) |
| P6 | Definir `MASTER_TOTP_KEY` (32 bytes aleatórios) e criar a conta master com `scripts/master-criar.js <email> <nome>` (senha em `MASTER_SENHA` ou no prompt — nunca por argumento) | Local → `.env` na VPS + script no container | Admin master (em `https` o `MASTER_TOKEN` estático não vale) |
| P7 | **Aprovar o custo** estimado (≈ R$ 3,70/mês; cenário pior ≈ R$ 54) contra o teto de R$ 100 | Aqui / orçamento | Primeiro deploy |
| P8 | Autorizar o **primeiro deploy em produção** (`bash scripts/deploy.sh --apply`) | Decisão | Item 4 |
| P9 | Após publicar, **testar a restauração** de backup em ambiente de ensaio (incluindo a reapresentação do `excluidos.log`) e guardar a evidência | VPS + bucket | Go-live |
| P10 | Definir a **região da VPS** (mais perto dos convidados) e **ativar a cifra de disco em repouso** | Painel do provedor (LUKS/volume cifrado) | Fotos de pessoas e menores |
| P11 | Fixar `BACKUP_RETENTION_DIAS` (≤ o prazo de retenção da plataforma) e apagar as cópias externas no mesmo prazo | `.env` + bucket | LGPD |

Nenhuma ação humana é necessária para o **certificado TLS**: o Caddy emite e renova via Let's Encrypt automaticamente, desde que P1 e P2 estejam feitos.

## Proxy, IP e limites (PR #9)
- `TRUST_PROXY` — número de saltos de proxy confiáveis, **padrão `0`** (sem proxy na frente). Com `0`, `req.ip` é o endereço do socket e um `X-Forwarded-For` forjado pelo cliente é ignorado; os limites por IP (criação de evento, pedido de link, login master) não podem ser contornados por cabeçalho.
  - **Quem preenche**: quem opera o deploy, ao colocar o app atrás do proxy reverso.
  - **Valor**: `1` atrás de um único proxy que anexa `X-Forwarded-For` (nginx/Caddy na mesma máquina); `2` se houver dois saltos confiáveis; `true` só se o proxy for totalmente confiável e inacessível de fora.
  - **Nunca** deixar o padrão `0` com o app publicado atrás de proxy (todos os acessos passam a contar como um único IP e os limites bloqueiam usuários legítimos); **nunca** usar valor maior que a quantidade real de saltos (o cliente volta a poder forjar o IP).
- `MASTER_EMERGENCY`, `MASTER_TOKEN_COMPAT` — válvulas que reativam o `MASTER_TOKEN` estático mesmo com conta master criada. Padrão: desligadas. **Com `PUBLIC_URL` `https://` o token estático nunca vale — nem a válvula, nem a janela de bootstrap** — e cada uso da válvula (fora de https) é gravado na auditoria (`master.token_emergencia`). Só ligar para recuperar acesso em ambiente de desenvolvimento; desligar em seguida.
  - Consequência em produção: o primeiro master **tem** que vir de `MASTER_BOOTSTRAP_*` (ou de `scripts/master-criar.js` antes de subir). Sem isso não há como entrar em `/master` — é fail-closed de propósito.

## Pendências técnicas (não bloqueiam o deploy)
- **Bloqueio por conta no login master.** `master_accounts.falhas`/`bloqueado_ate` existem mas não são usados; hoje o único freio é 10 tentativas/15 min **por IP**. Precisa de decisão: um bloqueio por conta é vetor de DoS por terceiro (o Planejador levantou no #9). Opções: atraso progressivo por conta (não bloqueia) ou lockout com desbloqueio por e-mail. Enquanto não houver decisão, mantém-se só o limite por IP.
- **Envio do link mágico pelo módulo do #16** (`src/email`): em produção o link sai por `smtp`/`resend`; console só em dev/teste (e o link aí também vai para `DATA_DIR/auth.log`, nunca em produção). Sem provedor real fora de dev/teste, `/api/auth/link` responde **503** — não prometemos "enviamos" quando ninguém receberia nada.
- **Credencial nunca na URL.** O painel e o master mandam o token só no cabeçalho (`x-host-token`/`x-master-token`); a rota do arquivo de foto e o painel **não** aceitam `?token=`. As miniaturas são buscadas com `fetch` e viram `blob:` (helper `imgAutenticada` em `public/common.js`), para o token não cair em log, histórico do navegador ou `Referer`.

## CI
- #1: o job `test` falha em ~2 s sem log; o QA cruzado atribui a cobrança/Actions. Regularizar o faturamento do GitHub Actions (ação humana) ou rodar a suíte localmente como evidência até lá.
- `.gitleaks.toml` libera **apenas** o vetor de teste público da RFC 6238 (`GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ`, apêndice B) usado nos testes de TOTP. Qualquer outro candidato a segredo continua falhando o scan; nada de valor real deve ser acrescentado a esse allowlist.

## Conferir antes de usar
- Valores e prazos das lojas (Apple US$ 99/ano, Google US$ 25) estão em `docs/lojas.md` (#5) e devem ser reconferidos no momento da conta.
