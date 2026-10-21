# 12 — Backlog de implementação

Épicos em ordem sugerida. Cada item referencia funcionalidades (`F-xx`) e critérios (`13`, `AC-xx`). Estimativa: P=pequeno (≤1d), M=médio (2–4d), G=grande (≥5d).

## E0 — Fundação
| ID | Item | Refs | Tam. |
|---|---|---|---|
| B-001 | Projeto Next.js + TS + Tailwind, tokens do design system (`06`), fontes (Instrument Serif, Radley, sans) | — | P |
| B-002 | PWA: manifest, service worker, ícones próprios | AC-PWA | M |
| B-003 | Camada de domínio (tipos `Event`, `Photo`, `Reaction`, enums) e regras puras (`endAt`, `isRevealed`, `canJoin`, `shotsLeft`, código) com testes unitários | F-13,F-18,F-21,F-28 | M |
| B-004 | Interfaces `AuthService/EventRepository/PhotoService/ReactionService/BillingService/NotificationScheduler` + implementações `Local*` (IndexedDB) | `09` | G |

## E1 — Onboarding e acesso
| B-010 | Launch + 3 slides | F-01,F-02 | P |
| B-011 | Welcome/Auth (Google via stub; e-mail marcado indisponível) + sheet código | F-03..F-05 | M |
| B-012 | Nome e propósito | F-06,F-07 | P |
| B-013 | Rota `/<code>` (deep link) e `JoinWithCode` | F-11,F-12 | M |

## E2 — Criar evento
| B-020 | Shell do wizard (`StepHeader/Footer`, 9 passos, progresso, voltar) | F-13 | M |
| B-021 | Passos nome, categoria (títulos padrão), término (calendário, mín. 30 min) | F-15..F-17 | M |
| B-022 | Passos revelação e estilo de câmera | F-18,F-19 | M |
| B-023 | Convite: capa (upload/crop), preview do convidado | F-20 | M |
| B-024 | Capacidade e fotos/pessoa; visibilidade | F-21 | M |
| B-025 | Preço (regra ≤10 grátis; compra simulada) | F-22 | M |
| B-026 | Evento criado + compartilhar (Web Share) + QR | F-24,F-25 | M |

## E3 — Núcleo de captura e galeria
| B-030 | Câmera (getUserMedia, inverter, zoom, rolo, permissões) | F-26,F-28 | G |
| B-031 | Filtros VINTAGE/B&W em canvas | F-27 | M |
| B-032 | Fila offline de sync (equivalente PendingSyncCoordinator) | F-29 | G |
| B-033 | Home (hero, álbuns, vazio) | F-08..F-10 | M |
| B-034 | Galeria + estatísticas + revelação (gating) | F-30,F-31 | G |
| B-035 | Visualizador + reações | F-32 | M |

## E4 — Gestão e extras
| B-040 | Configurações do evento (+ regras de término/exclusão) | F-36 | M |
| B-041 | Exportar/baixar/compartilhar | F-34,F-35 | M |
| B-042 | Perfil (nome/sair/excluir) | F-37 | P |
| B-043 | Editor (desenho, texto, borracha, colagem, undo/redo) | F-33 | G |
| B-044 | Paywall Memo+ (UI) | F-23 | M |

## E5 — Integração backend (etapa posterior, fora desta fase)
Supabase: schema+RLS (`08`), RPCs, Storage, Auth Google/anônima, push (VAPID), billing gateway, validação de compra no servidor.

## Dependências críticas
B-003 → tudo; B-004 → E1..E4; B-030 → B-031/B-032; B-034 depende de B-032.
