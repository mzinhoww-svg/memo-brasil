# Consolidação do backlog (2026-10-21)

Fonte de verdade: `backlog.json`. Este arquivo é um **instantâneo analítico** (números medidos por script na data); o estado vivo está em `BACKLOG.md`, `ROADMAP.md`, `RELEASE-GATES.md`, `TRACEABILITY-MATRIX.md` e `DEPENDENCY-GRAPH.md` (gerados).

## 1. Contagens
- 189 itens folha + 19 épicos (EP-01…EP-19). Prioridade: P0 35 · P1 61 · P2 46 · P3 47.
- Status: DONE 58 · IN_REVIEW 15 · READY 11 · BLOCKED 4 · DEFERRED 11 · CANCELLED 2 · BACKLOG 88.
- Por épico (abertos): EP-11 UX/UI Audit 7 IN_REVIEW + 18 BACKLOG; EP-12 DS v2 1+2; EP-13 Event Studio 2+3; EP-14 Master Admin 3+1; EP-15 Analytics 1; EP-16 Security v2 1+1; EP-17 QA v2 0+2; EP-18 Release v2 0+1; EP-19 Monetização e escala 0+13.

## 2. Evidências dos DONE
- Nenhum DONE sem commit e sem teste/evidência (o validador exige). 4 evidências citam âncoras de linha ou subseções (`arquivo:linhas`, `§4.1`) e não são caminhos de arquivo: não são ausências.
- Itens da V2 **não** estão DONE: estão IN_REVIEW até a revisão independente A1–A5 terminar.

## 3. Duplicatas e dependências
- Duplicatas por similaridade de título (> 0,8): nenhuma. UXA-101/102/103 foram agrupados no UXA-002 (sem itens duplicados).
- Dependências inexistentes: nenhuma. Ciclos: nenhum (validador).

## 4. Confronto com o REA original (38 funcionalidades F-01…F-38) e a V1/V2
Requisitos (57, incluindo PRD/DS): 42 DONE · 4 EXCLUÍDOS com justificativa (D11 etc.) · 4 DEFERRED (backend) · 7 PARCIAL/ABERTO. Nenhum requisito sem cobertura.
Parciais/abertos: F-03 Entrar com Google (V1 usa o Google do Supabase; FT-080 deferido), F-07 Propósito (FT-006), F-14/F-38 notificações (push FT-081/083 deferido), F-20 capa do convite (FT-007; a V2 entrega logo/capa por upload no Studio), F-22/F-23 preço e paywall (FT-086 deferido), F-26 câmera/zoom (TK-010a), F-29 sync offline (BG-071/FT-084), F-35 compartilhar fotos (FT-015), F-37 perfil/excluir conta (FT-087).

## 5. Lacunas reais e funcionalidades comerciais ausentes (viraram itens do EP-19)
Antes desta consolidação o backlog **não tinha** itens para: termos/privacidade e aceite (COM-004), planos e entitlements (COM-001), enforcement de limites por plano no servidor (COM-003), pagamento Pix/cartão com webhooks (COM-002, filho de FT-086), checkout/página de planos (COM-006), financeiro no master (COM-007), e-mail transacional (COM-005), backup/PITR/restauração (COM-009), observabilidade e alertas (COM-008), escala de mídia/miniaturas (COM-010), antifraude/abuso (COM-013), domínio e e-mail de marca (COM-011), suporte e runbook (COM-012). Nenhum deles foi implementado: não há cobrança nesta missão.
Lacunas da V2 ainda sem item próprio resolvido (já cobertas por itens abertos): wizard v2 com prévia do convite (UXA-108/EST-003), métricas do evento e exportação (EST-005), revogar convites e baixar QR no painel (EST-005), Design System v2 documentado em `/design` (DSV-002), acesso excepcional a foto privada na UI (MAD-004), escrita de settings/flags na UI (MAD-003 ampliado).

## 6. Reprioridade e releases
Regra: itens que impedem produção (OAuth/variáveis/domínio) e o aceite legal sobem para P0/P1 e entram em R1/R2; monetização depende deles. Releases (campo `release` no JSON):
- **R1 (0–30 d) Estabilização e go-live da V1:** SB-004, SB-008, REL-001, INF-002, SB-005/006/007, INF-001, BG-071.
- **R2 (30–60 d) Studio & Admin V2 em produção:** EP-11…EP-18, termos (COM-004), backup (COM-009), domínio (COM-011).
- **R3 (60–90 d) Monetização e escala:** EP-19 restante (planos, gateway, checkout, e-mail, observabilidade, mídia, antifraude, suporte), push e demais deferidos.
- **R4 (> 90 d):** melhorias P3.

## 7. Caminhos críticos
- Monetização: SB-004 → SB-008 → COM-001 → COM-002 → COM-006 (com COM-004 como pré-requisito legal de COM-002).
- Escala: SB-007 → COM-008 → COM-012 (COM-010/013 em paralelo após SB-005).
- Go-live V1: SB-004 → SB-008 → REL-001 → INF-002, mais o fluxo de convidado no preview remoto (G7).

## 8. Roadmap 30/60/90
Ver `ROADMAP.md` (gerado). Resumo: 30 d = R1; 60 d = R2; 90 d = R3. Total de abertos por release hoje: R1 9 · R2 ≈ 62 · R3 ≈ 27 · R4 33 (valores exatos no ROADMAP).
