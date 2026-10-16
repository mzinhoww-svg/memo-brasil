# Memo Brasil (MVP web)

Álbum colaborativo de casamento: cada convidado é fotógrafo. Qualquer pessoa cadastra o seu casamento (tenant); a organização (casal e cerimonial) gere tudo em um painel; os convidados entram pelo QR Code e fotografam. As fotos ficam bloqueadas até a hora da revelação. Um admin master administra todos os casamentos e as variáveis da plataforma.

## Rodar
    npm install
    npm start        # http://localhost:3210 (o endereço da rede Wi-Fi aparece no terminal)
    npm test         # testes de API, de isolamento entre casamentos e de moderação/LGPD

Variáveis de ambiente: `PORT`, `DATA_DIR` (padrão `./data`), `PUBLIC_URL` (domínio público do QR Code), `MASTER_TOKEN` (senha do master; sem ela, `data/master.token`), `VAPID_CONTACT` (contato das notificações push), `RETENCAO_DIAS_APOS_REVELACAO`, `RETENCAO_DIAS_SEM_REVELACAO` e `EXPORT_DIR`. Veja `.env.example`.

## Moderação e privacidade (LGPD)
- **Denúncia**: o convidado denuncia uma foto em `POST /api/events/:id/fotos/:pid/denunciar`; a organização vê em `GET /api/events/:id/denuncias` e pode **ocultar** (`PATCH /api/events/:id/photos/:pid`) ou **apagar** (`DELETE`). A foto oculta some do álbum e do ZIP, mas a organização continua vendo. Tudo fica em `data/audit.log`.
- **Consentimento**: ao entrar, o convidado registra a versão do texto aceito e a data no próprio evento (`data.consentimentos`).
- **Exportar um evento** (JSON sem tokens + fotos): `node scripts/exportar-evento.js <id> [--saida=arquivo.zip]`
- **Apagar um evento** em cascata e auditado: `node scripts/apagar-evento.js <id> --confirmar=<id>` (sem a confirmação, nada é apagado).
- **Retenção**: `node scripts/retencao.js` lista os eventos vencidos (dry-run); `node scripts/retencao.js --executar` apaga. Padrão: 365 dias após a revelação e 180 dias para eventos nunca revelados.

## Jornadas
- **Convidado** (escuro, mobile): `/e/:id` convite → `/e/:id/inicio` hub → câmera, álbum, programação e local, presença, recados. Pode instalar o app (PWA) e ativar avisos.
- **Organização** (claro, desktop): `/` cria evento → `/painel/:id` com Resumo, Convidados (RSVP, CSV), Detalhes e programação, Fotos e recados (moderação, ZIP), Avisos (push), Convite e QR, Configurações, Equipe.
- **Admin master**: `/master` com Casamentos, Fotos por casamento, Plataforma (variáveis), Avisos globais, Auditoria, Políticas.

## Regras que importam
- O álbum é individual por casamento. Nenhuma rota devolve dados de um tenant com o token de outro (coberto por teste).
- O bloqueio das fotos é do servidor: o arquivo devolve 403 antes da revelação, exceto para a organização (moderação) e o master.
- Ações sensíveis vão para `data/audit.log` (só inserção).
- Papéis: casal (tudo do evento), cerimonial (tudo, menos equipe), master (tudo, todos os eventos).

## Limitações conhecidas
- Câmera ao vivo e push exigem HTTPS (ou localhost). iOS só recebe push com o app instalado na Tela de Início (16.4+).
- Push implementado e validado só até a inscrição; a entrega real a aparelhos não foi testada.
- Sem login real (acesso por token), sem e-mail, armazenamento em JSON + arquivos, retenção por comando (`scripts/retencao.js`; agendamento do job fica para a infra), sem RLS de banco (isolamento por middleware).
- Telas nunca validadas em navegador/celular pelo agente que as escreveu.
- Não copiar marca, textos nem artes do app original (Memo - Capture momentos).
