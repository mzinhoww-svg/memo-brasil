# 00 — Sumário executivo

**Alvo:** Memo – Capture momentos (`com.rafaelpcr.memo`, v2.1.10, versionCode 6, minSdk 26, targetSdk 36).
**Escopo desta etapa:** engenharia reversa e documentação. Nenhuma reconstrução foi iniciada.
**Convenção de confiança:** `OBS` = observado no emulador · `EST` = evidência estática (manifest/código decompilado) · `INF` = inferência técnica · `HIP` = hipótese. Ver `14-EVIDENCE-AND-UNCERTAINTIES.md`.

## O que o app é (EST + OBS)
Uma "câmera descartável" colaborativa para eventos. O anfitrião cria um evento (casamento, aniversário, viagem…), define quando ele termina, quantas fotos cada convidado pode tirar e quando as fotos são reveladas. Convidados entram por **código de 8 caracteres, link `https://appmemo.online/<8 chars>` ou `memo://join`**, tiram fotos pela câmera do app (sem ver o resultado durante o evento) e, após a revelação, todos veem o álbum, reagem com emoji, editam (desenho, texto, colagem) e salvam na galeria.

## Arquitetura encontrada (EST)
- Android nativo, **Kotlin 1.9.24 + Jetpack Compose (Material 3)**, navegação Compose, CameraX, single-Activity (`MainActivity`, portrait).
- **Backend: Supabase** (supabase-kt: Auth/GoTrue, Postgrest, Storage; bucket `event-photos`) + RPCs `join_event`, `resolve_event_by_code`, `delete_account`.
- **Offline-first parcial:** repositório JSON local (`events.json`, fotos `.jpg`) + fila de sincronização pendente (SharedPreferences) + `RemotePullThrottle`.
- **Monetização:** Google Play Billing 8.0.0 — compra única por evento (por faixa de convidados) e assinatura **Memo+** (mensal/anual).
- **Login:** Google (Credential Manager) funcional; e-mail/senha existe na UI mas exibe "Ainda não disponível nesta versão" (EST); sessão anônima disponível para convidado por código.
- Notificações locais (AlarmManager + boot receiver) e notificação "ao vivo" persistente durante o evento.

## Funcionalidades confirmadas
Ver `02-FEATURE-INVENTORY.md` (38 funcionalidades; F-01…F-38). Resumo: onboarding (3 slides, auth, nome, propósito), criar evento (9 passos), entrar por código/link/QR, câmera com rolo limitado e 3 estilos, galeria com revelação programada, visualizador com reações, editor de foto, exportar álbum, configurações do evento, perfil/sair/excluir conta, paywall Memo+, notificações.

## Telas identificadas
~24 telas/folhas (ver `03`). **Observadas no emulador: 7** (3 slides, boas-vindas/auth, folha e-mail, folha código). O restante foi reconstruído **por análise estática** porque exige login real.

## Principais descobertas
1. O produto é fortemente **temporal**: fim do evento = `createdAt + durationHours·3600000 ms`; revelação em 3 modos (durante / ao terminar / terminar + N dias).
2. Regra de preço: **≤10 convidados grátis**; acima disso pagamento único por evento (SKUs `…event.guests{20,50,100,150,200,unlimited}`) **ou** Memo+ (até 200 convidados, fotos ilimitadas). Preços de fallback: R$ 59,90/mês, R$ 449,90/ano.
3. Reações: uma por usuário por foto (`upsert on_conflict photo_id,author_id`); 4 emojis.
4. Limite de fotos por pessoa é **imposto no servidor** (erro `shotlimitreached` → foto removida do rolo local).
5. Fotos têm câmera estilizada (ORIGINAL, VINTAGE, BLACK_WHITE) — filtro aplicado no cliente (`PhotoStyleFilter`); "fotos originais são salvas por padrão".
6. Aba **SCRAPBOOK** é placeholder ("chega em breve").

## Lacunas principais
- Fluxos pós-login não puderam ser percorridos sem criar conta/evento no backend real (bloqueio deliberado: regra de não acessar dados de terceiros nem criar dados em produção). Detalhe em `14`.
- Esquema SQL, políticas RLS e lógica das RPCs **não são visíveis** no cliente.
- Medidas de layout em dp exatas só onde constam no código; o restante é estimativa.

## Riscos
Dependência de backend (Supabase) a ser recriado; Play Billing não existe na web (precisa gateway); câmera/compartilhamento/notificações agendadas têm limitações em PWA (ver `10`); ativos visuais e marca são protegidos — não reutilizar.

## Prontidão para implementação
**Moderada–alta (≈70%)** para o núcleo (modelo de dados, regras de evento, câmera, galeria, reações, convite) e **baixa** para pagamentos e UI pixel-exata de telas não observadas. Ver `15-RECONSTRUCTION-READINESS.md`. Não declaramos cobertura de 100%.
