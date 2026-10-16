# Memo Brasil (MVP web)

Álbum colaborativo de casamento: cada convidado é fotógrafo. Qualquer pessoa cadastra o seu casamento (tenant); a organização (casal e cerimonial) gere tudo em um painel; os convidados entram pelo QR Code e fotografam. As fotos ficam bloqueadas até a hora da revelação. Um admin master administra todos os casamentos e as variáveis da plataforma.

## Rodar
    npm install
    npm start        # http://localhost:3210 (o endereço da rede Wi-Fi aparece no terminal)
    npm test         # 10 testes de API e de isolamento entre casamentos

Variáveis de ambiente: `PORT`, `DATA_DIR` (padrão `./data`), `PUBLIC_URL` (domínio público do QR Code), `MASTER_TOKEN` (senha do master; sem ela, `data/master.token`), `VAPID_CONTACT` (contato das notificações push).

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
- Sem login real (acesso por token), sem e-mail, armazenamento em JSON + arquivos, retenção só registrada, sem RLS de banco (isolamento por middleware).
- Telas nunca validadas em navegador/celular pelo agente que as escreveu.
- Não copiar marca, textos nem artes do app original (Memo - Capture momentos).
