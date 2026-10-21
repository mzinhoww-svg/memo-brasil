"""Semente ÚNICA do backlog (gera backlog.json na primeira vez). Depois disso o JSON é a fonte de verdade:
editem docs/backlog/backlog.json e rodem `python3 docs/backlog/tools/backlog.py`. Não rode este arquivo de novo."""
import json, sys, os
OUT = os.path.join(os.path.dirname(__file__), "..", "backlog.json")
if os.path.exists(OUT) and "--force" not in sys.argv:
    sys.exit("backlog.json já existe; não recrio itens (use edição direta).")

C_REV, C_AUD, C_FIX, C_PREV = "0e818dd", "7e0f9ec", "ac290ea", "3a8bf89"
items = []
def it(id, type, title, epic, prio, status, deps=(), origin="REA", accept=(), files=(), tests=(), evidence=(), commit=None, env=None, parent=None, desc=""):
    items.append(dict(id=id, type=type, title=title, description=desc or title, epic=epic, parent=parent, priority=prio, status=status,
        dependencies=list(deps), origin=origin, acceptance=list(accept), files=list(files), tests=list(tests), evidence=list(evidence), commit=commit, environment=env))

epics = {
 "EP-01": "Eventos e convites", "EP-02": "Captura, fotos e moderação", "EP-03": "Revelação programada",
 "EP-04": "Design system e experiência", "EP-05": "PWA e offline", "EP-06": "Segurança e papéis",
 "EP-07": "Qualidade e testes", "EP-08": "Prontidão para o Supabase", "EP-09": "Fase Supabase (exclusivo do backend)", "EP-10": "Governança e release",
}
for k, v in epics.items(): it(k, "EPIC", v, k, "P1" if k in ("EP-03", "EP-10") else "P2", "DONE" if k in ("EP-01", "EP-02", "EP-04") else ("DEFERRED" if k == "EP-09" else "IN_PROGRESS"), origin="projeto", accept=[f"Todos os itens do epic {k} DONE, DEFERRED ou CANCELLED com justificativa"])
LOCAL = "local (build de produção, Chromium)"

# ---------- EP-01 ----------
it("FT-001","FEATURE","Criar evento (wizard de 6 passos)","EP-01","P1","DONE",origin="REA F-13..F-21",accept=["Nome, categoria, término ≥30 min, revelação, câmera/cor, convidados e fotos por pessoa","Mensagens de erro dizem o que fazer"],files=["web/src/features/events/wizard.tsx","web/src/features/events/service.ts"],tests=["web/src/features/features.test.ts","web/e2e/flows.spec.ts"],evidence=["docs/qa/TRACEABILITY-MATRIX.md"],commit=C_REV,env=LOCAL)
it("FT-002","FEATURE","Convite por código, link e QR (e QR por mesa)","EP-01","P1","DONE",origin="REA F-11,F-12,F-24,F-25",files=["web/src/features/invitations/","web/src/app/painel/[id]/qr/page.tsx"],tests=["web/src/domain/domain.test.ts","web/src/features/invitations/qr.test.ts","web/e2e/flows.spec.ts"],evidence=["docs/qa/screenshots/390-dia-qr.png"],commit=C_FIX,env=LOCAL,accept=["Código de 8 caracteres sem 0/O/1/I/L","Link /e/CODE?mesa=…"])
it("FT-003","FEATURE","Entrar no evento (código/link) com identidade local","EP-01","P1","DONE",origin="REA F-05,F-06",files=["web/src/features/participants/service.ts","web/src/app/e/[code]/page.tsx"],tests=["web/src/features/features.test.ts"],evidence=["docs/qa/FINAL-AUDIT.md"],commit=C_FIX,env=LOCAL,accept=["Rejeita código inválido, evento encerrado e lotado","Entradas simultâneas não passam da capacidade"])
it("FT-004","FEATURE","Painel do organizador (visão geral, conteúdo, convidados, momentos, QR, configurações, downloads)","EP-01","P1","DONE",origin="REA F-34,F-36; DS AdminNav",files=["web/src/app/painel/"],tests=["web/e2e/flows.spec.ts","web/e2e/a11y.spec.ts"],evidence=["docs/qa/screenshots/1440-dia-painel-visao-geral.png"],commit=C_REV,env=LOCAL,accept=["Só o organizador do evento abre o painel (contrato can())"])
it("FT-005","FEATURE","Capacidade, fotos por pessoa e regra de preço (sem cobrança)","EP-01","P2","DONE",origin="REA F-21,F-22",files=["web/src/domain/pricing.ts","web/src/domain/options.ts"],tests=["web/src/domain/domain.test.ts"],commit=C_FIX,env=LOCAL,accept=["≤10 grátis; >10 mostra aviso de demonstração e não cobra"])
it("FT-006","FEATURE","Onboarding de propósito do evento","EP-01","P3","BACKLOG",origin="REA F-07",accept=["Escolha de propósito reaproveita as categorias","Pulável"],desc="A categoria já existe no wizard; falta a tela de propósito no primeiro acesso.")
it("FT-007","FEATURE","Capa do convite por imagem (upload e recorte)","EP-01","P3","BACKLOG",origin="REA F-20",accept=["Upload local com recorte","Validação de tipo e tamanho"],desc="Hoje a identidade do evento é paleta + fonte (kit). Capa por imagem depende de decisão de produto.")
it("FT-008","FEATURE","Encerrar agora, estender término e excluir evento","EP-01","P1","DONE",origin="REA F-36",files=["web/src/features/events/service.ts","web/src/app/painel/[id]/configuracoes/page.tsx"],tests=["web/src/features/features.test.ts","web/e2e/flows.spec.ts"],commit=C_FIX,env=LOCAL,accept=["Álbum encerrado com fotos não reabre","Excluir exige confirmação e apaga em cascata"])

# ---------- EP-02 ----------
it("FT-010","FEATURE","Câmera web (virar, rolo, permissão, fallback por arquivo)","EP-02","P1","DONE",origin="REA F-26",files=["web/src/app/e/[code]/(app)/postar/page.tsx"],tests=["web/e2e/flows.spec.ts"],evidence=["docs/qa/screenshots/390-dia-postar.png"],commit=C_FIX,env=LOCAL,accept=["Permissão negada mostra caminho alternativo","Última foto do rolo mostra a confirmação"])
it("TK-010a","TASK","Zoom 1×/2× via constraints do track (onde suportado)","EP-02","P3","BACKLOG",deps=["FT-010"],origin="REA F-26",parent="FT-010",accept=["Chips só aparecem quando track.getCapabilities().zoom existe"],tests=["a criar: E2E com câmera sintética + teste unitário do helper"])
it("FT-011","FEATURE","Rolo limitado por pessoa (cliente) com exclusão mútua","EP-02","P1","DONE",origin="REA F-28",files=["web/src/lib/lock.ts","web/src/features/photos/service.ts"],tests=["web/src/features/features.test.ts","web/src/lib/lock.test.ts"],commit=C_AUD,env=LOCAL,accept=["12 postagens simultâneas = rolo"])
it("FT-012","FEATURE","Reações (1 por pessoa/foto) e Quem reagiu","EP-02","P2","DONE",origin="REA F-32",files=["web/src/domain/photo.ts","web/src/features/photos/components.tsx"],tests=["web/src/domain/domain.test.ts","web/e2e/flows.spec.ts"],commit=C_FIX,env=LOCAL)
it("FT-013","FEATURE","Editor de fotos (desenho, texto, borracha, colagem, desfazer)","EP-02","P2","DONE",origin="REA F-33",files=["web/src/features/photos/editor.tsx","web/src/domain/collage.ts"],tests=["web/src/domain/collage.test.ts","web/e2e/flows.spec.ts"],commit=C_FIX,env=LOCAL,accept=["Concluir baixa a versão editada (decisão D10)"])
it("FT-014","FEATURE","Exportar álbum (ZIP) e lista (CSV) e baixar foto","EP-02","P2","DONE",origin="REA F-34",files=["web/src/features/admin/export.ts"],tests=["web/src/features/admin/export.test.ts","web/e2e/flows.spec.ts"],commit=C_FIX,env=LOCAL)
it("FT-015","FEATURE","Compartilhar fotos pelo Web Share","EP-02","P3","BACKLOG",origin="REA F-35",accept=["navigator.share com arquivos quando suportado; fallback para baixar"])
it("FT-016","FEATURE","Moderação (pedido de remoção, ocultar, destacar, remover)","EP-02","P1","DONE",origin="decisão de produto; DS Tabs/CountBadge",files=["web/src/app/painel/[id]/conteudo/page.tsx","web/src/features/admin/service.ts"],tests=["web/e2e/flows.spec.ts"],commit=C_FIX,env=LOCAL)
it("FT-017","FEATURE","Fotos e estado locais em IndexedDB (cascata, migração versionada)","EP-02","P1","DONE",origin="requisito do pedido",files=["web/src/repositories/"],tests=["web/src/repositories/repositories.test.ts"],commit=C_REV,env=LOCAL,accept=["Migração v1→v2 converte eventos antigos"])

# ---------- EP-03 (novo) ----------
it("FT-030","FEATURE","Contrato de revelação programada","EP-03","P0","DONE",origin="requisito novo (correção de escopo)",accept=["Campos reveal_enabled, reveal_at, timezone, reveal_status tipados","Estado = f(now, reveal_at), nunca só timer"],commit=C_REV,env=LOCAL)
it("US-030a","USER_STORY","Como organizador, quero que o evento tenha revelação opcional com data, hora e fuso","EP-03","P0","DONE",parent="FT-030",origin="requisito novo",deps=["FT-030"],accept=["Desligada = fotos na hora","Ligada exige reveal_at"],commit=C_REV,env=LOCAL)
it("TK-030a1","TASK","Domínio de revelação (status, validação, travas, contagem, fuso)","EP-03","P0","DONE",parent="US-030a",files=["web/src/domain/reveal.ts"],tests=["web/src/domain/reveal.test.ts"],evidence=["web/src/domain/reveal.test.ts"],commit=C_REV,env=LOCAL,accept=["Fuso Cuiabá −4, São Paulo −3, Lisboa com DST","Fronteira now===reveal_at é revelada"])
it("TK-030a2","TASK","Migração v2 do IndexedDB (revealTiming → novo contrato) e tipos do evento","EP-03","P0","DONE",parent="US-030a",deps=["TK-030a1"],files=["web/src/repositories/indexeddb/index.ts","web/src/domain/event.ts"],tests=["web/src/repositories/repositories.test.ts"],commit=C_REV,env=LOCAL)
it("TK-030a3","TASK","Serviços: criar com revelação, updateReveal com travas, reconcileReveal idempotente","EP-03","P0","DONE",parent="US-030a",deps=["TK-030a1"],files=["web/src/features/events/service.ts","web/src/features/events/reveal-input.ts"],tests=["web/src/features/features.test.ts"],commit=C_REV,env=LOCAL)
it("FT-031","FEATURE","Configuração pelo organizador","EP-03","P0","DONE",deps=["FT-030"],origin="requisito novo; DS Field/OptionGroup",commit=C_REV,env=LOCAL)
it("US-031a","USER_STORY","Como organizador, quero ligar, desligar, escolher data/hora/fuso, ver o resumo e pré-visualizar","EP-03","P0","DONE",parent="FT-031",deps=["TK-030a3"],accept=["Resumo no fuso do evento","Prévia mostra a tela do convidado","Após a revelação não altera"],commit=C_REV,env=LOCAL)
it("TK-031a1","TASK","RevealForm (wizard passo 3) e Select do kit","EP-03","P0","DONE",parent="US-031a",files=["web/src/features/events/RevealForm.tsx","web/src/components/memoriesmt/Select.tsx"],tests=["web/e2e/reveal.spec.ts"],commit=C_REV,env=LOCAL)
it("TK-031a2","TASK","RevealSettings no painel (salvar, travas, prévia)","EP-03","P0","DONE",parent="US-031a",deps=["TK-031a1"],files=["web/src/features/events/RevealSettings.tsx"],tests=["web/e2e/reveal.spec.ts"],evidence=["docs/qa/screenshots/revelacao-390-dia-config.png"],commit=C_REV,env=LOCAL)
it("FT-032","FEATURE","Experiência do convidado: espera, contagem, revelação e galeria","EP-03","P0","DONE",deps=["FT-030"],origin="requisito novo",commit=C_REV,env=LOCAL)
it("US-032a","USER_STORY","Como convidado, quero fotografar sem ver fotos bloqueadas e ver a espera com contagem","EP-03","P0","DONE",parent="FT-032",deps=["TK-030a1"],accept=["Nenhuma foto na galeria antes da revelação, nem as próprias","Contagem no fuso do evento","Mostra quantidade quando autorizado"],tests=["web/e2e/reveal.spec.ts","web/src/domain/domain.test.ts"],evidence=["docs/qa/screenshots/revelacao-390-dia-espera.png"],commit=C_REV,env=LOCAL)
it("US-032b","USER_STORY","Como convidado, quero que a galeria abra sozinha na hora, mesmo offline, sem recarregar","EP-03","P0","DONE",parent="FT-032",deps=["US-032a"],accept=["Transição de revelação","Navegação e estado preservados","Funciona offline e ao reabrir o app depois do horário"],tests=["web/e2e/reveal.spec.ts"],evidence=["docs/qa/screenshots/revelacao-390-noite-transicao.png"],commit=C_REV,env=LOCAL)
it("TK-032a","TASK","WaitingReveal, RevealTransition e integração no layout do convidado","EP-03","P0","DONE",parent="US-032a",files=["web/src/features/reveal/","web/src/app/e/[code]/(app)/layout.tsx"],tests=["web/e2e/reveal.spec.ts","web/e2e/reveal-visual.spec.ts"],commit=C_REV,env=LOCAL)
it("US-032c","USER_STORY","Modo sem revelação: fotos aparecem na hora","EP-03","P0","DONE",parent="FT-032",tests=["web/e2e/reveal.spec.ts"],evidence=["docs/qa/screenshots/revelacao-390-dia-sem-revelacao.png"],commit=C_REV,env=LOCAL)
it("FT-033","FEATURE","Casos especiais de revelação","EP-03","P0","DONE",deps=["TK-030a3"],origin="requisito novo",accept=["Horário já ultrapassado","Evento encerrado antes da revelação","Alteração de data e de fuso","Entrada depois da revelação","App fechado na hora","Offline e reconexão","Foto removida","Dois participantes","Organizador após a revelação"],tests=["web/src/features/features.test.ts","web/e2e/reveal.spec.ts"],commit=C_REV,env=LOCAL)
it("FT-034","FEATURE","Papéis: organizador × administrador master (contrato)","EP-03","P0","DONE",origin="requisito novo",files=["web/src/domain/roles.ts","web/src/app/master/page.tsx","docs/architecture/ROLES.md"],tests=["web/src/domain/reveal.test.ts","web/e2e/reveal.spec.ts"],commit=C_REV,env=LOCAL,accept=["Sem senha fixa nem parâmetro de URL para master","Organizador só administra os próprios eventos"])
it("FT-035","FEATURE","Documentar a revelação no servidor (permissões, storage privado, URLs assinadas, idempotência, sincronização)","EP-03","P1","DONE",origin="requisito novo",files=["docs/supabase/INTEGRATION-PLAN.md"],evidence=["docs/supabase/INTEGRATION-PLAN.md §4.1"],commit=C_REV)
it("FT-036","FEATURE","Validação visual e de acessibilidade da revelação (dia/noite, mobile/desktop)","EP-03","P1","DONE",deps=["FT-032"],tests=["web/e2e/reveal-visual.spec.ts"],evidence=["docs/qa/screenshots/revelacao-1440-noite-galeria.png"],commit=C_REV,env=LOCAL)
it("FT-037","FEATURE","Validar a revelação no preview Vercel","EP-03","P1","TESTING",deps=["FT-036"],origin="requisito novo",accept=["Preview no commit atual","Smoke remoto cobre revelação com relógio do navegador"],tests=["web/e2e/remote.spec.ts"],env="preview Vercel (protegido)")

# ---------- EP-04 ----------
it("FT-020","FEATURE","Tokens, temas Dia/Noite, fontes locais e logos oficiais","EP-04","P1","DONE",origin="DS-01..DS-04",files=["web/src/styles/tokens.css","web/src/app/globals.css"],tests=["web/e2e/visual.spec.ts"],evidence=["docs/qa/VISUAL-VALIDATION.md"],commit=C_FIX,env=LOCAL)
it("FT-021","FEATURE","Biblioteca de componentes MemoriesMT (22 + Select, Sheet, KnownPeople)","EP-04","P1","DONE",origin="DS-05",files=["web/src/components/memoriesmt/"],tests=["web/src/components/memoriesmt/components.test.tsx","web/e2e/visual.spec.ts"],evidence=["paridade de 15 estilos com os previews do kit"],commit=C_REV,env=LOCAL)
it("FT-022","FEATURE","Regras visuais e voz do kit (sem sombra/gradiente/emoji, pt-BR)","EP-04","P1","DONE",origin="DS-06,DS-07",tests=["web/e2e/a11y.spec.ts"],evidence=["docs/qa/FINAL-AUDIT.md"],commit=C_REV,env=LOCAL)
it("BG-020","BUG","theme_color do manifest fixo (não acompanha Noite)","EP-04","P3","BACKLOG",origin="auditoria",accept=["Meta theme-color por esquema já existe; manifest dinâmico por tema não é possível: documentar ou aceitar"])
it("BG-021","BUG","Nome de evento longo a 375 px não medido","EP-04","P2","READY",origin="auditoria",accept=["Evento com 60 caracteres sem rolagem horizontal em 375 px nos dois temas"],tests=["a criar: e2e/visual com título de 60 caracteres"],files=["web/src/styles/app.css"])
it("BG-022","BUG","Sem validação em Safari/iOS e Firefox","EP-04","P2","READY",origin="auditoria",accept=["Projetos WebKit e Firefox no Playwright rodam o smoke e o fluxo de convidado","Registrar o que falhar"],files=["web/playwright.config.ts"],deps=[])

# ---------- EP-05 ----------
it("FT-040","FEATURE","PWA instalável (manifest, ícones, maskable)","EP-05","P1","DONE",origin="requisito do pedido",files=["web/src/app/manifest.ts","web/public/pwa/"],tests=["web/e2e/smoke.spec.ts","web/e2e/pwa.spec.ts"],commit=C_AUD,env=LOCAL)
it("FT-041","FEATURE","Service worker versionado por deploy, shell offline e dados em IndexedDB","EP-05","P1","DONE",origin="requisito do pedido",files=["web/public/sw.js","web/src/lib/register-sw.tsx"],tests=["web/e2e/pwa.spec.ts"],commit=C_AUD,env=LOCAL)
it("BG-040","BUG","Rota dinâmica nunca visitada não abre offline","EP-05","P2","BACKLOG",origin="auditoria",accept=["Shell genérico para /e/* e /painel/* servido offline","Teste E2E com rota não visitada"],files=["web/public/sw.js"])
it("BG-041","BUG","Atualização do SW num segundo deploy não verificada","EP-05","P2","BACKLOG",origin="auditoria",accept=["Dois builds consecutivos: cache antigo some e o novo assume"])
it("BG-042","BUG","Lógica do SW sem teste unitário","EP-05","P3","BACKLOG",origin="auditoria",accept=["Estratégias testadas em ambiente de worker simulado"])

# ---------- EP-06 ----------
it("FT-050","FEATURE","Headers de segurança e CSP em produção","EP-06","P1","DONE",origin="auditoria",files=["web/next.config.ts"],tests=["web/e2e/flows.spec.ts","web/e2e/remote.spec.ts"],commit=C_AUD,env="preview Vercel + local")
it("BG-050","BUG","CSP com unsafe-inline","EP-06","P3","BACKLOG",origin="auditoria",accept=["Nonce por requisição em script e estilo inline"])
it("BG-051","BUG","Dependências sem auditoria de vulnerabilidades","EP-06","P2","READY",origin="requisito de auditoria",accept=["npm audit sem alta/crítica em produção, ou exceção documentada"],files=["web/package.json"])
it("FT-051","FEATURE","Identidades locais e 'Continuar como'","EP-06","P1","DONE",origin="auditoria",tests=["web/src/repositories/repositories.test.ts","web/e2e/flows.spec.ts"],commit=C_AUD,env=LOCAL)

# ---------- EP-07 ----------
it("FT-060","FEATURE","Suíte unitária (domínio, repositórios, serviços, componentes)","EP-07","P1","DONE",origin="requisito do pedido",tests=["131 testes Vitest"],evidence=["npm test: 131 passed"],commit=C_REV,env=LOCAL)
it("FT-061","FEATURE","Suíte E2E (fluxos, PWA, visual, paridade, axe, revelação)","EP-07","P1","DONE",origin="requisito do pedido",tests=["50 testes Playwright (4 remotos pulados sem URL)"],evidence=["npx playwright test: 46 passed"],commit=C_REV,env=LOCAL)
it("BG-060","BUG","Sem testes de useEventData e usePhotoUrls","EP-07","P2","BACKLOG",origin="auditoria",accept=["Hooks testados com repositório em memória"],files=["web/src/features/app/hooks.ts"])
it("BG-061","BUG","axe só em 390 px","EP-07","P2","BACKLOG",origin="auditoria",accept=["axe também em 375, 768 e 1440"],files=["web/e2e/a11y.spec.ts"])
it("BG-062","BUG","Evento grande (milhares de fotos) não medido","EP-07","P2","BACKLOG",origin="auditoria",accept=["Agora com 7.200 fotos mantém interação fluida; medir e registrar"])

# ---------- EP-08 ----------
it("FT-070","FEATURE","Plano de integração Supabase (ERD, RLS, Auth, Storage, realtime, migração, conflitos)","EP-08","P1","DONE",origin="requisito do pedido",files=["docs/supabase/INTEGRATION-PLAN.md"],evidence=["docs/supabase/INTEGRATION-PLAN.md"],commit=C_REV)
it("FT-071","FEATURE","Contratos de repositório e serviços atrás de interfaces","EP-08","P1","DONE",origin="requisito do pedido",files=["web/src/repositories/types.ts","web/src/lib/services/index.ts"],tests=["web/src/repositories/repositories.test.ts"],commit=C_REV,env=LOCAL)
it("BG-070","BUG","Exclusão em cascata não é atômica","EP-08","P2","BACKLOG",origin="auditoria",accept=["Cascata numa transação IndexedDB"],files=["web/src/repositories/index.ts"])
it("BG-071","BUG","Outbox de sincronização offline ainda é só desenho","EP-08","P1","BACKLOG",origin="auditoria",deps=["AUD-001"],accept=["Interface Outbox com testes e implementação local"],desc="Necessária antes de ligar upload remoto.")

# ---------- EP-10 ----------
it("AUD-001","TASK","Auditoria independente pré-Supabase (docs/audit/00..11)","EP-10","P0","READY",deps=["FT-037"],origin="auditoria",accept=["12 relatórios + evidências","Registro de achados classificado P0–P3","Release gate GO/CONDITIONAL/NO-GO","Achados consolidados neste backlog sem duplicar"],files=["docs/audit/"])
it("REL-001","TASK","Confirmar destino Vercel (newmemocuiaba) e promover o preview a produção","EP-10","P1","BLOCKED",origin="auditoria",accept=["Confirmação explícita de Aurimar","Commit e URL de produção verificados"],desc="Bloqueado: o destino foi inferido e a promoção exige autorização.")
it("REL-002","TASK","Manter preview como ambiente de validação e registrar commit/URL","EP-10","P1","TESTING",deps=["FT-037"],env="preview Vercel (protegido)",accept=["Preview no commit mais recente","Acesso por link temporário oficial"])

# ---------- EP-09 ----------
for _id,t,d in [
 ("FT-080","Auth: Google (organizador) e anônima (convidado)",["AUD-001"]),("FT-081","Web Push real e permissão de notificações",["AUD-001"]),
 ("FT-082","Esquema, RLS e testes de RLS",["AUD-001"]),("FT-083","Revelação no servidor: reveal_due_events (pg_cron), idempotente, e avisos agendados",["AUD-001","FT-082"]),
 ("FT-084","Realtime e sincronização offline-first entre aparelhos",["AUD-001","BG-071","FT-082"]),("FT-085","Storage privado e URLs assinadas",["AUD-001","FT-082"]),
 ("FT-086","Pagamento, entitlements e Memo+ (gateway)",["AUD-001"]),("FT-087","Excluir conta e LGPD",["AUD-001","FT-082"]),
 ("FT-088","Administrador master real (claim, middleware, audit_logs)",["AUD-001","FT-080","FT-082"]),("FT-089","Migração local → nuvem",["AUD-001","FT-080","FT-082","FT-085"])]:
    it(_id,"FEATURE",t,"EP-09","P1","DEFERRED",deps=d,origin="fase Supabase",accept=["Depende do backend; não iniciar antes do release gate"])

# ---------- Requisitos e cobertura ----------
req = []
def r(id, src, text, covers=None, excl=None): req.append(dict(id=id, source=src, text=text, covers=covers or [], exclusion=excl))
REA = {"F-01":("Splash",None,"Substituído pela capa do kit (decisão D11)"),"F-02":("3 slides de intro",None,"Substituído por capa e frase de assinatura (D11)"),
 "F-03":("Entrar com Google",["FT-080"],None),"F-04":("E-mail e senha",None,"Inativo no original; sem evidência de funcionamento"),
 "F-05":("Convidado por código",["FT-003"],None),"F-06":("Nome do usuário",["FT-003"],None),"F-07":("Propósito",["FT-006"],None),
 "F-08":("Home com eventos",["FT-004"],None),"F-09":("Álbuns",["FT-032"],None),"F-10":("Abas FILMES/SCRAPBOOK",None,"Substituído por Agora/Explorar/Você do kit; Scrapbook era placeholder"),
 "F-11":("Entrar com código",["FT-002"],None),"F-12":("Deep link",["FT-002"],None),"F-13":("Wizard de criação",["FT-001"],None),"F-14":("Permissão de notificações",["FT-081"],None),
 "F-15":("Nome do evento",["FT-001"],None),"F-16":("Categoria",["FT-001"],None),"F-17":("Término ≥30 min",["FT-001"],None),"F-18":("Revelação",["FT-030","FT-031","FT-032","FT-033"],None),
 "F-19":("Estilo de câmera",["FT-010"],None),"F-20":("Capa do convite",["FT-007"],None),"F-21":("Capacidade e fotos por pessoa",["FT-005"],None),"F-22":("Preço",["FT-005","FT-086"],None),
 "F-23":("Paywall Memo+",["FT-086"],None),"F-24":("Evento criado e compartilhar",["FT-002"],None),"F-25":("Convite por QR",["FT-002"],None),"F-26":("Câmera",["FT-010","TK-010a"],None),
 "F-27":("Estilos aplicados à foto",["FT-010"],None),"F-28":("Rolo limitado",["FT-011"],None),"F-29":("Sync offline-first",["FT-017","BG-071","FT-084"],None),"F-30":("Galeria",["FT-032"],None),
 "F-31":("Revelação (gating)",["FT-032","FT-033"],None),"F-32":("Reações e Quem reagiu",["FT-012"],None),"F-33":("Editor de fotos",["FT-013"],None),"F-34":("Exportar álbum",["FT-014"],None),
 "F-35":("Compartilhar fotos",["FT-015"],None),"F-36":("Configurações do evento",["FT-004","FT-008"],None),"F-37":("Perfil, sair, excluir conta",["FT-051","FT-087"],None),"F-38":("Notificações",["FT-081","FT-083"],None)}
for k,(t,c,e) in REA.items(): r(k,"REA 02-FEATURE-INVENTORY",t,c,e)
DS = [("DS-01","Marca: logos oficiais, tamanhos mínimos, nome MemoriesMT",["FT-020"]),("DS-02","Tipografia: Bricolage + Instrument Serif locais",["FT-020"]),("DS-03","Temas Dia e Noite por tokens",["FT-020"]),
 ("DS-04","Tokens oficiais (Tailwind v4 adaptado)",["FT-020"]),("DS-05","Componentes do kit reutilizáveis",["FT-021"]),("DS-06","Regras visuais (sem sombra/gradiente/emoji, REC controlado, alvos 44 px)",["FT-022"]),("DS-07","Voz e nomenclatura (Agora, Explorar, Você)",["FT-022"])]
for k,t,c in DS: r(k,"MemoriesMT Design System v1",t,c)
RV = [("RV-01","Ativar/desativar revelação por evento",["FT-031"]),("RV-02","Data, horário e fuso",["FT-031"]),("RV-03","Resumo, alteração conforme estado e prévia",["FT-031"]),
 ("RV-04","Fotografar sem ver fotos bloqueadas; estado Aguardando revelação",["FT-032"]),("RV-05","Contagem regressiva no fuso configurado",["FT-032"]),("RV-06","Atualização automática e transição na hora",["FT-032"]),
 ("RV-07","Revelação desativada = visibilidade imediata",["FT-032"]),("RV-08","Casos especiais (9)",["FT-033"]),("RV-09","Modelagem reveal_enabled/reveal_at/timezone/reveal_status sem depender de timers",["FT-030"]),
 ("RV-10","Documentar revelação server-side",["FT-035"]),("RV-11","Papéis organizador × master sem senha fixa nem URL",["FT-034"]),("RV-12","Validação em browser, Dia/Noite, mobile/desktop, e preview Vercel",["FT-036","FT-037"])]
for k,t,c in RV: r(k,"correção de escopo 2026-10-21",t,c)
# itens EP-09 com os IDs referenciados acima
json.dump(dict(meta=dict(project="MemoriesMT", version=1, updated="2026-10-21", branch="feat/memoriesmt", workflow=["BACKLOG","READY","IN_PROGRESS","IN_REVIEW","TESTING","DONE"], extra=["BLOCKED","DEFERRED","CANCELLED"], rule="DONE exige implementação, testes, evidências e documentação atualizada."), epics=epics, items=items, requirements=req), open(OUT,"w"), ensure_ascii=False, indent=1)
print(len(items),"itens;",len(req),"requisitos")
