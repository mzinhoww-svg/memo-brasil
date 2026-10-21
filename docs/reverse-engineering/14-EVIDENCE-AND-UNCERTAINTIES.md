# 14 — Evidências e incertezas

## Chaves de evidência
| Chave | Fonte |
|---|---|
| E-01 | `screenshots/001-launch.png` + `analysis/ui/001-launch.xml` (UI dump) |
| E-S1..3 | `screenshots/002…004` + `analysis/ui/*.xml` |
| E-S5 | `005-email-sheet.png`, `007-code-sheet.png` |
| E-02 | `AndroidManifest.xml` (deep links, permissões) |
| E-03 | `App/LaunchScreen*.java` |
| E-04 | `Backend/AuthService.java`, `Onboarding/EmailAuthSheet*.java` |
| E-05 | `Backend/AuthService.java` (Google, anônima) |
| E-06 | `Backend/MemoBackend.java` (`rpc/join_event`, `rpc/resolve_event_by_code`) |
| E-07 | `Domain/ShareCode.java` |
| E-08 | `CreateEvent/CreateStep.java`, `CreateEventFlow*.java` |
| E-09 | `Backend/EventSync.java` (covers/) |
| E-10 | `Backend/MemoPricing.java`, `BillingManager.java`, `PurchaseCredits.java`, `PricingScreen*.java`, `MemoPlusPaywall*.java` |
| E-11 | `Domain/MemoPurpose.java` |
| E-12 | `CreateEvent/EventDraft.java` |
| E-13 | `Domain/{CameraStyle,RevealTiming,GuestCapacity,ShotsPerPerson}.java`, `Backend/EventRow.java` |
| E-14 | `Camera/PhotoStyleFilter.java` |
| E-15 | `Backend/PhotoSync.java`, `Camera/CameraViewModel.java` |
| E-16 | `Data/PendingSyncCoordinator.java`, `SharedPrefsPendingSyncStore.java` |
| E-17 | `Backend/ReactionSync.java`, `Domain/ReactionEmoji.java` |
| E-18 | `Backend/EventNotificationManager.java`, `EventLiveNotificationManager.java`, `NotificationReceiver.java` |
| E-S | `analysis/screen-strings.txt` (strings por tela) |
Artefatos: `analysis/apk-sha256.txt`; `analysis/ui/*.xml`; `analysis/cap-adb-capture.sh` (script de captura).

## Observado × inferido × hipótese
| Item | Tipo |
|---|---|
| Slides, Welcome, folhas e-mail/código (textos, layout, botões) | **OBS** |
| Regras de evento, enums, preços, SKUs, rotas, RPCs, tabelas, notificações | **EST** (código) |
| Tipos SQL, RLS, UNIQUE de `share_code`, validação do nome | **INF** |
| Flash, pinça de zoom, validação servidor de compras, destino de `OnboardingTracking` | **HIP / desconhecido** |

## Bloqueios e limitações
1. **Autenticação:** as telas S-08…S-29 exigem login Google ou criação de sessão/evento no **backend real de terceiros**. Pela regra "não acessar dados de terceiros / não contornar autenticação / não executar ações destrutivas sobre dados reais", não foram percorridas. Estados vazio/preenchido/loading/erro dessas telas foram **reconstruídos de strings e código**, não vistos.
2. **Orientação/teclado:** app é portrait fixo; teclado não foi exercitado além da abertura das folhas (campos e-mail/código visíveis).
3. **Permissões em runtime** (câmera, notificações) não concedidas/testadas.
4. **Esquema do banco, RLS, funções SQL e política de storage** são invisíveis ao cliente.
5. Decompilação com 393 erros (esperado em Compose/inline); lógica complexa de UI (animações, cálculos de layout) não foi lida linha a linha.
6. Medidas em dp só onde há literais (tokens); resto estimado.
7. Possível divergência de versão: analisado v2.1.10 (versionCode 6); instalado no emulador = mesma versão (OBS `dumpsys`).
8. Cobertura: **não declaramos 100%**. Estimativa de cobertura funcional ≈ 85% por inventário de código; ≈ 20% por observação visual.

## Para fechar lacunas (requer decisão/autorização do usuário)
Fornecer uma conta de teste + evento descartável criado pelo próprio usuário (ou backend de staging) para percorrer S-08…S-29 e capturar screenshots/tráfego; ou autorizar login com conta Google do próprio usuário no emulador.
