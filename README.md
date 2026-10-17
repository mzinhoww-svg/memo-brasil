# Memo Brasil (MVP web)

Lume: o álbum de casamento que se revela aos poucos, com as fotos de todos os convidados guardadas até a hora certa. Qualquer pessoa cadastra o seu casamento (tenant); a organização (casal e cerimonial) gere tudo em um painel; os convidados entram pelo QR Code e fotografam. As fotos ficam bloqueadas até a hora da revelação. Um admin master administra todos os casamentos e as variáveis da plataforma.

## Rodar
    npm install
    npm start        # http://localhost:3210 (o endereço da rede Wi-Fi aparece no terminal)
    npm test         # testes de API, isolamento, relógio, restart e moderação/LGPD

Variáveis de ambiente: `PORT`, `DATA_DIR` (padrão `./data`), `PUBLIC_URL` (domínio público do QR Code), `MASTER_TOKEN` (senha do master; sem ela, `data/master.token`), `VAPID_CONTACT` (contato das notificações push), `RETENCAO_DIAS_APOS_REVELACAO`, `RETENCAO_DIAS_SEM_REVELACAO`, `EXPORT_DIR` e `BACKUP_RETENTION_DIAS`. Veja `.env.example`. Só em teste (`NODE_ENV=test`): `TEST_NOW` fixa o "agora" do servidor (`src/clock.js`) para exercitar a revelação sem esperar; em produção é ignorado.

## Moderação e privacidade (LGPD)
- **Denúncia**: o convidado autenticado (id + token do convidado no header `x-guest-token`) denuncia em `POST /api/events/:id/fotos/:pid/denunciar`; a organização vê em `GET /api/events/:id/denuncias` e pode **ocultar** (`PATCH /api/events/:id/photos/:pid`) ou **apagar** (`DELETE`). A foto oculta some do álbum, do ZIP e das contagens, mas a organização continua vendo. Tudo fica em `data/audit.log`.
- **Consentimento**: o servidor exige o aceite na entrada (`consentimento.fotos === true` e a versão vigente do texto) e registra a versão + data, sem IP.
- **Exportar um evento** (JSON sem tokens + fotos): `node scripts/exportar-evento.js <id> [--saida=arquivo.zip]`
- **Apagar um evento** em cascata e auditado: `node scripts/apagar-evento.js <id> --confirmar=<id>` (sem a confirmação, nada é apagado).
- **Retenção**: `node scripts/retencao.js` lista os vencidos (dry-run); `node scripts/retencao.js --executar` avisa quem está a 30 dias do prazo e apaga os vencidos. Padrão: 365 dias após a revelação e 180 dias depois de `revealAt` para eventos que não abriram.
- Os comandos operam no SQLite (`memo.db`) via `Store` e **recusam rodar com o servidor ativo** (lock em `DATA_DIR/server.lock`). Procedimentos, prazos e restauração em `docs/lgpd.md`.

## Jornadas
- **Convidado** (escuro, mobile): `/e/:id` convite → `/e/:id/inicio` hub → câmera, álbum, programação e local, presença, recados. Pode instalar o app (PWA) e ativar avisos.
- **Organização** (claro, desktop): `/` cria evento → `/painel/:id` com Resumo, Convidados (RSVP, CSV), Detalhes e programação, Fotos e recados (moderação, ZIP), Avisos (push), Convite e QR, Configurações, Equipe.
- **Admin master**: `/master` com Casamentos, Fotos por casamento, Plataforma (variáveis), Avisos globais, Auditoria, Políticas.

## Regras que importam
- O álbum é individual por casamento. Nenhuma rota devolve dados de um tenant com o token de outro (coberto por teste).
- O bloqueio das fotos é do servidor: o arquivo devolve 403 antes da revelação, exceto para a organização (moderação) e o master.
- Ações sensíveis vão para `data/audit.log` (só inserção).
- Papéis: casal (tudo do evento), cerimonial (tudo, menos equipe), master (tudo, todos os eventos).

## Backup e retenção (LGPD): exclusão de evento não alcança backups já feitos
- `npm run backup` gera `DATA_DIR/backups/memo-<data>.tar.gz` com banco, fotos, auditoria e configurações (sem diretório solto).
- Retenção: `BACKUP_RETENTION_DIAS` (padrão **30**). Arquivos mais antigos que isso são removidos do host. Copie sempre o arquivo para fora do host (offsite).
- Em produção (`NODE_ENV=production` ou `PUBLIC_URL` começando com `https://`) o backup é obrigatoriamente cifrado: defina `BACKUP_GPG_KEY` (chave pública) ou `BACKUP_PASSPHRASE`. Sem isso o script falha e não gera cópia em claro. Fora de produção a cifra é opcional (avisada, não exigida).
- Excluir um evento remove o banco e as fotos do host, mas **não** apaga backups já gerados. Eles deixam de existir apenas quando expiram pela retenção (ou por remoção manual). Ou seja, o apagamento de dados pessoais alcança backups já feitos em até `BACKUP_RETENTION_DIAS` dias.

## Limitações conhecidas
- Câmera ao vivo e push exigem HTTPS (ou localhost). iOS só recebe push com o app instalado na Tela de Início (16.4+).
- Push implementado e validado só até a inscrição; a entrega real a aparelhos não foi testada.
- Sem login real (acesso por token), sem e-mail, armazenamento em SQLite + arquivos, retenção por comando (`scripts/retencao.js`; agendamento do job fica para a infra), sem RLS de banco (isolamento por middleware).
- Telas nunca validadas em navegador/celular pelo agente que as escreveu.
- Não copiar marca, textos nem artes do app original (Memo - Capture momentos).
