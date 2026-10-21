# 04 · Revisão de segurança

Auditor A3 + verificação do consolidador. Nada destrutivo; só local. Evidência: `evidence/logs/a3-*`, `evidence/test-results/a3-upload*.json`, `npm-audit-*.json`, `vercel-prod-headers.txt`.

**Veredito:** **sem segredos, sem XSS, sem requisição externa.** EXIF/GPS são descartados (reencode em canvas) e SVG com script é rasterizado sem executar. Riscos: upload sem limite de dimensão (PNG 20000×20000 aceito, A3-010), CSP com `unsafe-inline` (A3-011), autorização só de interface (inerente ao pré-backend, vira requisito de RLS em ITG-101/ITG-109), código de convite de ~39,6 bits (exige limite de tentativas e RPC no backend, ITG-107). `npm audit`: produção **0**; 5 altas em dependências de desenvolvimento (cadeia do eslint-config-next), inalcançáveis em runtime (BG-134). **Produção ainda serve o build antigo sem CSP/headers (INF-002).**

## Modelo de autorização futuro
`can()` é contrato de UI, não segurança. Faltam: serviços recebendo `Actor`, matriz de papéis × RLS por tabela, proteção de servidor para `/master` (claim `app_metadata.role`, nunca senha ou URL), proteção contra IDOR por id de evento e enumeração de código. Registrados em ITG-101 e ITG-109.

## Achados de segurança
- **A3-001** (P1) Visibilidade, revelação e moderação só existem como filtro de UI; o cliente carrega tudo. Evidência: hooks.ts useEventData; photo.ts visiblePhotos; grep can( = 1 uso.
- **A3-002** (P2) Modelo de papéis incompleto para RLS. Evidência: roles.ts:19-37; painel/[id]/layout.tsx:47.
- **A3-005** (P2) Código de convite de 8 caracteres (~39,6 bits) exige rate limit e RPC no backend. Evidência: share-code.ts; log2(31^8)=39,63.
- **A3-010** (P3) Sem limite de dimensão/bytes de entrada; demais defesas OK. Evidência: a3-upload-results.json
- **A3-011** (P3) CSP com 'unsafe-inline', sem COOP/CORP; CSP precisará de ajuste para Supabase. Evidência: logs/a3-headers-*.txt
- **A3-012** (P3) npm audit: 5 altas, todas dev e inalcançáveis em runtime. Evidência: logs/a3-npm-audit*.txt
- **A3-017** (P3) CSV separado por vírgula; Excel pt-BR espera ponto e vírgula. Evidência: admin/export.ts.
- **A3-021** (P3) Nome e fotos persistem localmente após 'sair'. Evidência: indexeddb users.*; a3-xss-network.json.
- **A1-003** (P2) 'Remover da festa' não impede a reentrada. Evidência: a1-journeys.json (J7 reentrada_apos_remocao true)
- **A1-012** (P3) Denúncia não é única por pessoa. Evidência: web/src/domain/photo.ts:report; web/src/features/photos/service.ts:reportPhoto
- **A1-015** (P3) Risco aceito pré-backend: meta.user com o hostId vira anfitrião. Evidência: a1-exposure-roles.json (P2); a1-grep-roles.txt
- **A4-006** (P1) Convite carrega evento, participantes e fotos de não-membro. Evidência: hooks.ts:60-65; e/[code]/page.tsx:26
- **A4-012** (P2) can() só guarda UI; /master sem proteção de servidor. Evidência: roles.ts:19; painel/layout.tsx:49; ls src/proxy.ts ausente; ROLES.md regra 4
- **A4-014** (P2) Convite sem id, rotação ou expiração; ?mesa= não confiável. Evidência: links.ts:3-12; seed.ts:56; e/[code]/page.tsx:54
