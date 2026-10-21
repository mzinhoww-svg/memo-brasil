# Arquitetura do MemoriesMT (fase pré-Supabase)

## Camadas (`web/src`)
| Camada | Pasta | Regra |
|---|---|---|
| Domínio (TS puro, sem React/IO) | `domain/` | regras do REA: tempo, revelação, capacidade, preço, fotos, reações, moderação, colagem, avisos, contraste |
| Persistência | `repositories/` | interfaces + adaptadores **IndexedDB** e **memória**; bytes de foto como `ArrayBuffer` |
| Serviços (contratos do backend futuro) | `lib/services/` | `AuthService`, `BillingService` (nunca cobra), `NotificationScheduler`, `SyncService` |
| Casos de uso | `features/*/service.ts` | criar/encerrar/excluir evento, entrar, postar, reagir, moderar, exportar |
| Estado de UI | `features/app/` (`AppProvider`, hooks) | identidade local, relógio, carregamento por evento |
| Componentes do design system | `components/memoriesmt/` | emitem as classes `mm-*` oficiais; sem regra de negócio |
| Rotas | `app/` | `/`, `/entrar`, `/criar`, `/e/[code]/{agora,explorar,voce,postar,editar,retrospectiva}`, `/painel/[id]/*`, `/design`, `/offline` |
| Estilo | `styles/tokens.css` (kit), `mm.css` (kit), `app.css` (estrutura de telas) | tokens como fonte; Tailwind v4 só para utilitários mapeados |

## Decisões (todas reversíveis)
| # | Decisão | Motivo |
|---|---|---|
| D1 | Next.js em `web/` na branch `feat/memoriesmt`; Express intacto | o deploy do MVP (Ladob) depende da raiz; migração incremental |
| D2 | Sem `cacheComponents`/Activity | app local-first; câmera não deve ficar viva em rota oculta |
| D3 | Tailwind v4 com `@theme inline` apontando para as variáveis do kit; classes `mm-*` do kit copiadas sem alteração | o preset do kit é v3; fidelidade por construção |
| D4 | `ArrayBuffer` (não `Blob`) no IndexedDB | Safari instável com Blob; testável em jsdom |
| D5 | Rótulos de reação em texto (Amei, Esse momento, Rachei, Uau) | o kit proíbe emoji; REA define 4 tipos, 1 por pessoa/foto |
| D6 | `durante` = fotos visíveis na hora | o feed Agora do kit mostra "cada foto na hora" (INF; REA não define "aos poucos") |
| D7 | Criar evento >10 convidados é permitido como **demonstração sem cobrança** | proibido habilitar cobrança; regra de preço fica no domínio |
| D8 | Identidade local + "Entrar como outra pessoa" | simular mais de uma pessoa no aparelho, rotulado como demonstração |
| D9 | Relógio de teste só em build com `NEXT_PUBLIC_MM_TEST_CLOCK=1` | produção usa `Date.now()` |
| D10 | Editor salva por **download** (não cria nova foto/rolo) | REA não define a persistência da versão editada (HIP) |
| D12 | Identidades locais ficam no aparelho (`users.known/switchTo`); "Continuar como" volta ao anfitrião | achado A3 da auditoria: trocar de pessoa não pode destruir o acesso ao painel |
| D13 | `withLock` (Web Locks + fila) em postar, entrar e denunciar | evita passar do rolo/vagas com toques rápidos ou duas abas |
| D14 | CSP/headers só em produção; relógio de teste fixado em `"0"` no build | CSP exige `unsafe-inline` em dev; teste não pode ligar em produção |
| D15 | Service worker versionado por deploy (`/sw.js?v=<build>`), aquecimento das rotas do evento 1×/sessão | cache antigo some; rotas dinâmicas precisam de uma visita para abrir offline |
| D11 | Sem splash, intro de 3 slides, Scrapbook, e-mail/senha | splash/slides foram trocados pela capa do kit; Scrapbook era placeholder; e-mail inativo no original |

## O que é local, simulado ou depende do backend
| Funcionalidade | Situação |
|---|---|
| Criar evento, convite (código/link/QR), painel, moderação, exportação ZIP/CSV | **Funcional localmente** (neste aparelho) |
| Entrar por código/link, postar, rolo, reagir, revelação por horário, retrospectiva, editor | **Funcional localmente**; vale para pessoas no **mesmo aparelho** |
| "Entrar como outra pessoa", festa de exemplo (`seedDemoEvent`) | **Simulado para demonstração** |
| Preço >10 convidados | **Demonstração**: regra calculada, nada é cobrado |
| Avisos | **Parcial**: só com o app aberto (`setTimeout`) |
| Colaboração entre aparelhos, login Google, convidado anônimo real, sincronização, push real, excluir conta, Memo+/pagamento, moderação multiusuário | **Dependem do backend** (`docs/supabase/INTEGRATION-PLAN.md`) |
Nenhum fluxo finge sincronização multiusuário: a UI avisa "Versão local" nas telas de convite e criação.

## Segurança desta fase
Sem segredos no repositório. Entrada do usuário nunca vira HTML (React escapa; `dangerouslySetInnerHTML` só com conteúdo gerado do próprio kit/tokens). CSV neutraliza fórmulas. `?mesa=` aceita só rótulo curto e simples. Fotos reencodadas em canvas (EXIF/GPS descartados). Relógio de teste desligado em produção. Service worker só cacheia mesma origem e GET.
