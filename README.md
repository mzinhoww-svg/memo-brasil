# Memo Brasil (MVP web)

Lume: o álbum de casamento que se revela aos poucos, com as fotos de todos os convidados guardadas até a hora certa. Qualquer pessoa cadastra o seu casamento (tenant); a organização (casal e cerimonial) gere tudo em um painel; os convidados entram pelo QR Code e fotografam. As fotos ficam bloqueadas até a hora da revelação. Um admin master administra todos os casamentos e as variáveis da plataforma.

## Rodar
    npm install
    npm start        # http://localhost:3210 (o endereço da rede Wi-Fi aparece no terminal)
    npm test         # API, isolamento, persistência, relógio, restart, observabilidade, limites, e-mail, revelação e LGPD

Variáveis de ambiente: `PORT`, `DATA_DIR` (padrão `./data`), `PUBLIC_URL` (domínio público do QR Code, dos links e dos cookies `Secure`; em `NODE_ENV=production` precisa começar com `https://`), `TRUST_PROXY` (saltos de proxy confiáveis; padrão `0` — sem proxy na frente), `MASTER_TOKEN` (token do master legado; sem ela, `data/master.token`; em `PUBLIC_URL` https não vale), `VAPID_CONTACT` (contato das notificações push), `MAX_FOTOS_EVENTO` (teto de fotos por evento; padrão `3000`), `SENTRY_DSN` (opcional; sem ele, a observabilidade de erros é no-op), `LOG_RETENCAO_DIAS` (retenção do hash de IP nos logs), `RETENCAO_DIAS_APOS_REVELACAO` e `RETENCAO_DIAS_SEM_REVELACAO` (prazos de retenção dos dados pessoais), `EXPORT_DIR` (destino dos exports) e `BACKUP_RETENTION_DIAS` (retenção dos backups; padrão `30`). E-mail: `EMAIL_PROVIDER` (`smtp` = Brevo em produção; `console` só em dev/teste, recusado em produção), `SMTP_HOST` (padrão `smtp-relay.brevo.com`), `SMTP_PORT` (padrão `587` com STARTTLS), `SMTP_USER`, `SMTP_PASS` (segredo), `EMAIL_FROM` (ou `MAIL_FROM`), `EMAIL_VERIFICADOS` (endereços liberados para o aviso de revelação) e `EMAIL_TIMEOUT_MS`/`SMTP_TIMEOUT_MS`. Veja `.env.example` e `docs/deploy.md`. Só em teste (`NODE_ENV=test`): `TEST_NOW` fixa o "agora" do servidor (`src/clock.js`) para exercitar a revelação sem esperar; em produção é ignorado.

## Moderação e privacidade (LGPD)
- **Denúncia**: o convidado autenticado (id + token do convidado no header `x-guest-token`) denuncia em `POST /api/events/:id/fotos/:pid/denunciar`; a organização vê em `GET /api/events/:id/denuncias` e pode **ocultar** (`PATCH /api/events/:id/photos/:pid`) ou **apagar** (`DELETE`). A foto oculta some do álbum, do ZIP e das contagens, mas a organização continua vendo. Tudo fica em `data/audit.log`.
- **Consentimento**: o servidor exige o aceite na entrada (`consentimento.fotos === true` e a versão vigente do texto) e registra a versão + data, sem IP.
- **Exportar um evento** (JSON sem tokens + fotos): `node scripts/exportar-evento.js <id> [--saida=arquivo.zip]`
- **Apagar um evento** em cascata e auditado: `node scripts/apagar-evento.js <id> --confirmar=<id>` (sem a confirmação, nada é apagado).
- **Retenção**: `node scripts/retencao.js` lista os vencidos (dry-run); `node scripts/retencao.js --executar` avisa quem está a 30 dias do prazo e apaga os vencidos. Padrão: 365 dias após a revelação e 180 dias depois de `revealAt` para eventos que não abriram.
- Os comandos operam no SQLite (`memo.db`) via `Store` e **recusam rodar com o servidor ativo** (lock em `DATA_DIR/server.lock`). Procedimentos, prazos e restauração em `docs/lgpd.md`.

## Jornadas
- **Convidado** (escuro, mobile): `/e/:id` convite → `/e/:id/inicio` hub → câmera, álbum, programação e local, presença, recados. Pode instalar o app (PWA) e ativar avisos. Depois da revelação, o álbum abre com autor em cada foto e a retrospectiva do dia.
- **Organização** (claro, desktop): `/` cria evento → `/painel/:id` com Resumo, Convidados (RSVP, CSV), Detalhes e programação, Fotos e recados (moderação, ZIP), Avisos (push), Convite e QR, Configurações, Equipe.
- **Admin master**: `/master` com Casamentos, Fotos por casamento, Plataforma (variáveis), Avisos globais, Auditoria, Políticas. Entra por **sessão** (e-mail + senha + código do app autenticador), com cookie `httpOnly`; o token estático é só legado de desenvolvimento. Primeira conta: `node scripts/master-criar.js <email> <nome>` com a senha em `MASTER_SENHA` ou no prompt (nunca por argumento).

## Observabilidade e limites
- **`GET /healthz`** responde `status` (`ok` ou `degradado`), `versao`, `uptimeS` e `gravacao` (teste real de escrita em `DATA_DIR`). Vai a `503` quando o disco não aceita gravação. Não devolve token, nome, e-mail nem caminho de disco.
- **Logs**: uma linha JSON por requisição (`src/obs/logger.js`) com método, rota (sem query string; tokens no caminho são redigidos), status, duração e o IP apenas como **hash curto**. Nunca registra corpo, cabeçalhos, e-mail, nome, token nem texto de recado. Corpo JSON malformado responde 400 sem ecoar nem logar o conteúdo.
- **Retenção do hash de IP**: o IP nunca é guardado em claro; só o hash curto e não reversível, retido por `LOG_RETENCAO_DIAS` (padrão **30**) dias. Documentado em `/api/master/politicas`.
- **Teto de fotos por evento**: `MAX_FOTOS_EVENTO` (padrão `3000`). O limite por evento/plataforma só aperta esse teto, nunca o ultrapassa. Upload acima do teto responde **413** em pt-BR. Estimativa de disco (pior caso): `MAX_FOTOS_EVENTO × tamanhoMaxFotoMB`; com os padrões, `3000 × 10 MB ≈ 30 GB` por evento.
- **Erros (Sentry, opcional)**: com `SENTRY_DSN` definido, erros não tratados vão para o endpoint de envelope do Sentry via `fetch` (`src/obs/sentry.js`), sem dependência nova e **sem enviar o corpo da requisição**. Sem `SENTRY_DSN`, é no-op.

## Regras que importam
- O álbum é individual por casamento. Nenhuma rota devolve dados de um tenant com o token de outro (coberto por teste).
- O bloqueio das fotos é do servidor: o arquivo devolve 403 antes da revelação, exceto para a organização (moderação) e o master.
- Ações sensíveis vão para `data/audit.log` (só inserção).
- A revelação é do relógio do servidor: na hora marcada, o job manda push a quem instalou o app e e-mail à organização — uma vez só, marcado no evento (`revealNotified`/`emailEnviado`), então repetir o ciclo ou reiniciar não duplica. O job tem trava (um ciclo por vez) e timeout por envio, e o e-mail só sai para endereço verificado da organização. A retrospectiva (`GET /api/events/:id/retrospectiva`, totais, top fotógrafos e linha do tempo por hora) só responde depois da revelação, só olha o próprio casamento e não conta foto oculta pela moderação.
- Papéis: casal (tudo do evento), cerimonial (tudo, menos equipe), master (tudo, todos os eventos).
- Ação que muda estado com **cookie de sessão** exige `Origin` do próprio domínio (anti-CSRF); quem usa token em cabeçalho não é afetado e `GET` continua livre.

## Backup e retenção (LGPD): exclusão de evento não alcança backups já feitos
- `npm run backup` gera `DATA_DIR/backups/memo-<data>.tar.gz` com banco, fotos, auditoria e configurações (sem diretório solto).
- Retenção: `BACKUP_RETENTION_DIAS` (padrão **30**). Arquivos mais antigos que isso são removidos do host. Copie sempre o arquivo para fora do host (offsite).
- Em produção (`NODE_ENV=production` ou `PUBLIC_URL` começando com `https://`) o backup é obrigatoriamente cifrado: defina `BACKUP_GPG_KEY` (chave pública) ou `BACKUP_PASSPHRASE`. Sem isso o script falha e não gera cópia em claro. Fora de produção a cifra é opcional (avisada, não exigida).
- Excluir um evento remove o banco e as fotos do host, mas **não** apaga backups já gerados. Eles deixam de existir apenas quando expiram pela retenção (ou por remoção manual). Ou seja, o apagamento de dados pessoais alcança backups já feitos em até `BACKUP_RETENTION_DIAS` dias.

## Limitações conhecidas
- Câmera ao vivo e push exigem HTTPS (ou localhost). iOS só recebe push com o app instalado na Tela de Início (16.4+).
- Push implementado e validado só até a inscrição; a entrega real a aparelhos não foi testada.
- Sem login real (acesso por token), e-mail por SMTP (Brevo) ou console no dev (sem fila; até 5 tentativas por revelação; só para endereço verificado), armazenamento em SQLite + arquivos, retenção por comando (`scripts/retencao.js`; agendamento do job fica para a infra), sem RLS de banco (isolamento por middleware).
- Telas nunca validadas em navegador/celular pelo agente que as escreveu.
- Não copiar marca, textos nem artes do app original (Memo - Capture momentos).
