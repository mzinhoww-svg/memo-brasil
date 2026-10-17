# Memo Brasil (MVP web)

Lume: o álbum de casamento que se revela aos poucos, com as fotos de todos os convidados guardadas até a hora certa. Qualquer pessoa cadastra o seu casamento (tenant); a organização (casal e cerimonial) gere tudo em um painel; os convidados entram pelo QR Code e fotografam. As fotos ficam bloqueadas até a hora da revelação. Um admin master administra todos os casamentos e as variáveis da plataforma.

## Rodar
    npm install
    npm start        # http://localhost:3210 (o endereço da rede Wi-Fi aparece no terminal)
    npm test         # suíte: API, isolamento entre casamentos, persistência, relógio, restart, observabilidade, limites, e-mail e revelação

Variáveis de ambiente: `PORT`, `DATA_DIR` (padrão `./data`), `PUBLIC_URL` (domínio público do QR Code e dos links), `MASTER_TOKEN` (senha do master; sem ela, `data/master.token`), `VAPID_CONTACT` (contato das notificações push), `MAX_FOTOS_EVENTO` (teto de fotos por evento; padrão `3000`), `SENTRY_DSN` (opcional; sem ele, a observabilidade de erros é no-op) e `LOG_RETENCAO_DIAS` (retenção do hash de IP nos logs). E-mail: `EMAIL_PROVIDER` (`smtp` = Brevo em produção; `console` só em dev/teste, recusado em produção), `SMTP_HOST` (padrão `smtp-relay.brevo.com`), `SMTP_PORT` (padrão `587` com STARTTLS), `SMTP_USER`, `SMTP_PASS` (segredo), `EMAIL_FROM` (ou `MAIL_FROM`), `EMAIL_VERIFICADOS` (endereços liberados para o aviso de revelação) e `EMAIL_TIMEOUT_MS`/`SMTP_TIMEOUT_MS`. Veja `.env.example` e `docs/deploy.md`. Só em teste (`NODE_ENV=test`): `TEST_NOW` fixa o "agora" do servidor (`src/clock.js`) para exercitar a revelação sem esperar; em produção é ignorado.

## Jornadas
- **Convidado** (escuro, mobile): `/e/:id` convite → `/e/:id/inicio` hub → câmera, álbum, programação e local, presença, recados. Pode instalar o app (PWA) e ativar avisos. Depois da revelação, o álbum abre com autor em cada foto e a retrospectiva do dia.
- **Organização** (claro, desktop): `/` cria evento → `/painel/:id` com Resumo, Convidados (RSVP, CSV), Detalhes e programação, Fotos e recados (moderação, ZIP), Avisos (push), Convite e QR, Configurações, Equipe.
- **Admin master**: `/master` com Casamentos, Fotos por casamento, Plataforma (variáveis), Avisos globais, Auditoria, Políticas.

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

## Backup e retenção (LGPD): exclusão de evento não alcança backups já feitos
- `npm run backup` gera `DATA_DIR/backups/memo-<data>.tar.gz` com banco, fotos, auditoria e configurações (sem diretório solto).
- Retenção: `BACKUP_RETENTION_DIAS` (padrão **30**). Arquivos mais antigos que isso são removidos do host. Copie sempre o arquivo para fora do host (offsite).
- Em produção (`NODE_ENV=production` ou `PUBLIC_URL` começando com `https://`) o backup é obrigatoriamente cifrado: defina `BACKUP_GPG_KEY` (chave pública) ou `BACKUP_PASSPHRASE`. Sem isso o script falha e não gera cópia em claro. Fora de produção a cifra é opcional (avisada, não exigida).
- Excluir um evento remove o banco e as fotos do host, mas **não** apaga backups já gerados. Eles deixam de existir apenas quando expiram pela retenção (ou por remoção manual). Ou seja, o apagamento de dados pessoais alcança backups já feitos em até `BACKUP_RETENTION_DIAS` dias.

## Limitações conhecidas
- Câmera ao vivo e push exigem HTTPS (ou localhost). iOS só recebe push com o app instalado na Tela de Início (16.4+).
- Push implementado e validado só até a inscrição; a entrega real a aparelhos não foi testada.
- Sem login real (acesso por token), e-mail por SMTP (Brevo) ou console no dev (sem fila; até 5 tentativas por revelação; só para endereço verificado), armazenamento em SQLite, retenção só registrada, sem RLS de banco (isolamento por middleware).
- Telas nunca validadas em navegador/celular pelo agente que as escreveu.
- Não copiar marca, textos nem artes do app original (Memo - Capture momentos).
