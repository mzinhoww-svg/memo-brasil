# 002 — Autenticação do organizador (casal e cerimonial)

- Status: **recomendada**
- Autor: Planejador · Data: 2026-10-13
- Cobre o item 5 do checklist.

## Contexto

Hoje o organizador é o portador de um `hostToken` (aleatório, no `localStorage` por evento, vindo também em `#hash` ou `?token=`). Cerimonial e membros do casal entram por links com token por membro (`equipe[].token`). Problemas:
- Perder o aparelho ou limpar o navegador = perder o painel; "recuperar em outro aparelho" não existe.
- Token em query string (`?token=`, usado em `fotos.zip`, `lista.csv`, `photos/:pid/file`) vaza em logs, histórico e `Referer`.
- Sem conta: não há "vários eventos por organizador" nem e-mail para avisar a revelação (item 8).
- Dados pessoais (e-mail) passam a existir: LGPD (finalidade, consentimento, retenção).

Restrições: R$ 100/mês de teto; e-mail transacional precisa de provedor (as chaves vêm da nota "credenciais" do Maestri; **ausentes até confirmação**); convidado continua **sem cadastro**; o master tem fluxo próprio (decisão 003).

## Opções

### A. Link mágico por e-mail (somente)
- Usuário informa e-mail → servidor envia link de uso único (15 min) → sessão.
- Prós: sem senha, sem terceiro de identidade, funciona em qualquer aparelho com acesso ao e-mail (resolve "outro aparelho"), mesmo e-mail serve de canal da revelação. Custo: e-mail transacional (Brevo/Resend/SES free tier cobrem o volume; ≈ R$ 0-20).
- Contras: depende de entregabilidade (SPF/DKIM/DMARC no domínio); e-mail em spam vira "não consigo entrar"; abrir o link em outro aparelho que não o do e-mail exige cuidado (o link deve completar login **no navegador que o abriu**; sem polling de "login no outro aparelho").

### B. Google (OAuth/OIDC) somente
- Prós: UX de um toque; sem problema de entregabilidade.
- Contras: nem todo noivo/cerimonial tem Google; depende de credencial OAuth, tela de consentimento, verificação do app (para escopos básicos `openid email` é leve); lock-in de terceiro no caminho crítico; ainda precisamos de e-mail transacional para a revelação.

### C. Link mágico + Google (ambos)
- Prós: cobre os dois públicos. Contras: duas superfícies de ataque e de teste; vinculação de contas (mesmo e-mail via dois métodos).

### D. E-mail + senha
- Contras: armazenar senhas, reset por e-mail (que é um link mágico de qualquer forma), fraude e reuso. Sem ganho. Descartada.

## Decisão recomendada

**Opção A no MVP; Google (C) como incremento posterior se o suporte indicar necessidade.** Link mágico entrega os 4 aceites do item 5 com uma única dependência externa (e-mail). O Google adiciona dependência e superfície sem resolver nada que o link não resolva.

### Desenho

**Modelo:** `organizadores(id, email_normalizado único, criado_em, consentimento_em, consentimento_versao)`; `membros(evento_id, organizador_id, papel ∈ {casal, cerimonial})` substitui `hostToken`/`equipe[].token` como fonte de verdade. Um organizador, vários eventos (`membros`).

**Fluxo:**
1. `POST /api/auth/link` `{email}` → **sempre** 202 com a mesma resposta (não revela se o e-mail existe). Rate limit por IP e por e-mail (ex.: 5/hora). Token de 256 bits, guardado só como hash (SHA-256), uso único, expira em 15 min.
2. E-mail com `GET /api/auth/entrar?t=...` → **página intermediária com botão "Entrar"** (POST) para evitar que scanners de e-mail (Outlook SafeLinks, antivírus) consumam o token em pré-visualização.
3. POST consome o token e cria **sessão**: id aleatório de 256 bits, guardado como hash em `sessoes(id_hash, organizador_id, criada, ultimo_uso, expira, ua_resumo)`; cookie `Set-Cookie: memo_sid=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=30d` (rolante, teto absoluto 90 dias). Prefixo `__Host-` em produção.
4. **CSRF:** `SameSite=Lax` + exigir `Content-Type: application/json` ou cabeçalho `X-Memo-CSRF` (token duplo derivado da sessão) em todo método não-GET; `Origin` conferido contra `PUBLIC_URL`.
5. **Sair / revogar:** `POST /api/auth/sair`; tela "Aparelhos conectados" lista sessões e permite revogar; trocar de e-mail exige novo link nos dois endereços.
6. **Recuperar em outro aparelho:** é o próprio fluxo — pedir link no aparelho novo. Não existe "código de recuperação" separado. Quem perdeu acesso ao e-mail recupera por suporte: o master pode reenviar convite para novo e-mail com registro em auditoria.
7. **Convites de equipe:** o casal informa o e-mail do cerimonial/parceiro; o convite é um link mágico com vínculo pré-aprovado ao evento e papel. Cerimonial não gerencia equipe (regra atual mantida).
8. **Transição dos tokens atuais:** `hostToken` existente vira "link de reivindicação" de uso único: abre o painel e pede o e-mail para vincular o evento à conta; depois é invalidado. Eventos sem reivindicação em N dias seguem com token (flag), até serem migrados ou expirarem. Remover a leitura de `?token=` para arquivos: downloads passam a usar a sessão (cookie) ou URL assinada curta (5 min) gerada por POST.

### Dados pessoais e LGPD
- Finalidade declarada: autenticar e avisar sobre o evento; base legal: execução do serviço + consentimento registrado na criação da conta. E-mail nunca em log (usar hash curto); apagado junto com a conta; retenção da conta = enquanto houver evento ativo + prazo do evento.
- Não usar o e-mail para marketing sem consentimento separado.

## Consequências / pontos para o Redator e o QA
- Redator: e-mails (link mágico, convite, revelação), tela de "enviamos um link" com texto que não confirma existência da conta.
- QA: token expirado, token reutilizado, scanner que faz GET, e-mail com maiúsculas/aliases `+`, sessão após revogação, CSRF, enumeração de e-mail por tempo de resposta.
- Depende de: Forja-Dados (tabelas), domínio com SPF/DKIM (ação externa em `docs/ACTIONS.md`), credencial de e-mail. **Sem credencial, usar adaptador "console" em desenvolvimento e bloquear produção.**
