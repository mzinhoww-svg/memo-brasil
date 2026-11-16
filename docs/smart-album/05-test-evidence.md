# 05 · Evidências de testes

Ambiente: container da sessão (Linux), Node 24, Supabase local via `npx supabase@3.0.0 db start` (Docker, Postgres + pgTAP), Chromium pré-instalado (1243) usado via `executablePath` porque o Playwright do projeto (1.64.1) espera o build 1248. **Nada rodou contra produção nem contra projeto Supabase remoto.**

## 1. Banco (pgTAP) — `node scripts/test-db.mjs`
| Rodada | Resultado |
|---|---|
| Linha de base na `main` (`758e7ee`), antes de qualquer mudança | 2083/2085 — 2 falhas pré-existentes em `02_v2_studio_admin` (esperava 6 jobs `mm-*`, há 7 desde `20261024000100`) |
| Depois da migration + correção da expectativa do teste 02 + correções da revisão | **2202/2202 PASS** (`Files=35, Tests=2202`) |
| `39_smart_album.test.sql` isolado | **117/117 PASS** |
| Rollback (`supabase/ops/rollback_smart_album.sql`) | executado no local: 0 funções/tabelas/políticas restantes; reaplicação da migration ok; 39 passa de novo |

O que o pgTAP 39 cobre: chaves desligadas por padrão; cliente sem acesso às tabelas `face_*` e às funções do worker; anon sem RPC; álbum pessoal preso a `can_see_photo` (outro evento, `everyone_sees_all=false`, inexistente = proibida, antes da revelação, foto removida sai na hora); isolamento entre convidados; cada gate sozinho não liga a busca (chave, allowlist, gate jurídico, versão aprovada); versão não aprovada, sem titularidade, sessão anônima e evento alheio recusados; append-only do consentimento; auditoria invisível ao anfitrião e sem poluição; Storage (outro usuário, caminho errado, leitura, reenvio); antes da revelação sem job/resultado; idempotência; worker recebe só fotos elegíveis e o banco descarta as demais; resultado sem score; moderação tira do resultado; ocultar não volta em nova busca; retry e código de erro sem texto livre; bloqueio; expiração; referência rejeitada purgada; kill switch; revogação idempotente com purga enfileirada; cascata do evento enfileira a referência; saída do evento apaga os dados.

## 2. Unitários (vitest)
| Suíte | Resultado |
|---|---|
| `npm test` (web), antes da correção do `GuestTabs` | 1486/1489 — **3 falhas causadas por esta entrega** (`host-nav.test.tsx`: a aba nova chamava `useApp()` fora do provider). Corrigido (hook passou a usar `backendMode()`). |
| `src/revela` + `src/features/smart-album` depois da correção | 246/246 |
| `src/features/smart-album` (20 + 3 novos) | 23/23 |
| Funções `vitest.functions.config.ts` | **206/206** (16 novos do worker/motor) |
| `npm run typecheck` | limpo |
| `npm run lint` | 0 erros (avisos pré-existentes e `<img>` nas telas novas) |

## 3. E2E (Playwright, modo local, build com `NEXT_PUBLIC_MM_DEV_TOOLS=1`)
`e2e/smart-album.spec.ts` — **10/10** com `--repeat-each 2`:
1. chave desligada: sem aba; rota direta informa indisponível;
2. álbum manual: onboarding, Google indisponível, arquivo pequeno e "SVG com nome .jpg" recusados, revisão com titularidade, passo 3 sem liberação não envia nada, Que tirei, Favoritar, Favoritas, nada de imagem no localStorage, convite não repete;
3. busca simulada: consentimento destacado e desmarcado, links, só a foto visível aparece (id inexistente nunca), ocultar falso positivo, revogar com aviso de purga;
4. antes da revelação (360 px): sem miniatura/contagem, sem rolagem horizontal, busca ativada espera a revelação;
5. câmera frontal (dispositivo falso) captura e cai na revisão; `/postar` segue abrindo.

Bugs achados pelo E2E e corrigidos: ocultar a última sugestão trocava de aba; botão "Tirar a foto" habilitava antes do vídeo ter quadro; legenda "revela Revela …".

Suíte E2E completa (`playwright.config.ts`, todos os specs): ver §5.

Capturas: `evidence/e2e-antes-da-revelacao-360.png`, `evidence/e2e-consentimento.png`, `evidence/e2e-encontradas.png`.

## 4. Revisão de segurança independente
Agente revisor sem acesso às minhas conclusões, com o banco local. Verificado ok: grants, `search_path`, Storage só INSERT, restauração da personificação, match sem acesso. Achados corrigidos no commit `bafff80`: (alto) anfitrião via na trilha quem consentiu; (médio) revoke poluía auditoria de qualquer evento; (médio) referência órfã em exclusão de conta/evento; (baixo) referência rejeitada não purgada; (baixo) `unique_violation` em concorrência; (baixo) um job derrubava o lote. Suspeitas não reproduzidas registradas em `07-release-gates.md` (corrida upload×revogação → varredura periódica; upload sem SELECT policy → testar no Supabase completo).

## 5. Suíte E2E completa
_preenchido ao final da execução_

## 6. Não executado
- iPhone Safari/PWA e Android Chrome físicos; câmera real; foto real do Google (CORS/expiração).
- Integração do adaptador nuvem contra Supabase completo (Auth + PostgREST + Storage API): só o banco foi exercitado.
- Benchmark, viés, custo, pentest; config E2E `playwright.ux.config.ts`/`validapay` (ver §5).
