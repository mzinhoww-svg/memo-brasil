# 09 — APIs e integrações

Nenhuma chamada foi feita ao backend por esta análise. Tudo abaixo é EST (código decompilado). A chave "publishable" do Supabase está embutida no APK (é pública por desenho, protegida por RLS) e **não é reproduzida aqui**; o projeto de reconstrução deve usar **seu próprio** projeto Supabase.

## Supabase (supabase-kt)
Host do app original: `https://kchnrknhoyypjocsiabq.supabase.co` (não usar). Sessão em `memo.supabase_session`.

### Auth
| Operação | Evidência | Notas |
|---|---|---|
| Login Google | `signInWithGoogle` → Credential Manager → ID token | cria `profiles` |
| Sessão anônima | `signInAnonymously` ("Sessão anônima não retornou usuário.") | convidados por código |
| E-mail/senha | `signInWithEmail`, `signUpWith` | UI diz "indisponível nesta versão" |
| Restaurar/garantir sessão | `restoreSession`, `ensureSession` | |
| Sair | `signOut` | limpa onboarding |
| Excluir conta | `POST rpc/delete_account` | |
Erros mapeados: e-mail já registrado, senha fraca/pwned/"password should be", rate limit, `invalid_grant`, "email not confirmed", "invalid login credentials", "invalid email".

### RPCs
| RPC | Params | Retorno/erros |
|---|---|---|
| `resolve_event_by_code` | `{code}` | evento (prévia p/ convite); `codenotfound` |
| `join_event` | `{code, guest_name}` | participa; `eventended`, `eventfull`, `notauthenticated` |
| `delete_account` | — | apaga dados do usuário |

### Tabelas (Postgrest)
`events` (create/select/update/delete), `participants` (select), `photos` (select por `event_id`, insert, delete), `reactions` (select por `event_id`, upsert `on_conflict=photo_id,author_id`, delete), `profiles` (colunas `name`). Erros de limite de fotos: mensagem contém `shotlimitreached`.

### Storage
Bucket `event-photos`: upload/download/remove de fotos (`storage_path`), capas em `covers/`; operações `upload`, `download`, `downloadCover`, remoção em lote (`paths`).

## Google
- Credential Manager + Google ID (googleid 1.1.1), play-services-auth 21.1.1 — requer OAuth client ID próprio na web (Google Identity Services).

## Google Play Billing 8.0.0
Produtos:
- Assinaturas: `memo.plus` (mensal, fallback **R$ 59,90**), `memo.plus.annual` (anual, fallback **R$ 449,90**; ≈ R$ 37,49/mês).
- Compras únicas (por evento): `com.rafaelpcr.memo.event.guests{20,50,100,150,200,unlimited}`; `freeGuestLimit = 10`.
- Créditos locais por SKU (`credit_<sku>`) consumidos ao criar; tokens processados registrados para idempotência. **Validação no servidor não identificada** (risco; HIP: verificação feita apenas no cliente).
Web: substituir por gateway (ex.: Stripe/Mercado Pago/Pix) — decisão futura.

## Links e domínios
`https://appmemo.online/<8 chars>` (App Links verificados), esquema `memo://join`. Termos de Uso e Política de Privacidade referenciados na tela de auth (URLs não extraídas).

## Outros
Firebase datatransport (infra do Play Services, sem Analytics/FCM); sem SDK de analytics de terceiros identificado (`OnboardingTracking` é interno — destino não confirmado, HIP: apenas log local).

## Interfaces desacopladas propostas para a web (ver `10` e `12`)
```ts
interface AuthService { signInGoogle(); signInAnonymously(); signOut(); deleteAccount(); current(): Session|null }
interface EventRepository { list(); create(draft); update(id,patch); remove(id); resolveByCode(code); join(code,name) }
interface PhotoService { list(eventId); upload(eventId,blob); remove(id); download(id) }
interface ReactionService { list(eventId); set(photoId,emoji); clear(photoId) }
interface BillingService { products(); purchaseEvent(capacity); subscribe(plan); restore() }
interface NotificationScheduler { schedule(event); cancel(eventId) }
```
Implementações temporárias: `Local*` (IndexedDB/localStorage) → `Supabase*` na etapa posterior.
