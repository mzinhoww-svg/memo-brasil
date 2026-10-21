# 11 · Release gate

## Resultado: **NO-GO para a integração Supabase agora**
Motivo objetivo: P1 abertos que bloqueiam a integração (definição do próprio gate): `BG-101` (revelação acompanhar o fim do evento) e `ITG-101..ITG-106` (leitura escopada, contratos, fotos por URL, autoridade do servidor, identidade/migração, plano contraditório). **Não há P0.** Nenhum item exige reescrever o produto.

| Condição para GO / CONDITIONAL GO | Estado |
|---|---|
| Nenhum P0 aberto | ✔ (0) |
| Nenhum P1 que bloqueie integração | ✘ (7 itens) |
| Jornadas locais principais validadas | ✔ (46 E2E + 29 de auditoria) |
| Design system suficientemente aderente | ✔ |
| Contratos de dados definidos | ✘ parcial (ITG-102/103) |
| Testes críticos passando | ✔ (131 unitários, 46 E2E, 5 remotos) |
| Deploy Vercel verificado | ✔ preview 5d8df4a; ✘ produção desatualizada (INF-002) |
| Acesso do conector Supabase | ✘ INF-001 |

## O que leva a CONDITIONAL GO
1. `BG-101`, depois `BG-102` (semântica da revelação).
2. `ITG-106` (plano sem contradições e decisões de produto fechadas).
3. `ITG-101`, `ITG-102`, `ITG-104`, depois `ITG-103`, `ITG-105`.
4. `INF-001` resolvido em paralelo (acesso do conector, só leitura).
5. `AUD-002` (reauditoria dos P1). Só então liberar EP-09 (`FT-080…FT-089`).
Pendências **exclusivas da fase Supabase** ficam DEFERRED até o gate.

## Riscos aceitos pré-backend (documentados)
Qualquer pessoa altera IndexedDB/código local (meta.user com o `hostId` vira anfitrião: `BG-150`); a foto bloqueada existe no aparelho do próprio convidado; sem colaboração entre aparelhos; cada identidade local tem seu rolo.

## Sequência de execução
Ver `10-REMEDIATION-BACKLOG.md` (ondas e caminho crítico) e `../backlog/RELEASE-GATES.md`. Próximos itens READY: `BG-101` (P1), `INF-001` (P1), `ITG-106` (P1) e 10 P2.
