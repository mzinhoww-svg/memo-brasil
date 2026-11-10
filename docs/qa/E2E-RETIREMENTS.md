# Testes E2E aposentados ou substituídos (Revela 2.0)

| Arquivo | Nome antigo | Motivo | Cobertura substituta |
|---|---|---|---|
| web/e2e/consent.spec.ts | organizador: caixas nascem desmarcadas; uma sem a outra não cria; as duas criam (alerta "Aceite os Termos...") | O consentimento do organizador agora é o diálogo "Antes de criar"; o botão Aceitar fica desabilitado até as duas caixas, sem alerta | Mesmo arquivo: "organizador: diálogo 'Antes de criar'..." (botão desabilitado com 0/1 caixa, habilitado com as 2) |
| web/e2e/consent.spec.ts | convidado: sem as duas confirmações não entra... (campo "Como te chamam na festa?", "Entrar e abrir a câmera") | Convidado agora usa "Seu nome", "Entrar e fotografar" e o diálogo "Antes de fotografar" | Mesmo arquivo: teste do convidado reescrito com a mesma intenção |
| web/e2e/home-exemplo.spec.ts | home não lista eventos; Meus eventos mostra os ativos com Painel | /eventos virou "Suas câmeras" (câmera em destaque, sem região "Ativos" nem link "Painel"); home tem "Minhas câmeras" | Mesmo arquivo: "...Minhas câmeras mostra a câmera ativa com acesso ao painel (QR)" |
| web/e2e/home-exemplo.spec.ts | home por teclado / ações visíveis / "Entrar com código" | Ações da home agora: Tenho um convite, Montar câmera, Experimentar câmera | Mesmo arquivo, nomes novos |
| web/e2e/a11y.spec.ts | axe nos 4 passos do assistente ("Passo N de 4") | Assistente tem 8 passos ("N/8") | Mesmo arquivo: "axe: 0 violações nos 8 passos..." |
| web/e2e/a11y.spec.ts | rota /design no teste de tema | Página /design não existe mais | Rotas /exemplo e /termos adicionadas ao teste de tema |
| web/e2e/revela-wizard.spec.ts | switch "Permitir baixar em alta" marcado no passo 7 | Opção escondida de propósito (sem efeito de download em alta) | Mesmo teste: confirma que o switch não é oferecido |
