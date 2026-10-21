# 01 — Auditoria técnica do APK

## Artefatos (originais preservados, somente leitura)
| Arquivo | Papel | SHA-256 |
|---|---|---|
| base.apk (50,4 MB) | código (3 dex), recursos, manifest | 03d58b0e11e3b4c05f4adf2ebf9eb03f4362530a5d011c824e56e7753201fa7f |
| split_config.arm64_v8a.apk | libs nativas (`libimage_processing_util_jni.so`, `libsurface_util_jni.so` — CameraX) | 7f568253…c4 |
| split_config.en.apk | `resources.arsc` do idioma en | 656ab7fe…09 |
| split_config.xxhdpi.apk | recursos de densidade (ícones de sistema/AppCompat) | 45ad6fe2…b3 |
Hashes completos: `analysis/apk-sha256.txt`. Ferramentas usadas: apktool 3.0.3, jadx (393 erros de decompilação parcial, esperados em Compose), aapt2, adb, OpenJDK. Decodificação em `.work/` (fora dos entregáveis, descartável).

## Identidade (EST)
`com.rafaelpcr.memo` · Application `App.MemoApplication` · Launcher `App.MainActivity` (singleTask, portrait) · Gradle 8.11.1 · Kotlin plugin 1.9.24 · compileSdk 36 · distribuído via Play Store (stamp `STAMP_TYPE_DISTRIBUTION_APK`, splits obrigatórios). Pacotes do app: App(5) Backend(34) Camera(8) Components(15) CreateEvent(31) Data(20) Domain(17) Gallery(33) Home(8) Navigation(4) Onboarding(12) State(2) Theme(7) — nomes **não ofuscados** (sem R8 rename nas classes do app), o que torna a análise de alta confiança.

## Manifest
| Item | Valor | Impacto |
|---|---|---|
| Permissões | INTERNET, CAMERA, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, BILLING, ACCESS_NETWORK_STATE, WRITE_EXTERNAL_STORAGE (≤API 28) | Web: câmera + notificações + rede; sem equivalente a boot |
| Features | camera, camera.any, screen.portrait | Layout portrait-first |
| Deep links | `https://appmemo.online/` + 8 chars (autoVerify); `memo://join` | Rotas web `/{code}` |
| Receiver | `Backend.NotificationReceiver` (BOOT_COMPLETED, exported) | Reagendar alarmes após reboot |
| Providers | FileProvider `…fileprovider`; androidx-startup (Supabase gotrue/storage initializers, EmojiCompat) | Compartilhamento de fotos |
| Backup | allowBackup=true + `data_extraction_rules` | Dados locais podem restaurar |
| Billing | Play Billing 8.0.0 | Sem equivalente web |

## Frameworks e dependências (EST)
Jetpack Compose + Material3, androidx Navigation Compose, CameraX (camera2), lifecycle/ViewModel, **supabase-kt** (gotrue, postgrest, storage), kotlinx.serialization, Ktor (cliente), **Credential Manager + Google Identity (googleid 1.1.1, play-services-auth 21.1.1)**, Play Billing 8.0.0, `multiplatform-settings` (`com.russhwolf.settings`), EmojiCompat, ZXing (`com.google.zxing`) para gerar QR (`Components/QrCode.kt`), Firebase datatransport (somente transporte de métricas do Play Services; sem Firebase Analytics/FCM identificado).
Nenhum Firebase Messaging, nenhum push remoto: **todas as notificações são locais** (INF — ausência de serviço FCM no manifest).

## Armazenamento e estado
| Mecanismo | Chave/arquivo | Conteúdo |
|---|---|---|
| JSON em arquivo interno | `events.json` (+ `.tmp`, `.corrupt-<ts>` em quarentena), `covers/`, fotos `<uuid>.jpg` | eventos, fotos, reações locais (`JsonFileEventRepository`) |
| SharedPreferences `memo.prefs` | onboarding, userName, purpose, sampleEventId, askedNotifications | `SharedPrefsOnboardingStore` |
| SharedPreferences `memo.pending_sync` | `memo.pendingEventIds/PhotoIds/ReactionIds` | fila de sincronização |
| Prefs de compra | `memo.processedPurchaseTokens`, `credit_<productId>` | créditos de eventos comprados (`PurchaseCredits`, consumo idempotente) |
| Sessão Supabase | `memo.supabase_session` (EncryptedSharedPreferences, fallback `.plain`) | tokens de sessão |
| MediaStore | `Pictures/Memo`, mime `image/jpeg`, `datetaken` | álbum exportado |

## Rede e integrações → ver `09-API-AND-INTEGRATIONS.md`
Host Supabase `kchnrknhoyypjocsiabq.supabase.co`; chave publicável (anon) embutida no cliente — **não reproduzida nesta documentação**; nenhuma chamada foi feita ao backend por esta análise.

## Serviços em segundo plano / notificações
AlarmManager (`com.rafaelpcr.memo.action.NOTIFY`) com tipos `LAST_CALL`, `ENDING_SOON`, `ENDED`, `REVEAL_SOON`, `REVEALED`; canal "Eventos"; notificação persistente `memo_live_events` ("Evento em andamento", rolo restante, capa, botão câmera). Sem WorkManager/Services próprios.

## Acessibilidade (EST/INF)
Compose padrão (semântica de botões, `contentDescription` apenas em ícones principais conforme árvore UI observada: textos e botões expostos com `text`; imagens decorativas sem descrição). Sem suporte landscape (portrait fixo). Nenhum modo de alto contraste dedicado; tema único escuro (EST: `darkColorScheme`).

## Tratamento de erros (EST)
Mapeamento de erros de auth (`mappedAuthError`: email já registrado, senha fraca/pwned, rate limit, credencial inválida, e-mail não confirmado), de convite (`codenotfound`, `eventended`, `eventfull`, `notauthenticated`), de upload (`shotlimitreached`, objeto ausente) e overlays "Não deu para criar o evento / Tentar novamente".

## Lacunas desta auditoria
Não foi feita análise de tráfego em runtime (exigiria sessão autenticada) e não houve acesso ao esquema do banco. Sem inspeção de R8/ProGuard para libs (offuscadas fora do app).
