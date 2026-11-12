# Base compartilhada do console Master (onda 1)

Tudo o que as ondas seguintes (Pessoas, Visão geral, Eventos, Pagamentos, Revelações e moderação, Saúde e auditoria, Impressões, Configurações) devem **reutilizar sem copiar**. API estável; mudou, atualize este arquivo.
Decisões e diferenças em relação ao desenho: `docs/evidence/revela-fiel/master/DIVERGENCIAS.md`.

## 1. Moldura, menu e acesso

| Peça | Onde | Notas |
|---|---|---|
| Menu e moldura | `web/src/revela/master-kit.tsx` (`MasterAside`, `MasterTop`, `MasterFrame`), ícones em `master-icons.tsx` | 13 itens na ordem do HTML: Visão geral, Eventos, Pessoas, Planos e preços, Pagamentos, Cortesias, Revelações, Moderação, **Impressões**, Storage e saúde, LGPD, Auditoria, Configurações. `MASTER_HREF[id]` tem a rota. `visible?: AppNavId[]` filtra os itens (o app passa a lista do papel). Rodapé padrão "Administrador · master". |
| Layout | `web/src/app/master/layout.tsx` + `MasterNav.tsx` | `local` → cartão M00 "indisponível"; sem sessão → M00 login; conta sem papel → M32 em moldura sem links; papel master/support/auditor → `MasterShell` com o menu do papel e "Impressões" só com a chave. |
| Papéis | `web/src/lib/master/access.ts` (`decideConsoleAccess` → `{access, role}`), `roles.ts` (`AREA_ROLES`, `canOpen`, `visibleNav`, `ROLE_MATRIX`, `ROLE_LABEL`, `whoCanOpen`), `server.ts` (`masterAccess()` → `{access, role, sb, user}`, `printedAlbumOn(sb)`) | A claim `app_metadata.role` e a RPC `current_platform_role()` têm de apontar o mesmo papel. |
| Guardas de página | `web/src/app/master/data.tsx` (reexporta `gate.tsx`) | `requireMaster()` (qualquer papel de equipe, senão 404) · `requireRole(area)` · `requirePrintedAlbum()` · `rpc<T>(sb, nome, args)` (traduz MM004 → `denied`) |

Padrão de página para **área restrita**:

```tsx
const gate = await requireRole("pagamentos");   // ou requirePrintedAlbum() em /master/impressoes e /master/impressoes/[id]
if ("denied" in gate) return gate.denied;        // support/auditor veem a M32; sem papel é 404
const { sb, role } = gate;
```

Áreas por papel (`AREA_ROLES`): master abre tudo; support e auditor abrem visao, eventos, pessoas, revelacoes, moderacao, saude, lgpd; só o auditor (além do master) abre auditoria; planos, pagamentos, cortesias, impressoes e configuracoes são só do master. As páginas de leitura que misturam RPCs de master (ex.: Visão geral chama `admin_payments_summary`) devem tratar `state: "denied"` por bloco, não derrubar a página para support/auditor.

Chave `printed_album`: `printed_album_enabled()` (SQL), `printedAlbumOn(sb)` (servidor, menu e rotas), `usePrintedAlbumEnabled()` em `features/print-orders/flag.ts` (host). A tela de Configurações liga/desliga com `admin_set_feature_flag('printed_album', …, motivo)`; sem linha = desligada.

## 2. Componentes (`web/src/revela/master/`, barrel `index.ts`)

Todos são client components com props, usam as classes do desenho (`.mstate`, `.msk`, `.mmodal`, `.mmodal-card`, `.diff`, `.kv`, `.otp`, `.countdown`, `.errline`) e têm `inline` (renderiza no lugar, sem portal; usado nas telas `/dev/revela` e nos testes). Por padrão a folha sobe para o `<body>` (`position: fixed`), serve no console e no painel do anfitrião; Esc fecha (menos ocupada); o foco entra no primeiro campo (ou no elemento com `data-autofocus`).

### MasterState / MasterStatePage
```tsx
<MasterState variant="empty" title="Nenhuma conta neste filtro" text="Troque o filtro ou limpe a busca." />
<MasterState variant="error" onRetry={…} />          // sem onRetry recarrega a página
<MasterState variant="denied" />                      // "Sem permissão para ver estes dados." + texto fixo
<MasterState variant="loading" cols={6} rows={8} label="Carregando" />   // esqueleto: larguras iguais às do desenho
<MasterStatePage area="Eventos" variant="denied" tabs={<Seg…/>} actions={<ExportButton…/>} caption="Todas as contas…" />
```
`MasterStatePage` = `MHead` + abas + estado. O título é **sempre o nome da ÁREA** ("Eventos", "Pessoas"…), nunca o do evento ou da pessoa; legenda "—" por padrão; `actions` só aparecem no vazio e no carregando (como no desenho). `cols` = nº de colunas da tabela da tela.

### ActionSheet (folha de ação com motivo)
```tsx
<ActionSheet title="Revogar o papel de support?" body="suporte@… perde o acesso ao console na hora."
  confirmLabel="Revogar papel" busyLabel="Revogando…" tone="danger"         // "primary" = botão cheio
  diff={{ from: { label: "Hoje", value: "15 min" }, to: { label: "Novo valor (5 a 1.440)", value: <campo/> } }}   // opcional (.diff)
  error={erroDoServidor}                                                    // linha vermelha acima dos botões
  onConfirm={async (motivo) => { … }}  onCancel={fechar} >
  {/* children: .kv, .mnote… entre o corpo e o Motivo */}
</ActionSheet>
```
Campo "Motivo" 10–500 caracteres (texto aparado), contador `N/500 · mínimo 10`, aviso "Fica registrado na auditoria com o seu nome." (`note`). O botão principal fica **desligado** até 10 caracteres e de novo acima de 500; `onConfirm` só recebe motivo válido. Extras: `ReasonField`, `ErrLine`, `useReasonField()`, `AUDIT_NOTE`. Constantes e tradução de erros de RPC em `lib/master/reason.ts` (`REASON_MIN/MAX`, `reasonError`, `adminErrorText`; `app/master/billing.ts` reexporta).

### ExportSheet (M24, M24-t)
```tsx
<ExportSheet kind="pagamentos" filters={{ f: "pix" }} screen="pagamentos" screenLabel="Pagamentos"
  period="01 nov 2026 a 11 nov 2026" filtersText="Método: Pix · Situação: todas" rowsEstimate={74} onClose={…} onDone={(r) => …} />
```
Mostra tela, período, filtros, formato, linhas estimadas; acima de 50.000 estimadas avisa o truncamento e o botão vira "Exportar 50.000 linhas"; aviso de auditoria. Usa `exportCsv` (`lib/master/export-csv.ts`) → RPC `admin_export_csv` (que grava a auditoria; só master e auditor). `filters` é o que a RPC aceita (`dias`, `f`, `q`, `aba`, `a`, `status`). Hook: `useExport({kind, filters, screen, onDone, run?})` → `{busy, error, start}`. O `ExportButton` atual (`app/master/ExportButton.tsx`) deve virar um botão que abre esta folha. `rowsEstimate`: passe o total que a tela já tem.

### RevealNowSheet (M25, M25-a/b/c)
```tsx
<RevealNowSheet eventId={id} eventTitle="Ana & Leo" plannedAt="dom, 15 mar 2027 12:00" notices="21 e-mails, de uma vez" onClose={…} onDone={() => router.refresh()} />
```
RPC `reveal_now` (anfitrião do evento ou master). Botão principal em destaque "Manter a hora" (fecha, é o foco inicial); "Revelar mesmo assim" só liga com motivo válido. Mensagens do servidor como estão: "Este evento já foi revelado." (MM008), "Evento sem revelação ligada." (MM005), "Sem permissão" (MM004). `send?(eventId, motivo) → {ok} | {ok:false, failure}` troca o envio (o painel do anfitrião no modo local usa o repositório). `plannedWhen(iso)` (`app/master/format.ts`) formata a hora prevista. **Já substituídas**: `app/master/revelacoes/RevealNow.tsx` (M08) e a folha do painel `app/painel/[id]/conteudo` (17c). A onda de Eventos usa a mesma no detalhe do evento (M21). Hook: `useRevealNow`.

### ReconcileSheet (M23, M23-r, M23-w)
```tsx
const rec = useReconcile({ last: "hoje 08:51, por marcos@revela.app", onDone: () => router.refresh() });
<button onClick={() => void rec.start()}>Conciliar agora</button>
{rec.state && <ReconcileSheet state={rec.state} onSubmitCode={(c) => void rec.submitCode(c)} onClose={rec.close} />}
```
`start()` pula o código se a sessão já é aal2; senão pede os 6 números do autenticador (TOTP do Supabase), depois chama `payments-reconcile-now` (→ `admin_request_reconcile`: só master, aal2, 1 por minuto). Estados: `code` (com erro "Código incorreto…"), `running`, `result` (conciliados/falhas/"Sem mudança", "Próxima conciliação manual liberada em 00:57"), `wait` (MM006: contagem regressiva a cada segundo a partir de 60 s), `error`. Injeções para teste: `hasSecondFactor`, `verifyCode`, `reconcile`, `now`. **Pendência de backend (onda de Pagamentos)**: estender `payments-reconcile-now` para devolver `unchanged` e `failures[]` (hoje só `confirmed`, `failed`, `unattached`); `ReconcileResult` já aceita.

### MasterSemAcesso / MasterAcessoLimitado (M32)
`screens/MasterSemAcesso.tsx`: `MasterSemAcessoView` (props `caption`, `title`, `text`, `emailExample`, `rows`), `MasterSemAcesso` (fixture com moldura), `MasterAcessoLimitado({ role, caption })` (conteúdo do app com a matriz real).

## 3. Banco (migration `20261111000100_printed_album_flag.sql`, aditiva)

- `current_platform_role()` → `'master' | 'support' | 'auditor' | null` (claim + linha ativa); `authenticated`.
- `printed_album_enabled()` → boolean; `authenticated`; sem linha em `feature_flags` = false.
- `create_or_replace`: `create_print_order` (recusa MM004 com a chave desligada), `admin_list_audit`, `admin_list_audit_v2`, `admin_export_csv` (agora só master e auditor).
- pgTAP: `32_printed_album_flag`, `32_master_roles` (papéis, e-mail mascarado no servidor, o que cada papel chama); `31_print_orders` e `31_admin_export_csv` ajustados.
- Redireções permanentes (308) em `next.config.ts`: `/master/usuarios` → `/master/pessoas?aba=contas`, `/master/organizadores` → `?aba=organizadores`, `/master/participantes` → `?aba=convidados`, `/master/storage` → `/master/saude`, `/master/analytics` → `/master`.

## 4. Testes que já existem (rode antes de mexer)

`src/revela/master/*.test.tsx` (estados, folha de ação, exportar, revelar, conciliar, **fidelity.test.tsx** compara o DOM de cada folha/estado com o HTML de referência), `src/lib/master/access.test.ts` (papel × rota), `src/app/master/gate.test.tsx` (`requireRole`, 404 sem a chave), `src/lib/master/redirects.test.ts`, `src/features/print-orders/flag.test.ts`. Banco: veja `docs/handoff/pg-shim.sql` e o roteiro de `tmbase` no prompt da onda 1.

## 5. Como o restante deve usar

1. Estados: toda tela principal troca seus 4 `*--vazio|erro|sem-permissao|carregando` por `MasterStatePage` / `MasterState`.
2. Folhas com motivo (revogar, conceder, esconder, cancelar, ligar/desligar): `ActionSheet`; a regra de motivo vale também no servidor (MM011).
3. Exportar: `ExportSheet` em todas as listas; Revelar agora: `RevealNowSheet`; Conciliar: `ReconcileSheet`.
4. Páginas novas começam por `requireRole(area)` (ou `requirePrintedAlbum()`), nunca por checagem de papel própria.
