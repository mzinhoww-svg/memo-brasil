# Design System v2, Event Studio e Master Admin — arquitetura

Decisão de produto (dono): **a plataforma tem sua marca; o evento tem sua identidade; o administrador tem seu ambiente operacional.**
Branch: `feat/memoriesmt-studio` (de `feat/memoriesmt@1c40e79`). A homologação/release da v1 segue independente e não é interrompida por este trabalho.

## 1. Três camadas

| Camada | Escopo | Quem controla | Mecanismo |
|---|---|---|---|
| **Platform DS** | site institucional, login, conta, navegação, painel do organizador | MemoriesMT | tokens `--mm-*` em `:root` (v1 `docs/design/tokens.css` evoluído); nunca sobrescritos por evento |
| **Event Theme** | convite, QR, entrada, câmera, espera, galeria, compartilhamento | organizador | tokens `--evento-*` declarados **só** num wrapper `[data-event-theme]` por evento (já existe `EventTheme` + `data-palette`); sem CSS arbitrário |
| **Admin DS** | `/master` e tabelas/filtros/indicadores operacionais | operador | extensão do Platform DS (`--adm-*`: densidade, tabelas, status), desktop-first |

Regras inegociáveis
1. Um tema de evento **só altera variáveis dentro do próprio wrapper**; nenhum seletor global, nenhum `<style>` com texto do usuário. O renderer gera as variáveis a partir de um objeto validado, nunca de strings livres.
2. Estrutura, navegação, foco, estados, contraste mínimo e lógica de segurança **não** são personalizáveis.
3. Marca MemoriesMT nos eventos = assinatura discreta "Powered by MemoriesMT" (rodapé), sem competir com o evento.
4. Temas são **presets + tokens limitados**: o organizador escolhe preset, ajusta 5 cores dentro de uma faixa que **passa no contraste WCAG AA** (validação no cliente para prévia e no servidor/CHECK para persistir), escolhe fonte de uma lista fechada licenciada, sobe logo/capa (Storage), escreve mensagem (texto puro, limite de tamanho, escapado).

## 2. Tokens semânticos (v2)
- Platform: `--mm-fundo`, `--mm-superficie`, `--mm-tinta`, `--mm-apoio`, `--mm-borda`, `--mm-acao`, `--mm-rec`, escalas `--mm-espaco-1..10`, `--mm-raio-*`, `--mm-sombra-*`, `--mm-movimento-*` (respeita `prefers-reduced-motion`).
- Event (por evento): `--evento-superficie|grafismo|controle|texto|profundo`, `--on-evento`, `--font-evento`, `--evento-capa` (URL assinada), `--evento-logo`. Dia/noite resolvidos no tema.
- Admin: `--adm-linha`, `--adm-cabecalho`, `--adm-status-{ok,aviso,erro,info}`, densidade compacta.
- Breakpoints: 320/375/390/430 (convidado, coluna única), 768 (tablet), 1024/1440/1920 (admin e painel em grid; convidado centrado com largura máxima, não uma coluna estreita num mar vazio).

## 3. Contratos de dados (migrations aditivas, nada destrutivo)
- `event_themes(event_id pk→events, preset text, colors jsonb, font text, welcome_message text, qr_style text, decor jsonb, updated_at)` — CHECKs de formato (hex), tamanho de mensagem, fonte na lista, `qr_style` enum. RLS: leitura por host/membro/master (e prévia do convite via RPC segura já existente `event_preview`, estendida com o tema); escrita só pelo host **antes do bloqueio de edição** (regra de revelação).
- `event_assets(id, event_id, kind 'logo'|'cover', storage_path, mime, bytes, width, height, created_by)` + bucket **`event-branding`** privado; leitura por URL assinada de curta duração servida só a quem vê o evento; limites de MIME (png/jpeg/webp), tamanho e dimensões validados em RPC + policy; sem SVG de usuário (vetor XSS).
- `platform_roles(user_id, role 'master'|'support'|'auditor', granted_by, granted_at, revoked_at)` + `is_master()` passa a exigir linha ativa **e** claim; provisionamento do primeiro master por script de operador com `service_role` fora do app (registra em `audit_logs`), sem credencial padrão.
- `audit_logs` (já existe) estendida: `actor_role`, `reason` obrigatório para ações sensíveis, `target_type/target_id`; imutável (sem UPDATE/DELETE).
- `platform_settings(key, value jsonb, updated_by)` e `feature_flags(key, enabled, rollout jsonb)`: leitura pública só do necessário; escrita só master.
- Analytics: **views/RPCs agregadas** (security definer, só master) sobre tabelas reais — eventos, participantes, fotos, falhas de upload, revelações pendentes/atrasadas, bytes em Storage. Nenhuma métrica inventada; vazio/erro/sem permissão são estados explícitos.
- Acesso a fotos privadas por admin: **excepcional** — RPC `admin_request_photo_access(photo, reason)` grava auditoria antes de assinar URL de 60 s; dashboard nunca lista miniaturas.

## 4. Permissões e estados
Papéis: convidado (anônimo), organizador (Google, dono do evento), master/support/auditor (linha em `platform_roles` + claim). Master não é organizador comum: rotas `/master/**` validam papel **no servidor** (route handler/RSC + RLS), nunca por URL, localStorage ou e-mail fixo. Ações destrutivas: confirmação + justificativa + auditoria; separação de funções (support não altera configurações; só master; auditor só lê).
Estados do evento: rascunho → ativo → encerrado → revelado; edição de tema/revelação bloqueada a partir do bloqueio já definido na v1.

## 5. Plano de entrega (ordem)
1. Baseline e auditoria UX/UI com screenshots (8 larguras, todas as rotas/estados) → inventário com severidade.
2. DS v2 (tokens, componentes, docs em `/design`) + layouts responsivos (corrigir "Evento criado": coluna larga em desktop, título sem quebra ruim, URL em campo com copiar).
3. Migrations v2 + pgTAP (themes, assets, roles, audit, settings, flags, analytics) — aplicar **local**; remoto só após validar impacto/ambiente.
4. Event Studio (criação, personalização com prévia em tempo real, gestão do evento).
5. Master Admin (12 módulos, dashboard real).
6. Testes (unit, integração, E2E, RLS, autorização, upload, responsivo, a11y), revisão independente A1–A5, preview Vercel. **Sem promoção** enquanto a homologação v1 estiver pendente ou houver falha crítica.
