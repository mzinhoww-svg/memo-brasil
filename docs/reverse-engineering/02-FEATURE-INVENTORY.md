# 02 — Inventário funcional

Legenda — **Conf.:** OBS/EST/INF/HIP · **Prio.:** P0 núcleo, P1 importante, P2 desejável, P3 adiável · **Evid.:** ver chaves em `14` (E-xx).
Colunas condensadas: *Resultado observado* = o que foi visto/lido; *Estados alt.* = erros/vazios. Persistência: L=local, R=remoto (Supabase).

| ID | Funcionalidade | Tela | Pré-condição / Ação → Comportamento (regras de negócio) | Estados alternativos | Persist. | Dep. | Evid. | Conf. | Prio. |
|---|---|---|---|---|---|---|---|---|---|
| F-01 | Splash/launch | Loading | Abre o app → animação (`SLIDE_INTERVAL_MS`, pulse/scale) e decide rota (onboarding vs home) | — | L | — | E-03 | EST | P2 |
| F-02 | Intro em 3 slides | IntroSlides | Toque em "Próximo" avança; indicador de páginas; textos "Os momentos acabam. As memórias continuam." / "E as melhores memórias… merecem durar para sempre." / "O memo reúne todas essas perspectivas…" | — | L | assets | E-01, E-S1..3 | OBS | P1 |
| F-03 | Entrar com Google | WelcomeAuth | Credential Manager → Supabase `signInWith(IDToken)`; cria/atualiza `profiles` | "Login com Google não retornou usuário"; "Entrando…" | R | Google | E-05 | EST | P0 |
| F-04 | Entrar com e-mail/senha | EmailAuthSheet | Alterna Entrar/Criar conta; senha mín. 6; "Esqueci minha senha" | Versão 2.1.10 mostra "Ainda não disponível nesta versão do app. Por enquanto, entre com o Google." | R | Supabase | E-04, E-S5 | OBS (UI) / EST (msg) | P2 |
| F-05 | Entrar como convidado (código) | JoinWithCode (na Welcome) | Cria sessão anônima (`signInAnonymously`) e resolve código | Código inválido/encerrado/lotado; "Não foi possível entrar → Tentar de novo / Continuar sem entrar no evento" | R | RPC | E-05, E-06 | OBS (UI) / EST | P0 |
| F-06 | Nome de exibição | NameEntry | "Como podemos te chamar?" — nome aparece nas fotos; obrigatório p/ continuar | vazio desabilita Continuar (INF) | L+R(`profiles`) | — | E-S | EST | P0 |
| F-07 | Propósito (segmentação) | PurposeSelection | 6 ícones: aniversário, casamento, empresa, viagem, chá de bebê, outro; "Concluir" | — | L | — | E-S, E-11 | EST | P2 |
| F-08 | Home com hero de evento ativo | Home | Carrossel de eventos ativos (capa, contagem), CTA "Abrir câmera"; vazio: "Crie um novo evento" | sem eventos → `HomeEmptyState` | L+R | F-20 | E-S | EST | P0 |
| F-09 | Lista de álbuns | Home (ÁLBUNS) | Evento encerrado vira álbum com tiles de fotos (ainda não reveladas mostram "Foto ainda não revelada") | "Nenhum álbum ainda" | L+R | — | E-S | EST | P0 |
| F-10 | Barra de abas | MainTabBar | Abas **FILMES** e **SCRAPBOOK**; Scrapbook = "chega em breve" (toast) | — | — | — | E-S | EST | P3 |
| F-11 | Entrar com código | JoinWithCodeSheet | Código 8 chars, uppercase, alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sem 0/O/1/I/L); ex. "NFVARBQX" | erros F-05 | R | RPC | E-06, E-07 | EST | P0 |
| F-12 | Deep link `https://appmemo.online/<8>` e `memo://join` | MainActivity | Último segmento do path vira código → fluxo de entrada | código ausente/ inválido | — | domínio | E-02 | EST | P0 |
| F-13 | Criar evento (wizard 9 passos) | CreateEvent | Ordem: NOTIFICATIONS → NAME → CATEGORY → END_DATE → REVEAL_TIMING → CAMERA_STYLE → INVITATION → GUEST_CAPACITY → PRICING + CREATED (ordem confirmada no enum e no fluxo; EST) | "Não deu para criar o evento" (Tentar novamente/Voltar); "Criando o evento…" | L+R | billing | E-08 | EST | P0 |
| F-14 | Permissão de notificações | NotificationsPermission | "Não perca nenhum momento" + "Ativar notificações"/"Agora não" | negado → segue | L | OS | E-S | EST | P1 |
| F-15 | Nome do evento | EventName | Texto livre + sugestões ("Nossa festinha", "Nosso encontro", "Um dia para lembrar") | vazio bloqueia (INF) | L | — | E-S, E-12 | EST | P0 |
| F-16 | Categoria do evento | EventCategory | Casamento, Evento de empresa, Viagem, Festa, Outro; define título padrão ("Casamento de {host}") | — | L | — | E-11 | EST | P1 |
| F-17 | Data/hora de término | EventEndDate | Calendário mensal + horário; **mínimo 30 min a partir de agora**; "O filme abre agora" | datas passadas desabilitadas | L→R | — | E-S | EST | P0 |
| F-18 | Revelação das fotos | EventRevealTiming | `DURING_EVENT` (aos poucos), `AFTER_EVENT`, `ADDITIONAL_DELAY` (+N dias, stepper) | — | R | — | E-13 | EST | P0 |
| F-19 | Estilo de câmera | EventCameraStyle | ORIGINAL / VINTAGE / BLACK_WHITE; nota: "Fotos originais são salvas por padrão" | — | R | F-27 | E-13 | EST | P1 |
| F-20 | Personalizar convite (capa, preview, QR) | EventInvitation | Capa padrão (3 genéricas, 2 fotos) ou imagem própria (`custom:`); preview "É assim que o convidado vê"; QR gerado localmente | imagem inválida → "Não foi possível usar essa imagem" | L+R(`covers/`) | Storage | E-S, E-09 | EST | P1 |
| F-21 | Capacidade e fotos por pessoa | EventGuestCapacity | Convidados: 5,10,20,50,100,150,200,ilimitado; fotos/pessoa: 5,10,16,24,36,ilimitado; toggle "Todos podem ver todas as fotos" | tiers pagos marcados ("Grátis"/"Incluído no Memo+") | R | billing | E-13, E-10 | EST | P0 |
| F-22 | Preço/confirmação | Pricing | ≤10 grátis; senão compra única via Play (SKU por faixa) ou Memo+; "Criar evento grátis"/"Pagar X e criar" | "Preço indisponível", "Não conseguimos falar com o Google Play" | L (créditos) | Play Billing | E-10 | EST | P0 |
| F-23 | Paywall Memo+ | MemoPlusPaywall | Planos anual/mensal, benefícios (até 200 convidados, fotos ilimitadas), restaurar compras, texto de renovação | "Tentar de novo"; "Assinatura ativa" | L | Play | E-10 | EST | P1 |
| F-24 | Evento criado / compartilhar convite | EventCreated, InviteSheet | Mostra código, convidados, fotos/pessoa, link; share sheet com texto "Você foi convidado para "X" no Memo! Entre com o código … ou pelo link: …"; copiar | — | — | share | E-S | EST | P0 |
| F-25 | Convite por QR | InviteSheet | QR com payload do link/código | — | — | — | E-S | EST | P1 |
| F-26 | Câmera | Camera | CameraX preview; zoom 1×/2×; inverter câmera; contador de rolo (`FilmDial`); miniatura da galeria; notice quando rolo acaba ("Você usou todas as suas fotos deste evento.") | permissão negada (Pedir de novo/Abrir configurações); falha ao abrir/capturar/gravar | L→R | CameraX | E-S | EST | P0 |
| F-27 | Estilos aplicados à foto | PhotoStyleFilter | VINTAGE/BW aplicados no bitmap (contraste, dessaturação, tint) antes de salvar | — | L | — | E-14 | EST | P1 |
| F-28 | Rolo limitado por pessoa | Camera/PhotoSync | Contador local + imposição no servidor; `shotlimitreached` remove a foto e avisa "Suas fotos neste evento acabaram — esta não entrou no rolo." | — | L+R | RPC/RLS | E-15 | EST | P0 |
| F-29 | Upload/sincronização offline-first | PendingSyncCoordinator | Foto/evento/reação salvos localmente, ids pendentes; `syncPending` reenvia; fotos recusadas → `rejectOverLimit` | sem rede → pendente | L+R | Storage | E-16 | EST | P0 |
| F-30 | Galeria do evento | Gallery | Capa, estatísticas (Momentos, Restantes, Pessoas, Encerrado), grade de fotos, ações Abrir câmera/Convidar/Compartilhar/Salvar | vazia: "Nenhuma foto ainda"; álbum de exemplo (Tina) | L+R | — | E-S | EST | P0 |
| F-31 | Revelação (gating) | Gallery/Home | Foto não revelada bloqueada ("Foto ainda não revelada") conforme `RevealTiming`; notificações REVEAL_SOON/REVEALED | — | R | tempo | E-13 | EST/INF | P0 |
| F-32 | Visualizador + reações | PhotoViewerOverlay | Filmstrip, barra de reação flutuante 🔥❤️😂😮 (1 por usuário/foto, upsert), resumo e "Quem reagiu" | "Ninguém reagiu…" | R | RPC/PG | E-17 | EST | P1 |
| F-33 | Editor de foto | PhotoEditor | Modos Desenho, Texto (fontes Serif/Itálico/Elegante/Sans; arrastar, excluir), Borracha, Colagem (2/3/4 fotos: 2 lado a lado, 2 empilhadas, 3, 4), Desfazer/Refazer, Concluir grava versão editada | "Ainda não há outras fotos neste álbum." | L(+R) | canvas | E-S | EST | P2 |
| F-34 | Exportar álbum/baixar | AlbumExporter | Baixa fotos em lote e salva em `Pictures/Memo` (MediaStore) com progresso; relatório (salvas, falhas, ausentes no servidor) | sem permissão (≤API28) | L | — | E-S | EST | P1 |
| F-35 | Compartilhar fotos | Gallery | `ACTION_SEND_MULTIPLE` via FileProvider | "Nenhum app disponível para compartilhar fotos" | — | share | E-S | EST | P2 |
| F-36 | Configurações do evento (host) | EventSettings | Editar nome & capa, data de término (Encerrar agora / hoje / amanhã / +3 / +7 / +30 dias; **álbum já encerrado não pode ser reaberto**), revelação, capacidade, fotos/pessoa, visibilidade, reações, **Excluir evento** | exclusão remota falha → "continua com quem participou" | R | — | E-S | EST | P1 |
| F-37 | Perfil: editar nome, sair, excluir conta | ProfileSheet | Sair volta ao onboarding (álbuns locais permanecem); Excluir conta chama `rpc/delete_account` e apaga eventos que organiza | — | R | RPC | E-04, E-S | EST | P1 |
| F-38 | Notificações locais e "ao vivo" | EventNotificationManager / LiveNotificationManager | Alarmes: 1 dia, 1 hora, 10 min antes; fim; revelação; reagendamento após boot; card persistente com rolo restante | permissão negada | L | AlarmManager | E-18 | EST | P1 |

## Funcionalidades não confirmadas / sem evidência
- E-mail/senha operante (UI presente, mensagem de indisponibilidade) — tratar como **não disponível**.
- Scrapbook — placeholder.
- Flash: existe `ic_flash` em drawables; uso na câmera **não confirmado** (HIP).
- Vídeo, comentários, chat, busca, perfil público: **sem evidência — não implementar**.
