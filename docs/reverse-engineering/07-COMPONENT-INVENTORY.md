# 07 — Inventário de componentes

Nomes reais dos composables (EST). Mapeamento sugerido para React/Tailwind na coluna final.

| Componente (Kotlin) | Arquivo | Função | Variantes/estados | Equivalente web |
|---|---|---|---|---|
| `WordmarkLogo`, `HandPhoneMark` | BrandMark | logotipo | cor | SVG próprio (não copiar marca) |
| `NextPillButton`, `SecondaryButton`, `SocialSignInButton` | Buttons/IntroSlides | botões pílula | LIGHT/DARK, loading | `<Button variant>` |
| campos de texto (composables em `TextFields.kt`; nome exato não extraído) | TextFields | campos | vazio/erro | `<Input>` |
| `StepHeader`, `StepFooter` | StepChrome | cabeçalho (título/subtítulo) e rodapé Voltar/Próximo do wizard | desabilitado | `<StepLayout>` |
| `MemoBottomSheet` | MemoBottomSheet | folha modal inferior | — | `<Sheet>` (vaul/Radix) |
| `PageDotsIndicator` | PageDotsIndicator | indicador de slides | ativo | `<Dots>` |
| `ManualGrid` | ManualGrid | grade por colunas | — | CSS grid |
| `EventCoverImage` | EventCoverImage | capa (recurso, `custom:` arquivo local, URL remota) | placeholder | `<EventCover>` |
| `PhotoBitmap` | PhotoBitmap | carrega foto com cache por `lastModified` | — | `<img>` + cache |
| `QrCode` | QrCode | QR (ZXing) | tamanho | `qrcode` lib |
| `InviteSheet` | InviteSheet | convite: QR, código, compartilhar | copiado | `<InviteSheet>` |
| `ProfileSheet`, `NameEditorSheet`, `SignOutConfirmSheet` | ProfileSheet | perfil e confirmações | — | sheets |
| `HomeScreen` (`ActiveEventHero`, `CreateEventHero`, `HeroPage`, `AlbumsSection`, `AlbumRow`, `AlbumPhotoTile`, `HomeEmptyState`) | Home | home | vazio/ativo | seções |
| `MainTabBar` (`TabLabel`) | MainTabBar | abas FILMES/SCRAPBOOK | selecionada | `<Tabs>` |
| `JoinWithCodeSheet` | JoinWithCodeSheet | entrada por código | loading/erro | sheet |
| `PhotoFan`, `FanCard`, `StyleSwatch` | EventCameraStyle | escolha de estilo | selecionado | carrossel |
| `DayCell` | EventEndDate | célula de calendário | passado/selecionado | `<Calendar>` |
| `TimingCard`, `BlurredPreviewCard`, `DelayDaysStepper`, `StepperButton` | EventRevealTiming | opções de revelação | selecionado | cards + stepper |
| `ParticipantSquares`, `ShotsChip`, `ShotsDialPreview` | EventGuestCapacity | capacidade e fotos/pessoa | selecionado | chips |
| `InvitationCard`, `GuestInvitePreviewContent`, `TrocarCapaButton`, `PreVisualizarButton` | EventInvitation | convite | — | cards |
| `PriceCard`, `PriceRow`, `SummaryCard`, `PlusUpsellCard`, `Chip` | Pricing | preço | destacado | cards |
| `PlanPicker`, `PlanCard`, `BenefitsCard`, `BenefitRow` | MemoPlusPaywall | paywall | selecionado/badge | cards |
| `NotificationPhoneMockup` | NotificationsPermission | ilustração | — | imagem/CSS |
| `EventCreationLoadingOverlay`, `EventCreationErrorOverlay` | CreateEventFlow | overlays | — | modais |
| `CameraHeader`, `FilmDial`, `ZoomRow/ZoomChip`, `BottomRow`, `GalleryThumbnail`, `CameraNotice`, `PermissionPlaceholder` | CameraScreen | câmera | permissão/erro | componentes de câmera |
| `CoverHeader`, `StatsRow/StatCell/StatDivider`, `ActionRow`, `PhotoTile`, `EmptyGallery`, `SampleInfoBox`, `ToastOverlay`, `AlbumExportProgressRow` | GalleryScreen | galeria | vazio/exemplo | componentes |
| `ViewerTopBar`, `ViewerActionBar`, `ViewerBarButton`, `ViewerIconButton`, `Filmstrip`, `ReactionFloatingBar`, `ReactionSummaryRow`, `WhoReactedSheet` | PhotoViewerOverlay | visualizador | — | overlay |
| `EditorTopBar`, `EditorToolbar`, `ModeChip`, `HistoryButton`, `TextOverlay`, `CollagePickerSheet`, `CollagePhotoCell` | PhotoEditor | editor | modo ativo | canvas |
| `SettingsRow`, `SelectableRow`, `ToggleRow`, `OptionsDialog`, `EndDateEditorDialog`, `NameCoverEditorSheet`, `CoverPickerGrid`, `GalleryCoverTile`, `GenericCoverTile`, `DeleteButton`, `DeleteConfirmSheet` | EventSettings | configurações | — | formulários |

## Matriz de interações (resumo)
| Gesto | Onde | Efeito |
|---|---|---|
| Toque | botões/chips/tiles | ação/seleção |
| Arrastar | texto no editor, desenho | posiciona/desenha |
| Pinça/zoom | câmera? | **não confirmado** (apenas chips 1×/2×) |
| Rolagem vertical | home, galeria, configurações | scroll |
| Swipe horizontal | visualizador/filmstrip, hero da home (`HeroPage`) | navega |
| Long-press | — | sem evidência |
