# 05 — Mapa de navegação

Fonte: `Navigation/Routes.kt`, `MemoNavGraph.kt`, `MainActivity` (EST). Navegação Compose single-activity; wizard de criação é um único destino (`createEvent`) com estado interno `CreateStep`.

```mermaid
flowchart TD
  L[loading] -->|primeira vez| I[introSlides x3]
  L -->|onboarding concluído| H[home]
  I --> W[welcomeAuth]
  W -->|Google| N[nameEntry]
  W -->|e-mail (indisponível)| W
  W -->|código (convidado, sessão anônima)| J[Entrar no evento]
  N --> P[purpose] --> H
  H -->|Novo evento| C[createEvent]
  H -->|Abrir câmera| CAM[camera/eventId]
  H -->|álbum| G[gallery/eventId]
  H -->|código| JS[JoinWithCodeSheet] --> G
  H -->|perfil| PS[ProfileSheet]
  C --> CR[EventCreated] --> CAM
  C --> PW[MemoPlusPaywall]
  CAM <--> G
  G --> V[PhotoViewer] --> E[PhotoEditor]
  G --> S[EventSettings]
  G --> IV[InviteSheet]
  DL[deep link appmemo.online/CODE ou memo://join] --> J --> CAM
```

## Sitemap
- `/` loading → decide
- `/intro` (3 slides) · `/welcome` · `/name` · `/purpose`
- `/home` (abas **Filmes** | Scrapbook[placeholder])
- `/create/{notifications|name|category|end-date|reveal|camera-style|invitation|capacity|pricing|created}`
- `/camera/:eventId` · `/gallery/:eventId` (+ overlays `photo/:photoId`, `settings`, `invite`, `editor`)
- `/join/:code` (equivalente web do deep link `https://appmemo.online/<8 chars>`)

## Regras de navegação
- Back no wizard retrocede passo (`StepFooter` "Voltar"); no overlay do visualizador fecha o overlay.
- Entrar por deep link com sessão ausente cria sessão anônima, depois navega ao evento ("Continuar sem entrar no evento" se falhar).
- Sair da conta limpa onboarding e volta ao início do fluxo.
- Orientação: fixa em retrato (OBS manifest) → web deve aceitar retrato como principal.
