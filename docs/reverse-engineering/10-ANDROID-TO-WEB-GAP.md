# 10 — Lacunas Android → Web (PWA)

| Recurso Android | Equivalente web | Gap / risco | Decisão proposta |
|---|---|---|---|
| CameraX (captura, 1×/2×, inverter) | `getUserMedia` + `<video>`/canvas; `ImageCapture`/`MediaStreamTrackProcessor`; zoom via `track.applyConstraints({zoom})` quando suportado | Zoom 2× nem sempre suportado (iOS Safari); qualidade/resolução menor; precisa HTTPS e gesto do usuário | Captura em canvas, zoom digital fallback (crop) |
| Estilos VINTAGE / B&W (bitmap) | Canvas 2D / CSS filters / WebGL | Paridade visual aproximada | Implementar filtro em canvas antes do upload |
| Permissão de câmera (pedir de novo / abrir configurações) | Permissions API + instruções | Navegador não abre config do site | Mensagem guiada |
| Notificações locais agendadas (AlarmManager, boot) | Notifications API + Service Worker; Notification Triggers **não padronizado**; Web Push (VAPID) exige backend | Sem alarme exato offline; iOS só em PWA instalada (≥16.4) | Push via backend (Supabase Edge Function + cron) na etapa 2; antes disso, notificação in-app ao abrir |
| Notificação "ao vivo" persistente | — | Sem equivalente | Banner fixo na Home |
| Armazenamento JSON/arquivos internos | IndexedDB (fotos como Blob) | Cotas variam; evicção no Safari | IndexedDB + `navigator.storage.persist()` |
| SharedPreferences | localStorage / IndexedDB | — | wrapper tipado |
| EncryptedSharedPreferences (sessão) | Cookies httpOnly / storage do Supabase | Sem cofre nativo | Supabase JS padrão |
| MediaStore (`Pictures/Memo`) | download de arquivo / `showSaveFilePicker` / Web Share com arquivos | Sem acesso à galeria; iOS salva via "Compartilhar → Salvar imagem" | ZIP/individual + Web Share API (files) |
| Share intent (texto/imagens) | Web Share API (`navigator.share`) + fallback copiar | Desktop sem share | fallback copiar/WhatsApp link |
| Deep link `appmemo.online/<code>` + `memo://join` | Rota `/<code>` ou `/join/<code>` | Sem App Links; domínio próprio necessário | Rota dinâmica + manifest `scope` |
| Google Sign-In (Credential Manager) | Google Identity Services / Supabase OAuth | precisa client ID | Supabase `signInWithOAuth` |
| Sessão anônima | Supabase `signInAnonymously` | habilitar no projeto | idem |
| Play Billing (compra única + assinatura) | Gateway (Stripe/Pix etc.) | **Maior gap**; regras/preços de loja diferentes | Interface `BillingService`; stub local "pago" na fase 1 |
| Boot receiver | — | n/a | omitir |
| QR (ZXing) | lib `qrcode` | — | ok |
| Editor (desenho/texto/colagem) | Canvas 2D (pointer events) | Esforço médio | implementar canvas próprio |
| Portrait fixo | CSS + `manifest.orientation: portrait` | desktop | centralizar coluna ≤480px |
| Backup Android (allowBackup) | — | n/a | omitir |

## PWA
`manifest.webmanifest` (name "Memo", display standalone, theme `#0B0B0C`, ícones próprios — **não copiar ícone original**), service worker (cache de shell + fotos do evento), fila de sincronização offline via IndexedDB (equivalente a `PendingSyncCoordinator`).

## Backend dependente
Auth, RPCs, Storage, RLS, push, validação de compra → recriar no Supabase (etapa posterior). Fase 1 usa implementações locais.
