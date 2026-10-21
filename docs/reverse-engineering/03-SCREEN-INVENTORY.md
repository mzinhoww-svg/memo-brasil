# 03 — Inventário de telas

Rotas de navegação (EST, `Navigation/Routes.kt`): `loading`, `introSlides`, `welcomeAuth`, `nameEntry`, `purpose`, `home`, `createEvent`, `camera/{eventId}`, `gallery/{eventId}`. Folhas (bottom sheets) e diálogos são compostos dentro dessas rotas.
**Status:** ✅ observada no emulador · 📖 reconstruída de código/strings (não vista renderizada).

| # | Tela / folha | Status | Elementos visíveis | Interações → transição | Evidência |
|---|---|---|---|---|---|
| S-01 | Loading/Launch (`loading`) | 📖 | imagens de lançamento (praia, festa, casamento) em rotação, marca | auto → onboarding ou home | LaunchScreen.kt; drawables `launch_*` |
| S-02 | Intro slide 1 | ✅ `001-launch.png` | foto hero (corredores), ícone de mão+celular, título serif "Os momentos acabam. As memórias continuam.", botão pílula branca "Próximo →", 3 pontos | Próximo → slide 2 | UI dump |
| S-03 | Intro slide 2 | ✅ `002-intro2.png` | "E as melhores memórias… merecem durar para sempre." | Próximo → slide 3 | UI dump |
| S-04 | Intro slide 3 (colagem) | ✅ `003-intro3.png` | "O memo reúne todas essas perspectivas." + 3 frases de apoio, colagem de fotos | Próximo → welcomeAuth | UI dump |
| S-05 | Boas-vindas / Auth | ✅ `004-after-intro.png` | "Boas-vindas a Memo", botão "Entrar com o Google" (claro), "Continuar com e-mail" (escuro), "Convidado? Entre com um código", rodapé Termos/Privacidade | Google → sessão; e-mail → S-06; código → S-07 | UI dump |
| S-06 | Folha: e-mail | ✅ `005-email-sheet.png` | abas Entrar/Criar conta, campos E-mail e "Senha (mín. 6 caracteres)", "Esqueci minha senha", botão Entrar | enviar → hoje mostra "Ainda não disponível nesta versão…" (EST) | UI dump + string |
| S-07 | Folha: entrar com código | ✅ `007-code-sheet.png` | título "Entrar com código", texto "Peça o código do evento…", campo (placeholder "Ex: NFVARBQX"), "Entrar no evento" | resolve código → entra no evento / erro | UI dump + string |
| S-08 | Nome (`nameEntry`) | 📖 | "Como podemos te chamar?", subtítulo, campo "Seu nome", Continuar | → purpose | NameEntryScreen |
| S-09 | Propósito (`purpose`) | 📖 | "O que te trouxe ao Memo?", 6 opções com ícone, Concluir | → home | PurposeSelectionScreen |
| S-10 | Home (`home`) | 📖 | saudação "Olá, {nome}", hero com evento ativo (capa) / `CreateEventHero` ("Crie um novo evento" → "Criar evento"), seção ÁLBUNS, tile de fotos, abas FILMES/SCRAPBOOK, controles de topo (perfil, entrar com código) | Abrir câmera → camera; tocar álbum → gallery; Novo evento → createEvent | HomeScreen.kt |
| S-11 | Folha: perfil | 📖 | nome, editar, assinatura Memo+, sair, excluir conta | confirmações modais (Sair da conta? / Excluir sua conta?) | ProfileSheet.kt |
| S-12 | Wizard: notificações | 📖 | mockup de celular com notificação, "Não perca nenhum momento", "Ativar notificações", "Agora não" | pede POST_NOTIFICATIONS → próximo | NotificationsPermissionScreen |
| S-13 | Wizard: nome | 📖 | "Qual é o nome do seu evento?", campo, chips SUGESTÕES | Próximo | EventNameScreen |
| S-14 | Wizard: categoria | 📖 | "Que tipo de evento você está criando?" grade de propósitos | Próximo | EventCategoryScreen |
| S-15 | Wizard: término | 📖 | "Quando o seu evento termina?", calendário (Dom–Sáb, mês ant./próx.), HORÁRIO, aviso mínimo 30 min | Próximo | EventEndDateScreen |
| S-16 | Wizard: revelação | 📖 | 3 cartões (durante / ao terminar / +N dias), stepper de dias, preview borrado (Marina/Diego) | Próximo | EventRevealTimingScreen |
| S-17 | Wizard: câmera | 📖 | leque de fotos de exemplo por estilo, 3 swatches (ícones `cam_icon_*`), nota "Fotos originais são salvas por padrão" | Próximo | EventCameraStyleScreen |
| S-18 | Wizard: convite | 📖 | cartão de convite com capa, "Trocar capa", "Pré-visualizar", preview do convidado ("Convidado por…", "Digite seu nome", "Abrir câmera") | Próximo | EventInvitationScreen |
| S-19 | Wizard: convidados/fotos | 📖 | quadradinhos de participantes, chips de capacidade (Grátis/Incluído no Memo+), seletor de fotos por pessoa (dial), toggle visibilidade, "Criar"/"Próximo" | Próximo/Criar | EventGuestCapacityScreen |
| S-20 | Wizard: preço | 📖 | resumo do evento, linhas de preço, upsell Memo+, botões "Criar evento grátis"/"Pagar X e criar" | cria evento → S-22 | PricingScreen |
| S-21 | Paywall Memo+ | 📖 | benefícios, seletor Anual/Mensal ("ECONOMIZE x%"), "Assinar o Memo+", "Restaurar compras", texto legal de renovação | assina via Play | MemoPlusPaywallScreen |
| S-22 | Evento criado | 📖 | "Evento criado!", resumo (Código, Convidados, Fotos por pessoa, Link), "Compartilhar convite", "Abrir câmera", "Fechar" | share/copiar | EventCreatedScreen |
| S-23 | Câmera (`camera/{eventId}`) | 📖 | preview, cabeçalho com título/rolo, `FilmDial`, chips 1×/2×, inverter câmera, disparo, miniatura da galeria, avisos | disparo salva foto; miniatura → gallery | CameraScreen.kt |
| S-24 | Galeria (`gallery/{eventId}`) | 📖 | capa, stats (Momentos/Restantes/Pessoas/Encerrado), ações (Abrir câmera, Convidar, Compartilhar, Salvar), grade de fotos, toast, progresso de exportação | foto → S-25; engrenagem → S-27 | GalleryScreen.kt |
| S-25 | Visualizador de foto | 📖 | foto em tela cheia, filmstrip, top bar (fechar, data·hora), barra de reações, ações Editar/Salvar | Editar → S-26; reagir | PhotoViewerOverlay.kt |
| S-26 | Editor de foto | 📖 | barra superior (Cancelar/Concluir, desfazer/refazer), toolbar Desenho/Texto/Borracha/Colagem, folha "Criar colagem" | Concluir grava | PhotoEditor.kt |
| S-27 | Configurações do evento | 📖 | linhas Nome & Capa, Data de término, Revelação, Convidados, Fotos por pessoa, toggles, "Excluir evento" | diálogos/folhas de edição | EventSettingsScreen.kt |
| S-28 | Folha: convidar | 📖 | título "Convide para "X"", QR, código, "Compartilhar convite" | compartilha | InviteSheet.kt |
| S-29 | Overlays | 📖 | "Criando o evento…" / "Não deu para criar o evento"; toast; diálogo de exclusão ("Excluir evento?"); diálogo "Atenção/Entendi" | — | vários |

**Não observados por bloqueio de autenticação:** S-08 a S-29 (ver `14`).
