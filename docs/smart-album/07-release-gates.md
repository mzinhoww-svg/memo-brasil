# 07 · Gates de liberação e GO/NO-GO

Legenda: ✅ comprovado nesta entrega (evidência em `05-test-evidence.md`) · ⏳ pendente · ❌ bloqueado.

## Gate A — Álbum pessoal (`smart_album_ui`), sem biometria

| Critério | Status | Evidência / responsável |
|---|---|---|
| Aba Minhas Fotos sem regressão na barra/câmera | ✅ | `guest-tab.test.tsx`, `host-nav.test.tsx`, E2E smart-album 1/5, suíte E2E completa |
| Onboarding opcional com Google/galeria/câmera | ✅ (Google só validado por unit/allowlist; download real do Google **não** testado) | E2E 2/5, unit `reference` |
| Fotos que tirei + favoritas independentes do motor | ✅ | E2E 2, pgTAP 39 |
| Nada antes da revelação; isolamento evento/usuário | ✅ | pgTAP 39, E2E 4 |
| Migration aditiva + rollback testado | ✅ | pgTAP 2187 testes / 0 falhas; rollback e reaplicação no local |
| Testes em iPhone Safari/PWA e Android Chrome físicos | ⏳ | operador |
| Integração do adaptador nuvem contra Supabase real (Auth+PostgREST+Storage) | ⏳ | só o banco foi testado (pgTAP); adaptador por unit com RPC simulada |
| CI verde no PR | ⏳ | GitHub Actions |
| SHA vivo de produção confirmado e branch mesclada sobre ele | ⏳ | operador (Vercel) |
| Aceite do dono (UX, inclusive rótulo "Minhas" × "Minhas Fotos") | ⏳ | dono |

**Classificação Gate A: GO condicionado para homologação** (aplicar a migration e publicar com a chave desligada; ligar só em evento de laboratório). **NO-GO para ligar a todos** até os ⏳ acima.

## Gate B — Busca facial (`smart_album_face_matching`)

| Critério | Status |
|---|---|
| RIPD/parecer jurídico formal aprovado | ❌ inexistente |
| Hipótese legal para rostos de terceiros nas fotos | ❌ em aberto (bloqueante) |
| Texto final do consentimento aprovado e publicado | ❌ só rascunho |
| Critério para menores/eventos elegíveis | ❌ |
| Retenção (inclui backups) aprovada | ❌ proposta apenas |
| Motor com licença comercial de software **e pesos**, DPA, região | ❌ não escolhido |
| Benchmark de precisão/recall/FPR/viés/custo/latência | ❌ não executado |
| Pentest direcionado (IDOR, SSRF, upload malicioso, abuso de inferência) | ⏳ revisão de código e testes automatizados feitos; pentest não |
| Worker agendado e observado em pré-produção com imagens consentidas | ❌ |
| Infra: consentimento, referência privada, jobs, gates, revogação, purga, kill switch | ✅ (pgTAP 39, unit do worker) |

**Classificação Gate B: NO-GO.** A infraestrutura está pronta e desligada; nenhuma condição jurídica, de modelo ou de benchmark foi satisfeita. Não ligar sem todos os itens ❌ resolvidos e registrados por responsável.

## Responsáveis a nomear
- Jurídico/encarregado (DPO): itens jurídicos do Gate B e registro em `smart_album.legal_gate`.
- Dono do produto: aceite de UX, allowlist de eventos.
- Operador: SHA vivo, migration, publicação, testes físicos, agendamentos.
