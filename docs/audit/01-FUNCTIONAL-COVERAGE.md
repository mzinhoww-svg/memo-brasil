# 01 · Cobertura funcional

Auditor A1 (relatório integral abaixo; rascunho: `drafts/A1.md`). Evidência: `evidence/test-results/a1-*.json`, `evidence/logs/a1-*.txt`, `evidence/screenshots/a1-*.png`; specs `web/e2e/audit-a1-*.spec.ts` (29 testes, todos passando na última rodada).

**Veredito do consolidador:** cobertura funcional **alta** para o escopo pré-backend; 1 P1 (BG-101) e 5 P2 de revelação/papéis. Não se classificou como defeito a ausência de colaboração real, login e storage remoto (reservados à fase Supabase), mas os contratos para isso estão avaliados em `08`.

# A1 — Auditoria independente: rastreabilidade, jornadas, revelação, exposição e papéis

Alvo: `feat/memoriesmt` @ 3266e26, build de teste em `next start -p 3301`. Suítes: `web/e2e/audit-a1-{reveal,exposure-roles,journeys}.spec.ts` (29 testes, todos executados, log em `evidence/logs/a1-playwright-final.txt`; JSON em `evidence/test-results/a1-*.json`; prints em `evidence/screenshots/a1-*.png`). Nenhum código de produto foi alterado. Docs de QA/backlog do autor não foram usados como prova.

## Resumo
- A revelação básica é sólida: borda `now===revealAt` correta, resumo/prévia/contagem mostram o mesmo instante no fuso do evento (mesmo com o navegador em Pacific/Auckland), DST de Lisboa tratado, datas/horas/fusos inválidos recusados, transição sem recarregar, entrada tardia sem transição, reduced-motion imediato, offline e reabertura corretos.
- **Nenhuma foto bloqueada vaza na interface** do convidado (Agora, Explorar, Você, Postar, retrospectiva, `/editar/<id>`, `<img>`, blob URLs, cache do SW, rede).
- Defeito mais relevante: a revelação "quando o evento terminar" vira data absoluta e **não acompanha** mudança/encerramento do fim (A1-001).
- Papéis: convidado, outro usuário e `?role=master`/`?admin=1`/token não abrem painel nem master; não existe senha fixa nem caminho master na UI/bundle. `can()` cobre só `event.configure` na UI (A1-004).
- Totais: P0 0, P1 1, P2 5, P3 9.

## Matriz REA → PRD → implementação → teste → resultado
Legenda: **C** Confirmado por evidência; **I** Implementado não testado; **P** Parcial; **S** Simulado; **A** Ausente; **B** Bloqueado por dependência externa; **N** Não aplicável pré-backend/decisão D11. Teste = A1 (meu) salvo indicação.

| REA | PRD | Implementação | Teste | Res. |
|---|---|---|---|---|
| AC-01 | RF-01 | wizard.tsx, duration.ts | J7 | C |
| AC-02 | RF-02 | share-code.ts | J1 | C |
| AC-03 | RF-03 | e/[code]/page.tsx, participants/service.ts | J1, J5, R9 | P (sem "Continuar sem entrar") |
| AC-04 | RF-10 | pricing.ts, wizard | wizard (leitura) | S |
| AC-05 | RF-01 | options.ts | J1 | C |
| AC-06 | RF-04 | postar/page.tsx | J1 | C |
| AC-07 | RF-05 | — (servidor) | J7 (corrida local ok) | B |
| AC-08 | RF-05 | IndexedDB local | J4 | P (envio ao reconectar: B) |
| AC-09 | RF-06 | reveal.ts, event.ts | R1–R13 | P (A1-001; vira data absoluta) |
| AC-10 | RF-07 | photo.ts setReaction | J3 | C (rótulos de texto, não emoji) |
| AC-11 | RF-09 | canEditEnd | J2 | C |
| AC-12 | RF-09 | deleteEventCascade | J2 (0 linhas no IDB) | P (remoção remota: B) |
| AC-13 | RF-08 | admin/export.ts | J2, J3 | P (sem relatório de falhas) |
| AC-14 | RF-11 | notifications.ts | — | I (só com app aberto) |
| AC-15 | RF-12 | "Entrar como outra pessoa" | — | A / B |
| AC-16 | F-24 | criar/pronto | — | I |
| AC-17, AC-18 | — | removidos (D11) | — | N |

| F | Res. | F | Res. | F | Res. |
|---|---|---|---|---|---|
| F-01,02,04,10 | N (D11) | F-14 | P (Ativar avisos) | F-26 | P (câmera sintética ok; sem zoom) |
| F-03 | B | F-15,16,17 | C | F-27 | I |
| F-05 | P | F-18 | P (substituída por revelação programada) | F-28,29 | P |
| F-06 | C | F-19 | I | F-30 | P |
| F-07 | A | F-20 | P (sem capa própria) | F-31 | C |
| F-08,09 | P | F-21 | C | F-32 | C |
| F-11 | C | F-22 | S | F-33 | P (desenho C; texto/colagem I) |
| F-12 | P | F-23 | A/B | F-34 | C (ZIP) |
| F-13 | P (6 passos, não 9) | F-24,25 | C | F-35 | P |
| | | | | F-36 | C |
| | | | | F-37 | A |
| | | | | F-38 | S/P |

## Confirmado por evidência
- Borda exata: aguardando em revealAt−1 ms, revelada em revealAt e +1 ms — `test-results/a1-reveal.json` (R1), `screenshots/a1-r1-borda.png`.
- Mesmo instante nas 4 superfícies, fuso do aparelho distinto — R2, `a1-r2-fuso-auckland.png`. DST Lisboa (ambíguo e inexistente) — R2_dst.
- Validação 31/02, 29/02/2027, hora 25:00, fuso inventado, passado, +59,999 s recusado, +60 s aceito; UI idem — R3.
- Transição sem recarregar (marcador `window` preservado), duas abas, entrada tardia sem diálogo, reduced-motion (1 ms) — R6/R7, R7b, `a1-r7-transicao.png`.
- Reabrir após revelação e offline — R10, `a1-r10-offline-revelado.png`. Postar durante a revelação e em revealAt — R8.
- Ligar com fotos visíveis é bloqueado; desligar com fotos bloqueadas as torna visíveis; editar após revelada é travado — R11, R5b.
- Zero exposição antecipada: E1, E4 (`evidence/test-results/a1-exposure-roles.json`), `a1-e1-explorar-bloqueado.png`.
- Painel/subpáginas negados a convidado e a outro usuário; `/master?role=master|admin=1|token` inalterado; anônimo sem acesso — P1. Grep sem senha/segredo: `evidence/logs/a1-grep-roles.txt`.
- Jornadas: criar, convite/QR/mesa, entrada (minúsculas, link), capacidade (6º recusado), rolo (6ª foto bloqueada), editar/aviso/encerrar/não reabrir/excluir (IDB zerado), moderação (denúncia→ocultar→mostrar), reação única por pessoa, câmera negada, offline, IDB indisponível, editor, ZIP/CSV, corrida do último tiro — `a1-journeys.json`.

## Não verificado
Texto do compartilhamento (AC-16) e botão "Convite copiado"; notificações locais (AC-14); estilos vintage/P&B; texto e colagem do editor; Safari/iOS e câmera real; Lighthouse PWA; bundle de produção sem relógio de teste (testei o build de teste); lost-update entre abas (só leitura de código); idempotência de denúncia (leitura); transição reaparecendo ao avançar de novo após relógio atrasado (leitura).

## Notas de severidade
Limitações inerentes ao pré-backend, não tratadas como defeito: bytes no IndexedDB do próprio aparelho, `meta.user`/`hostId` forjáveis (A1-015), ausência de sincronização. `docs/supabase/INTEGRATION-PLAN.md` (linhas 91–103) já prevê relógio do servidor, `pg_cron` monotônico, RLS e fuso recalculado.
