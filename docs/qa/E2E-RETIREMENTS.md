# Testes E2E retirados ou reescritos (Revela 2.0)

| Arquivo | Teste | Motivo | Cobertura substituta |
|---|---|---|---|
| web/e2e/produto.spec.ts | home mostra a linha de preço só do Grátis quando não há plano pago ativo | A abertura (Main) não tem mais a linha de preço "Grátis até 10 convidados." | `/precos local mostra só o Grátis...` no mesmo arquivo (preço, aviso "planos pagos voltam em breve") |
| web/e2e/produto.spec.ts | /precos: as 3 perguntas ("Como pago?", "E se passar do limite?", "Posso pedir reembolso?") e o link "Fale com a gente" | A tela de preços 30 é só h1, plano(s), aviso e botão "Montar câmera"; as perguntas de pagamento estão em /ajuda | `/ajuda é pública...` (perguntas e suporte por e-mail) |
| web/e2e/produto.spec.ts | rodapé nas rotas /precos e /ajuda | Só a abertura (/) tem rodapé; Preços e Ajuda são telas próprias sem `contentinfo` | `rodapé tem Termos...` (agora só em `/`, ausente no painel e no convite) |
| web/e2e/produto.spec.ts | cartão de mesa do QR: um cartão por mesa e a linha "Cada um tem N fotos. Revelamos..." | A tela 25 mostra um cartão em 4 modelos; o download por mesa vive na folha de download, e a linha do rolo não aparece mais no cartão | `QR das mesas: cartão com a redação do modelo...`; `qr-download.spec.ts` (SVG/PNG por mesa); `qr-copy.test.ts` (vitest) |
| web/e2e/studio-local.spec.ts | tema personalizado (paleta Oceano, `data-event-theme`, `--evento-superficie`) | Cores e fontes por evento foram removidas; a identidade é embalagem + filme + mensagem | `aparência: embalagem e mensagem valem na entrada do convidado...` |
| web/e2e/produto.spec.ts | home: 3 passos, "Grátis até 10 convidados." e CTA "Criar meu evento grátis" na abertura; "Minhas fotos"/"Agora" no /exemplo | Abertura nova (Main) com uma promessa e dois botões; o /exemplo não tem mais a aba "Minhas fotos" | `home mostra a proposta...` e `/exemplo: até 5 fotos...` |
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
