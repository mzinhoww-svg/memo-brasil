# Matriz de rastreabilidade: REA → Design System → Implementação → Teste → Status

Legenda de status: **Concluído** (implementado e testado) · **Parcial** (parte do comportamento) · **Depende de backend** (não implementável sem servidor/gateway) · **Substituído** (trocado por decisão registrada) · **Fora do escopo** (sem evidência ou descartado).
Confiança do REA entre colchetes: OBS observado · EST estático · INF inferido. Testes: `U` = Vitest (`web/src/**.test.*`), `E` = Playwright (`web/e2e/*.spec.ts`).

| REA | Funcionalidade (REA) | Design system (kit) | Implementação | Teste | Status |
|---|---|---|---|---|---|
| F-01 [EST] | Splash | Cover | Capa do kit na home (`app/page.tsx`); sem splash | E smoke, visual | Substituído (D11) |
| F-02 [OBS] | 3 slides de intro | voz/assinatura "A festa vista por todo mundo." | Home com Cover e frase de assinatura | E smoke | Substituído (D11) |
| F-03 [EST] | Entrar com Google | — | Não implementado | — | Depende de backend |
| F-04 [OBS UI] | E-mail e senha ("indisponível") | — | Não implementado (inativo no original) | — | Fora do escopo |
| F-05 [OBS UI/EST] | Entrar como convidado por código | Field código, Button | `features/participants/service.ts`, `/e/[code]` (identidade local) | U `features.test` (entra/rejeita/lota/encerra); E "convidado entra…" | Concluído (local) |
| F-06 [EST] | Nome do usuário | Field "Como te chamam na festa?" | `/e/[code]`, wizard | E fluxos | Concluído |
| F-07 [EST] | Propósito (segmentação) | — | Categoria do evento (5 tipos) | U `domain` | Parcial (sem onboarding de propósito) |
| F-08 [EST] | Home com evento ativo | StatTile/LiveIndicator | "Seus eventos" e "Festas em que você entrou" (`app/page.tsx`) | E PWA persistência | Parcial (lista, sem carrossel) |
| F-09 [EST] | Álbuns de eventos encerrados | — | Evento "Encerrado" + retrospectiva | E revelação | Concluído |
| F-10 [EST] | Abas FILMES/SCRAPBOOK | TabBar (Agora/Explorar/Você) | TabBar do kit | E | Substituído (D11) |
| F-11 [EST] | Entrar com código (8 chars, alfabeto sem 0/O/1/I/L) | Field `--codigo` | `domain/share-code.ts`, `/entrar` | U `domain.test` (alfabeto, normalização, link); E "código inválido" | Concluído |
| F-12 [EST] | Deep link `appmemo.online/<8>` e `memo://join` | — | Rota `/e/[code]` (+ `?mesa=`) | U `links`; E | Concluído (web) |
| F-13 [EST] | Wizard de 9 passos | Progress, OptionGroup, Field | `features/events/wizard.tsx` em 6 passos | E wizard + validação | Concluído (6 passos) |
| F-14 [EST] | Permissão de notificações | — | Botão "Ativar avisos" (Você) | E avisos | Parcial (ver F-38) |
| F-15 [EST] | Nome do evento | Field | Wizard passo 1 | E | Concluído |
| F-16 [EST] | Categoria | OptionGroup | Wizard passo 1 | U | Concluído |
| F-17 [EST] | Término ≥30 min | Field, OptionGroup | Wizard passo 2 (presets + horário) | U `validateDraft`; E "término curto" | Concluído |
| F-18 [EST] | Revelação (3 modos) | OptionGroup, Stepper | `domain/event.ts` `revealAt/isRevealed`, wizard/config | U fronteiras; E revelação | Concluído |
| F-19 [EST] | Estilo de câmera | OptionGroup | Wizard; aplicado em `capture.ts` | U `capture.test` | Concluído |
| F-20 [EST] | Convite: capa/preview | EventHeader, Chip, paletas do evento | Paleta + fonte do evento (prévia no wizard) | U contraste | Parcial (sem upload de capa por imagem) |
| F-21 [EST] | Capacidade e fotos por pessoa | OptionGroup | `domain/options.ts`, wizard/config | U opções | Concluído |
| F-22 [EST] | Preço (≤10 grátis) | Notice/Card | `domain/pricing.ts`, resumo do wizard | U `priceRule` | Parcial (regra sim; cobrança não, D7) |
| F-23 [EST] | Paywall Memo+ | — | Não implementado | — | Depende de backend |
| F-24 [EST] | Evento criado / compartilhar | Button, Signature | `/criar/pronto/[id]` (Web Share/copiar) | E wizard | Concluído |
| F-25 [EST] | Convite por QR | TableCard | `qr.ts`, QR Code Studio (card A6 por mesa) | U `qr`; E visual | Concluído |
| F-26 [EST] | Câmera (1×/2×, virar, rolo) | Button CTA-XL, Progress | `/e/[code]/postar` (virar, rolo, permissão, fallback arquivo) | E câmera de teste | Parcial (sem zoom 1×/2×) |
| F-27 [EST] | Estilos aplicados à foto | — | `applyStylePixels` | U | Concluído |
| F-28 [EST] | Rolo limitado | Progress | `canPost`, `postPhoto` (cliente) | U; E rolo esgotado | Concluído (cliente); servidor = backend |
| F-29 [EST] | Sync offline-first | Notice "Sem sinal" | Persistência local + aviso offline | E offline/persistência | Parcial (sem upload remoto) |
| F-30 [EST] | Galeria do evento | PostCard, StatTile, LiveIndicator | `/agora`, `/explorar`, `/voce`, painel | E | Concluído |
| F-31 [EST/INF] | Revelação (gating) | — | `visiblePhotos` | U; E revelação com relógio | Concluído |
| F-32 [EST] | Reações; "Quem reagiu" | Chip | `PhotoReactions`, `MoreSheet` | U `setReaction`; E | Concluído |
| F-33 [EST] | Editor (desenho/texto/borracha/colagem) | Button, Chip, Field | `features/photos/editor.tsx`, `domain/collage.ts` | U colagem; E editor | Concluído (salva por download, D10) |
| F-34 [EST] | Exportar/baixar álbum | Button, Progress | Painel > Downloads (ZIP, CSV); "Baixar foto" | U `export`; E downloads | Concluído |
| F-35 [EST] | Compartilhar fotos | — | Web Share só no convite | — | Parcial |
| F-36 [EST] | Configurações do evento | OptionGroup, Stepper, Sheet | Painel > Configurações | U `setEndIn`; E encerrar/excluir | Concluído |
| F-37 [EST] | Perfil / sair / excluir conta | — | "Entrar como outra pessoa" (local) | E | Parcial (excluir conta = backend) |
| F-38 [EST] | Notificações locais | — | `notificationPlan` + `createLocalScheduler` | U (plano e agendador) | Parcial (só com app aberto) |
| — | Moderação (host) — *decisão de produto, não REA* | Tabs, CountBadge, PostCard | Painel > Conteúdo | E moderação | Concluído |
| — | Momentos, QR por mesa, aviso do cerimonial — *kit* | Chip, VisionTile, Notice, TableCard | Painel + Explorar | E | Concluído |
| — | PWA | — | `manifest.ts`, `sw.js`, ícones | E PWA | Concluído |
| — | Temas Dia/Noite | tokens | `lib/theme.tsx`, `tokens.css` | E tema; paridade | Concluído |
