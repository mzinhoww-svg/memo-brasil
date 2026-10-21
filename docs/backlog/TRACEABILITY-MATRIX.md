# Rastreabilidade: requisito → item do backlog → teste → status

REQUISITO (REA/DS/pedido) → FEATURE → TASK → CÓDIGO → TESTE → EVIDÊNCIA → STATUS. Código, testes e evidências estão nos próprios itens (`backlog.json`).

Cobertura: EXCLUÍDO 4, DEFERRED (backend) 4, DONE 42, PARCIAL/ABERTO 7 de 57 requisitos; nenhum sem cobertura ou justificativa.

| Requisito | Fonte | Descrição | Itens | Testes (amostra) | Status | Justificativa de exclusão |
|---|---|---|---|---|---|---|
| F-01 | REA 02-FEATURE-INVENTORY | Splash | - | - | EXCLUÍDO | Substituído pela capa do kit (decisão D11) |
| F-02 | REA 02-FEATURE-INVENTORY | 3 slides de intro | - | - | EXCLUÍDO | Substituído por capa e frase de assinatura (D11) |
| F-03 | REA 02-FEATURE-INVENTORY | Entrar com Google | FT-080 | - | DEFERRED (backend) |  |
| F-04 | REA 02-FEATURE-INVENTORY | E-mail e senha | - | - | EXCLUÍDO | Inativo no original; sem evidência de funcionamento |
| F-05 | REA 02-FEATURE-INVENTORY | Convidado por código | FT-003 | web/src/features/features.test.ts | DONE |  |
| F-06 | REA 02-FEATURE-INVENTORY | Nome do usuário | FT-003 | web/src/features/features.test.ts | DONE |  |
| F-07 | REA 02-FEATURE-INVENTORY | Propósito | FT-006 | - | PARCIAL/ABERTO |  |
| F-08 | REA 02-FEATURE-INVENTORY | Home com eventos | FT-004 | web/e2e/a11y.spec.ts; web/e2e/flows.spec.ts | DONE |  |
| F-09 | REA 02-FEATURE-INVENTORY | Álbuns | FT-032 | web/e2e/reveal-visual.spec.ts; web/e2e/reveal.spec.ts | DONE |  |
| F-10 | REA 02-FEATURE-INVENTORY | Abas FILMES/SCRAPBOOK | - | - | EXCLUÍDO | Substituído por Agora/Explorar/Você do kit; Scrapbook era placeholder |
| F-11 | REA 02-FEATURE-INVENTORY | Entrar com código | FT-002 | web/src/domain/domain.test.ts; web/src/features/invitations/qr.test.ts | DONE |  |
| F-12 | REA 02-FEATURE-INVENTORY | Deep link | FT-002 | web/src/domain/domain.test.ts; web/src/features/invitations/qr.test.ts | DONE |  |
| F-13 | REA 02-FEATURE-INVENTORY | Wizard de criação | FT-001 | web/e2e/flows.spec.ts; web/src/features/features.test.ts | DONE |  |
| F-14 | REA 02-FEATURE-INVENTORY | Permissão de notificações | FT-081 | - | DEFERRED (backend) |  |
| F-15 | REA 02-FEATURE-INVENTORY | Nome do evento | FT-001 | web/e2e/flows.spec.ts; web/src/features/features.test.ts | DONE |  |
| F-16 | REA 02-FEATURE-INVENTORY | Categoria | FT-001 | web/e2e/flows.spec.ts; web/src/features/features.test.ts | DONE |  |
| F-17 | REA 02-FEATURE-INVENTORY | Término ≥30 min | FT-001 | web/e2e/flows.spec.ts; web/src/features/features.test.ts | DONE |  |
| F-18 | REA 02-FEATURE-INVENTORY | Revelação | FT-030, FT-031, FT-032, FT-033 | web/e2e/reveal-visual.spec.ts; web/e2e/reveal.spec.ts; web/src/domain/reveal.test.ts | DONE |  |
| F-19 | REA 02-FEATURE-INVENTORY | Estilo de câmera | FT-010 | web/e2e/flows.spec.ts | DONE |  |
| F-20 | REA 02-FEATURE-INVENTORY | Capa do convite | FT-007 | - | PARCIAL/ABERTO |  |
| F-21 | REA 02-FEATURE-INVENTORY | Capacidade e fotos por pessoa | FT-005 | web/src/domain/domain.test.ts | DONE |  |
| F-22 | REA 02-FEATURE-INVENTORY | Preço | FT-005, FT-086 | web/src/domain/domain.test.ts | PARCIAL/ABERTO |  |
| F-23 | REA 02-FEATURE-INVENTORY | Paywall Memo+ | FT-086 | - | DEFERRED (backend) |  |
| F-24 | REA 02-FEATURE-INVENTORY | Evento criado e compartilhar | FT-002 | web/src/domain/domain.test.ts; web/src/features/invitations/qr.test.ts | DONE |  |
| F-25 | REA 02-FEATURE-INVENTORY | Convite por QR | FT-002 | web/src/domain/domain.test.ts; web/src/features/invitations/qr.test.ts | DONE |  |
| F-26 | REA 02-FEATURE-INVENTORY | Câmera | FT-010, TK-010a | a criar: E2E com câmera sintética + teste unitário do helper; web/e2e/flows.spec.ts | PARCIAL/ABERTO |  |
| F-27 | REA 02-FEATURE-INVENTORY | Estilos aplicados à foto | FT-010 | web/e2e/flows.spec.ts | DONE |  |
| F-28 | REA 02-FEATURE-INVENTORY | Rolo limitado | FT-011 | web/src/features/features.test.ts; web/src/lib/lock.test.ts | DONE |  |
| F-29 | REA 02-FEATURE-INVENTORY | Sync offline-first | FT-017, BG-071, FT-084 | web/src/repositories/repositories.test.ts | PARCIAL/ABERTO |  |
| F-30 | REA 02-FEATURE-INVENTORY | Galeria | FT-032 | web/e2e/reveal-visual.spec.ts; web/e2e/reveal.spec.ts | DONE |  |
| F-31 | REA 02-FEATURE-INVENTORY | Revelação (gating) | FT-032, FT-033 | web/e2e/reveal-visual.spec.ts; web/e2e/reveal.spec.ts; web/src/features/features.test.ts | DONE |  |
| F-32 | REA 02-FEATURE-INVENTORY | Reações e Quem reagiu | FT-012 | web/e2e/flows.spec.ts; web/src/domain/domain.test.ts | DONE |  |
| F-33 | REA 02-FEATURE-INVENTORY | Editor de fotos | FT-013 | web/e2e/flows.spec.ts; web/src/domain/collage.test.ts | DONE |  |
| F-34 | REA 02-FEATURE-INVENTORY | Exportar álbum | FT-014 | web/e2e/flows.spec.ts; web/src/features/admin/export.test.ts | DONE |  |
| F-35 | REA 02-FEATURE-INVENTORY | Compartilhar fotos | FT-015 | - | PARCIAL/ABERTO |  |
| F-36 | REA 02-FEATURE-INVENTORY | Configurações do evento | FT-004, FT-008 | web/e2e/a11y.spec.ts; web/e2e/flows.spec.ts; web/src/features/features.test.ts | DONE |  |
| F-37 | REA 02-FEATURE-INVENTORY | Perfil, sair, excluir conta | FT-051, FT-087 | web/e2e/flows.spec.ts; web/src/repositories/repositories.test.ts | PARCIAL/ABERTO |  |
| F-38 | REA 02-FEATURE-INVENTORY | Notificações | FT-081, FT-083 | - | DEFERRED (backend) |  |
| DS-01 | MemoriesMT Design System v1 | Marca: logos oficiais, tamanhos mínimos, nome MemoriesMT | FT-020 | web/e2e/visual.spec.ts | DONE |  |
| DS-02 | MemoriesMT Design System v1 | Tipografia: Bricolage + Instrument Serif locais | FT-020 | web/e2e/visual.spec.ts | DONE |  |
| DS-03 | MemoriesMT Design System v1 | Temas Dia e Noite por tokens | FT-020 | web/e2e/visual.spec.ts | DONE |  |
| DS-04 | MemoriesMT Design System v1 | Tokens oficiais (Tailwind v4 adaptado) | FT-020 | web/e2e/visual.spec.ts | DONE |  |
| DS-05 | MemoriesMT Design System v1 | Componentes do kit reutilizáveis | FT-021 | web/e2e/visual.spec.ts; web/src/components/memoriesmt/components.test.tsx | DONE |  |
| DS-06 | MemoriesMT Design System v1 | Regras visuais (sem sombra/gradiente/emoji, REC controlado, alvos 44 px) | FT-022 | web/e2e/a11y.spec.ts | DONE |  |
| DS-07 | MemoriesMT Design System v1 | Voz e nomenclatura (Agora, Explorar, Você) | FT-022 | web/e2e/a11y.spec.ts | DONE |  |
| RV-01 | correção de escopo 2026-10-21 | Ativar/desativar revelação por evento | FT-031 | web/e2e/reveal.spec.ts | DONE |  |
| RV-02 | correção de escopo 2026-10-21 | Data, horário e fuso | FT-031 | web/e2e/reveal.spec.ts | DONE |  |
| RV-03 | correção de escopo 2026-10-21 | Resumo, alteração conforme estado e prévia | FT-031 | web/e2e/reveal.spec.ts | DONE |  |
| RV-04 | correção de escopo 2026-10-21 | Fotografar sem ver fotos bloqueadas; estado Aguardando revelação | FT-032 | web/e2e/reveal-visual.spec.ts; web/e2e/reveal.spec.ts | DONE |  |
| RV-05 | correção de escopo 2026-10-21 | Contagem regressiva no fuso configurado | FT-032 | web/e2e/reveal-visual.spec.ts; web/e2e/reveal.spec.ts | DONE |  |
| RV-06 | correção de escopo 2026-10-21 | Atualização automática e transição na hora | FT-032 | web/e2e/reveal-visual.spec.ts; web/e2e/reveal.spec.ts | DONE |  |
| RV-07 | correção de escopo 2026-10-21 | Revelação desativada = visibilidade imediata | FT-032 | web/e2e/reveal-visual.spec.ts; web/e2e/reveal.spec.ts | DONE |  |
| RV-08 | correção de escopo 2026-10-21 | Casos especiais (9) | FT-033 | web/e2e/reveal.spec.ts; web/src/features/features.test.ts | DONE |  |
| RV-09 | correção de escopo 2026-10-21 | Modelagem reveal_enabled/reveal_at/timezone/reveal_status sem depender de timers | FT-030 | web/src/domain/reveal.test.ts; web/src/repositories/repositories.test.ts | DONE |  |
| RV-10 | correção de escopo 2026-10-21 | Documentar revelação server-side | FT-035 | - | DONE |  |
| RV-11 | correção de escopo 2026-10-21 | Papéis organizador × master sem senha fixa nem URL | FT-034 | web/e2e/reveal.spec.ts; web/src/domain/reveal.test.ts | DONE |  |
| RV-12 | correção de escopo 2026-10-21 | Validação em browser, Dia/Noite, mobile/desktop, e preview Vercel | FT-036, FT-037 | web/e2e/remote.spec.ts (5 testes remotos, 5 passaram); web/e2e/reveal-visual.spec.ts | DONE |  |
