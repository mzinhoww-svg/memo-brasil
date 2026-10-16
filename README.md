# Memo Brasil (MVP web)

Álbum colaborativo de casamento: cada convidado é fotógrafo. Qualquer pessoa cadastra o seu casamento (tenant); a organização (casal e cerimonial) gere tudo em um painel; os convidados entram pelo QR Code e fotografam. As fotos ficam bloqueadas até a hora da revelação. Um admin master administra todos os casamentos e as variáveis da plataforma.

## Rodar
    npm install
    npm start        # http://localhost:3210 (o endereço da rede Wi-Fi aparece no terminal)
    npm test         # testes de API, isolamento entre casamentos, e-mail e revelação

Variáveis de ambiente: `PORT`, `DATA_DIR` (padrão `./data`), `PUBLIC_URL` (domínio público do QR Code e dos links), `MASTER_TOKEN` (senha do master; sem ela, `data/master.token`), `VAPID_CONTACT` (contato das notificações push), `EMAIL_PROVEDOR` (`console` por padrão; `resend` para enviar de verdade), `EMAIL_API_KEY` e `EMAIL_FROM` (Resend; em produção, sem a chave o envio fica desativado e o erro aparece no log). Veja `.env.example`.

## Jornadas
- **Convidado** (escuro, mobile): `/e/:id` convite → `/e/:id/inicio` hub → câmera, álbum, programação e local, presença, recados. Pode instalar o app (PWA) e ativar avisos. Depois da revelação, o álbum abre com autor em cada foto e a retrospectiva do dia.
- **Organização** (claro, desktop): `/` cria evento → `/painel/:id` com Resumo, Convidados (RSVP, CSV), Detalhes e programação, Fotos e recados (moderação, ZIP), Avisos (push), Convite e QR, Configurações, Equipe.
- **Admin master**: `/master` com Casamentos, Fotos por casamento, Plataforma (variáveis), Avisos globais, Auditoria, Políticas.

## Regras que importam
- O álbum é individual por casamento. Nenhuma rota devolve dados de um tenant com o token de outro (coberto por teste).
- O bloqueio das fotos é do servidor: o arquivo devolve 403 antes da revelação, exceto para a organização (moderação) e o master.
- Ações sensíveis vão para `data/audit.log` (só inserção).
- A revelação é do relógio do servidor: na hora marcada, o job manda push a quem instalou o app e e-mail à organização — uma vez só, marcado no evento (`revealNotified`/`emailEnviado`), então repetir o ciclo ou reiniciar não duplica. A retrospectiva (`GET /api/events/:id/retrospectiva`, totais, top fotógrafos e linha do tempo por hora) só responde depois da revelação e só olha o próprio casamento.
- Papéis: casal (tudo do evento), cerimonial (tudo, menos equipe), master (tudo, todos os eventos).

## Limitações conhecidas
- Câmera ao vivo e push exigem HTTPS (ou localhost). iOS só recebe push com o app instalado na Tela de Início (16.4+).
- Push implementado e validado só até a inscrição; a entrega real a aparelhos não foi testada.
- Sem login real (acesso por token), e-mail só pelo provedor console (log) ou Resend (sem fila; até 5 tentativas por revelação), armazenamento em JSON + arquivos, retenção só registrada, sem RLS de banco (isolamento por middleware).
- Telas nunca validadas em navegador/celular pelo agente que as escreveu.
- Não copiar marca, textos nem artes do app original (Memo - Capture momentos).
