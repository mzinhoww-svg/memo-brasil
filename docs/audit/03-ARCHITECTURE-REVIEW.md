# 03 · Revisão de arquitetura e qualidade

Auditor A3 (rascunho `drafts/A3.md`) com apoio do A4 sobre contratos. Evidência: `evidence/logs/a3-*`, `evidence/test-results/a3-*`.

**Veredito:** camadas bem separadas (domínio puro, repositórios, serviços, componentes do kit) e testáveis, mas **a regra de visibilidade vive na interface** e os contratos de repositório são locais. Todas as páginas são Client Components (A3-019), há 8 `catch` vazios (A3-015) e 7 asserções de tipo (A3-014). O frontend **não** poderá receber adaptadores Supabase sem retrabalho nos pontos de ITG-101..ITG-103.

## Achados de arquitetura e qualidade
- **A3-001** (P1) Visibilidade, revelação e moderação só existem como filtro de UI; o cliente carrega tudo. Evidência: hooks.ts useEventData; photo.ts visiblePhotos; grep can( = 1 uso.
- **A3-002** (P2) Modelo de papéis incompleto para RLS. Evidência: roles.ts:19-37; painel/[id]/layout.tsx:47.
- **A3-003** (P2) Contrato de repositório não é backend-ready em 7 pontos. Evidência: types.ts; hooks.ts:74-100; app/page.tsx:24; editor.tsx:61.
- **A3-004** (P2) Read-modify-write sem versão: lost update e ressurreição de evento. Evidência: events/service.ts; admin/service.ts moderate; repositories/index.ts; indexeddb/index.ts:50-56 (leitura de código).
- **A3-006** (P2) Falha de escrita deixa botões presos em 'ocupado' (wizard, entrar, ZIP). Evidência: a3-resilience.json: wizardButtonDisabled=true.
- **A3-007** (P2) Falha de leitura vira 'Carregando a festa…' eterno com mensagem de escrita. Evidência: a3-resilience.json readFailureBodyText.
- **A3-008** (P2) Foco do Sheet volta ao primeiro controle a cada tick do relógio; fundo não inerte. Evidência: a3-resilience.json: foco 'Voltar' antes, 'Excluir evento' após 16 s.
- **A3-009** (P2) Limites só em maxLength do HTML; domínio e serviços não validam. Evidência: grep maxLength só em .tsx.
- **A3-013** (P3) Dependências e exports não usados; contratos especulativos. Evidência: logs/a3-depcheck.txt, a3-knip.txt
- **A3-014** (P3) Escapes de tipo: 7 asserções, 0 any, 0 ts-expect-error. Evidência: grep as never|as unknown as.
- **A3-015** (P3) 8 catch vazios; câmera não distingue causa. Evidência: postar/page.tsx:54,75,89.
- **A3-016** (P3) URLs de objeto sem revogação em editor e feed. Evidência: editor.tsx:28-34; hooks.ts:78-100.
- **A3-018** (P3) Datas no fuso do aparelho, não do evento; formatação manual. Evidência: hooks.ts:110-125.
- **A3-019** (P3) Todas as páginas são Client Components; /design e /master públicos em produção. Evidência: grep use client; a3-xss-network.json.
- **A3-020** (P3) tsconfig inclui e2e/: erro de tipo em spec quebra next build. Evidência: logs/a3-prod-build.txt (build final).

## Relatório do auditor A3 (integral)
# A3: Arquitetura, segurança e qualidade (MemoriesMT, 3266e26)

## Resumo
Base pequena (~3,1 mil linhas) e bem camadas: domain puro, repositórios atrás de interfaces, sem IndexedDB na UI (exceto 2 leituras), zero `any`, zero segredos na árvore e no histórico, nenhuma requisição externa, nenhum XSS encontrado, EXIF removido, relógio de teste ausente do bundle de produção. O risco real está na transição ao Supabase: regras de acesso vivem no cliente e o contrato de repositório não é backend-ready. Contagem: P0 0, P1 1, P2 8, P3 12. Eslint limpo, 131 testes unitários passam.

## Verificações
| Item | Resultado |
|---|---|
| Segredos (árvore e `git log -S`: sb_, eyJ, AIza, secret, password, service_role) | Nenhum; "eyJ" só em base64 de imagem. .env.example sem valores |
| NEXT_PUBLIC_ | Só MM_TEST_CLOCK e BUILD_ID |
| Relógio de teste em produção | 0 chunks com mm-agora (cópia de produção); 1 no build de teste |
| npm audit | 5 altas, todas dev (eslint-config-next); prod 0 |
| XSS (título, legenda, aviso, momento, ?mesa, URL) | Escapado; flag nula |
| dangerouslySetInnerHTML | 4, todos constantes (tema, paleta, ícones) |
| Rede em runtime (22 rotas) | Só localhost e blob:; fontes self-hosted |
| Upload | SVG rasterizado, não-imagem rejeitada, EXIF/GPS removido; sem limite de dimensão |
| Headers/CSP | Presentes; unsafe-inline; sem COOP/CORP |
| SW | Cacheia só estáticos e HTML (sem dados); /sw.js no-cache |
| Câmera/listeners | Tracks e listeners liberados |
| Prototype pollution | Spread de patch tipado; sem merge profundo |
| Open redirect | Nenhum (router.push com código normalizado) |
| Tokens e console.* | Inexistentes |

## Confirmado por evidência
- Upload: docs/audit/evidence/test-results/a3-upload-results.json
- XSS, rede, storage, SW: docs/audit/evidence/test-results/a3-xss-network.json
- Falhas de IndexedDB e foco do Sheet: docs/audit/evidence/test-results/a3-resilience.json
- Headers: docs/audit/evidence/logs/a3-headers-*.txt; build: a3-prod-build.txt
- Auditoria de dependências: a3-npm-audit*.txt, a3-depcheck.txt, a3-knip.txt
- Specs: web/e2e/audit-a3-upload|xss-network|resilience.spec.ts

## Não verificado
Efeito do blocking() de upgrade entre abas (só leitura de código); comportamento de canvas gigante em iOS/Android reais; jscpd (não rodado); screenshots; Lighthouse/desempenho; RLS (não existe).

## Achados
Resumo na lista JSON abaixo. Principais: A3-001 (P1), A3-002 a A3-009 (P2).
