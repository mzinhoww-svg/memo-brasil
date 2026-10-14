# 003 — Autenticação do admin master e proteção da criação aberta

- Status: **recomendada**
- Autor: Planejador · Data: 2026-10-13
- Cobre o item 13 do checklist.

## Contexto

O master tem poder total: vê **fotos de todos os casamentos antes da revelação**, suspende, exclui, altera variáveis globais. Hoje a credencial é um token estático (`MASTER_TOKEN` ou `data/master.token`), enviado em `x-master-token`/`x-host-token`/`?token=` e guardado em `localStorage` do navegador; qualquer vazamento dá acesso total, sem rotação, sem 2º fator, e `isMaster()` também é aceito nas rotas do organizador (inclusive `photos/:pid/file`). A auditoria registra `quem = master:Admin master`, ou seja, não distingue pessoas.

Também: `POST /api/events` é aberto (`criacaoAberta`) e sem proteção contra spam/abuso.

## Parte 1 — Credencial do master

### A. Senha forte + TOTP (RFC 6238)
- Prós: autocontido, sem custo, funciona offline, padrão de mercado; códigos de recuperação impressos. Contras: precisamos implementar bem (limites de tentativa, anti-replay do TOTP, armazenamento do segredo).

### B. Passkey/WebAuthn
- Prós: resistente a phishing, sem senha. Contras: mais complexo de implementar e testar (Safari/iOS), recuperação de dispositivo, lib extra. Bom como evolução.

### C. SSO (Google Workspace) com 2FA do provedor
- Prós: delega MFA. Contras: dependência de terceiro no acesso mais crítico; não há Workspace garantido para a plataforma.

### D. Manter token estático atrás de allowlist de IP/VPN
- Contras: não atende o item 13 (pede senha forte e 2º fator); IP muda; sem identidade individual. Descartada como solução, útil só como camada extra no Nginx.

## Decisão recomendada (parte 1)

**Opção A agora; B (passkey) como 2º método posterior.**

- **Contas master nomeadas** (`masters(id, email, nome, senha_hash, totp_segredo_cifrado, ativo)`), para a auditoria dizer *quem*. Pelo menos 2 contas (evita lock-out); criação por CLI no servidor (`node scripts/master-criar.js`), nunca por rota aberta.
- **Senha:** mínimo 12 caracteres, verificada contra lista de senhas comuns, hash **argon2id** (ou scrypt com parâmetros documentados, se argon2 nativo for problema no CI); sem regra de composição arbitrária.
- **TOTP obrigatório:** SHA-1/6 dígitos/30 s (compatível com apps), janela ±1, **rejeita reuso do mesmo passo** (guarda último passo usado), segredo cifrado em repouso com chave de ambiente (`MASTER_TOTP_KEY`). **10 códigos de recuperação** de uso único, mostrados uma vez, guardados com hash.
- **Sessão do master:** cookie `__Host-memo_m` HttpOnly/Secure/SameSite=Strict, **TTL curto** (ex.: 8 h absoluto, 30 min ocioso), id guardado com hash; reautenticação (senha+TOTP) para ações destrutivas (excluir evento, alterar variáveis, ver foto pré-revelação em massa).
- **Anti-força-bruta:** bloqueio progressivo por conta e por IP (5 falhas → espera crescente), mensagem genérica, alerta registrado em auditoria.
- **Remoção do token estático:** `MASTER_TOKEN` e `data/master.token` deixam de ser aceitos; `isMaster(token)` some das rotas do organizador (master entra no painel de um evento por **"agir como"** explícito, auditado, não por token universal). Período de transição: uma versão com o token só em `/master/emergencia` desligável por variável, removida na seguinte.
- **Header/canal:** master nunca por query string. Rota `/master` com `Cache-Control: no-store` e `X-Robots-Tag: noindex`; opcionalmente restringir por Nginx (allowlist) como defesa adicional, **não** como substituto.

### Auditoria (item 13)
- Tabela `auditoria` **somente inserção** (no SQLite: sem `UPDATE/DELETE` pela aplicação, trigger que aborta; no Postgres: papel sem permissão). Campos: `quando, ator_tipo (master|casal|cerimonial|sistema), ator_id, evento_id, acao, alvo, detalhe (JSON sem dado pessoal), ip_hash, resultado`.
- **Todo** acesso master a conteúdo (listar fotos pré-revelação, abrir painel, baixar ZIP) é auditado, inclusive leituras.
- Encadeamento por hash (cada linha guarda `hash(linha_anterior + atual)`) para detectar adulteração; export periódico do hash de cabeça para fora da VPS.
- Aviso nos **Termos** (Redator) de que a plataforma pode acessar o conteúdo para suporte e moderação, com a finalidade e o registro.

## Parte 2 — Criação aberta e anti-spam

### Opções
- **A. Só rate limit** (IP + janela): simples, mas contornável por rotação de IP e punitivo em rede móvel com CGNAT.
- **B. Rate limit + captcha** (Cloudflare Turnstile, hCaptcha ou reCAPTCHA): bloqueia bots; Turnstile é gratuito e sem fricção visual; dependência de terceiro e dados do visitante.
- **C. Criação só com e-mail verificado** (link mágico da decisão 002): cada evento exige conta verificada; spam fica caro. Combina bem com captcha.
- **D. Criação por convite/lista de espera**: elimina spam, mata o "qualquer pessoa cadastra".

### Decisão recomendada (parte 2)
**C + B + A, nesta camada:** (1) criação exige conta de organizador com e-mail verificado (002) — o spam deixa de ser anônimo; (2) captcha **Turnstile** só no pedido do link mágico e na criação (invisível/gerenciado), com **degradação**: se o provedor cair, cai para rate limit mais duro, nunca abre; (3) rate limit por IP, por e-mail e por conta (ex.: 3 eventos/dia/conta, 10 pedidos de link/hora/IP), configuráveis nas variáveis da plataforma; (4) `criacaoAberta=false` (já existe) como botão de emergência; (5) limites por evento já existentes (`maxFotosPorEvento` etc.) valem desde a criação.
- Honeypot e tempo mínimo de preenchimento como camada barata no formulário.
- `trust proxy` configurado corretamente atrás do Nginx (senão o rate limit enxerga só o IP do proxy — armadilha comum).

## Consequências
- Depende de 002 (contas e e-mail), Forja-Dados (tabelas) e Forja-Obs (rate limit/logs). Forja-Master consome 003 inteira; Forja-Auth entrega a infraestrutura de sessão/cookie compartilhada.
- Chaves (Turnstile, `MASTER_TOTP_KEY`) só por variável de ambiente; se faltarem, listar em `docs/ACTIONS.md`.
