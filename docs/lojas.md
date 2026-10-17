# Plano das lojas (iOS e App Store / Android e Google Play)

- Autor: Planejador · Data: 2026-10-13
- Cobre o item 12b. **Não implementar agora**: app nativo é fora do MVP; este documento só decide o caminho e mantém a API pronta.
- Valores de lojas e prazos são referências conhecidas até o conhecimento do autor e **devem ser reconferidos no momento da contratação** (as lojas mudam preços e regras).

## 1. Contexto do produto que pesa na decisão
- Duas experiências: **convidado** (câmera, álbum, sem cadastro) e **organizador** (painel; desktop first).
- Câmera ao vivo (`getUserMedia`) e push dependem de HTTPS; iOS só entrega push web com o app instalado na Tela de Início (iOS 16.4+).
- O produto é **conteúdo gerado por usuário (fotos de pessoas, inclusive menores)**: isso aciona regras específicas das lojas (moderação, denúncia, bloqueio).
- Não há compra dentro do app (pagamento e planos estão fora do escopo): sem a regra de 15–30% de comissão.

## 2. Opções

### A. PWA instalável (o que já existe, endurecido)
- O que é: manifest por evento + service worker + "Adicionar à Tela de Início".
- Prós: custo zero, uma base de código, atualização instantânea, **sem revisão de loja**, QR → abre direto.
- Contras: instalação manual e pouco descoberta (iOS exige o passo "Compartilhar → Adicionar"); push no iOS só instalado; sem presença nas lojas; câmera/armazenamento limitados em navegadores embutidos (Instagram/WhatsApp).
- Custo: R$ 0. Prazo: já existe; endurecimento = parte das frentes Push/CSS.

### B. Capacitor sobre esta web (casca nativa)
- O que é: empacotar a web atual em WebView nativo com plugins (Câmera, Push nativo APNs/FCM, Share, Filesystem).
- Prós: **reuso máximo** (~90%+ do código), push nativo confiável no iOS sem "instalar na Tela de Início", presença nas lojas, câmera nativa via plugin. Menor prazo e risco.
- Contras: ainda é WebView (desempenho de câmera menor que nativo puro); **Apple pode rejeitar app que é "só um site embrulhado" (diretriz 4.2, funcionalidade mínima)** — mitigado com push nativo, câmera nativa, compartilhamento e fluxo offline de upload; manter dois pipelines de build.
- Custo: contas das lojas (abaixo) + horas. Prazo estimado: **3–5 semanas** de uma pessoa até submissão (setup 1, câmera/push nativos 1–2, UGC/moderação/compliance 1, testes em aparelho e TestFlight 1, revisão 0,5–1).

### C. React Native / Expo (reescrita do cliente)
- Prós: experiência nativa, câmera de alto desempenho, ecossistema OTA (EAS Update). Contras: **reescrever o cliente do convidado e do painel**, duas bases de UI, bem mais caro e lento; só vale com requisito que a web não cumpra (ex.: upload em segundo plano robusto, filtros em tempo real).
- Custo: contas + EAS (plano gratuito/pago por build) + horas. Prazo: **2–4 meses**.

### D. Híbrida em etapas
PWA agora (MVP) → Capacitor para o **convidado** (o painel segue web, pois organizador usa desktop) → Expo só se houver demanda comprovada.

## 3. Decisão recomendada
**D: PWA no MVP; depois Capacitor, só para a experiência do convidado.** Razões: é o menor caminho que resolve a dor real (push confiável no iOS e descoberta), preserva a regra "troca atrás de interface" e a API única, e adia o custo de manter dois clientes. Gatilhos para sair da PWA: (1) taxa de instalação do PWA baixa ou queixas de push no iOS; (2) pedido de presença nas lojas; (3) necessidade de upload em segundo plano. **Não** escolher Expo sem evidência de que o Capacitor não basta.

## 4. Requisitos das lojas

### Apple (App Store)
- **Apple Developer Program**: US$ 99/ano; pessoa física ou organização (organização exige D-U-N-S e leva dias a semanas). Conta como organização é preferível para o nome do vendedor.
- App Store Connect: ícone 1024×1024, capturas por tamanho de tela (iPhone 6,7" e 6,5" no mínimo), descrição pt-BR, palavras-chave, categoria (Foto e Vídeo / Estilo de vida), URL de suporte, **URL da política de privacidade (obrigatória)**.
- **Privacy Nutrition Labels**: declarar dados coletados (nome do convidado, fotos, e-mail do organizador, identificadores de push) e finalidade; **App Tracking Transparency** não é necessário se não houver rastreio entre apps.
- **Conteúdo gerado por usuário (diretriz 1.2)**: filtro/moderação, mecanismo de **denúncia** de conteúdo, bloqueio de usuário abusivo, contato publicado e resposta em prazo. Já alinhado ao item 9 (ocultar, apagar, denunciar). Classificação etária: marcar "conteúdo gerado por usuário/acesso irrestrito à web" conforme o questionário atual; esperar faixa 12+ ou 17+ em função das respostas.
- Permissões com texto de finalidade em pt-BR (`NSCameraUsageDescription`, notificações); explicar por que a câmera.
- **Exclusão de conta dentro do app** (diretriz 5.1.1(v)): para o organizador com conta, o fluxo "exportar e apagar" do item 9 precisa estar acessível no app.
- **Sign in with Apple**: só exigido se houver login social de terceiros (ex.: Google); com link mágico apenas, **não** é exigido. (Mais um motivo para a 002 ficar em link mágico.)
- Push: certificado/chave APNs (.p8) pela conta de desenvolvedor.
- Revisão: tipicamente 1–3 dias por submissão; reprovações por 4.2 e por UGC são as mais prováveis; reservar 1–2 ciclos.

### Google (Play Store)
- **Conta Google Play Console**: taxa única **US$ 25**; verificação de identidade (e de organização, com D-U-N-S, para contas de organização).
- **Contas pessoais criadas após nov/2023: teste fechado obrigatório** (≥12 testadores por 14 dias consecutivos) antes de solicitar produção; contas de organização estão isentas. Isso soma ~2–3 semanas ao prazo se a conta for pessoal.
- Ficha: ícone 512×512, gráfico de recursos 1024×500, capturas, descrição, política de privacidade (URL), **formulário Data safety**, classificação de conteúdo (IARC), público-alvo (declarar não direcionado a crianças; atenção a "apelo a menores" por haver fotos de crianças em casamentos).
- Política de UGC do Google Play: moderação, denúncia in-app, remoção.
- **Exclusão de conta**: link de exclusão na ficha e fluxo in-app (política de Data deletion).
- Meta de API level vigente (exigência anual); Android App Bundle (.aab); assinatura do app (Play App Signing).
- Push: Firebase Cloud Messaging (projeto Firebase gratuito).
- Revisão: horas a poucos dias (novos desenvolvedores mais lentos).

### Comum / LGPD
- Política de privacidade e termos em pt-BR (Redator) publicados por URL pública, versão datada; **encarregado/contato** (DPO) indicado; base legal e retenção declaradas.
- Fotos de menores: tratar como dado de tratamento reforçado (LGPD art. 14): consentimento específico de responsável na prática via organizador; sem uso secundário; remoção expedita.
- Denúncia e moderação operando antes da submissão (não depois).

## 5. Custos estimados (recorrentes e únicos)

| Item | Valor | Obs. |
|---|---|---|
| Apple Developer Program | US$ 99/ano (~R$ 520/ano ≈ R$ 43/mês) | obrigatório para iOS |
| Google Play Console | US$ 25 uma vez (~R$ 130) | |
| Push (APNs/FCM) | R$ 0 | FCM gratuito |
| Capacitor | R$ 0 | open source |
| Expo EAS (se C) | grátis a ~US$ 19-99/mês | só se Expo |
| Mac para build iOS | R$ 0 se já houver (obrigatório Xcode) ou CI com macOS (cobrado por minuto) | verificar |
| Aparelhos de teste | variável | iOS real obrigatório para push/câmera |

**Impacto no teto de R$ 100/mês:** Apple ≈ R$ 43/mês amortizado. Somado a VPS/e-mail/backup, o teto fica apertado: **antes de contratar, registrar custo em STATUS.md e obter aprovação** (regra do orquestrador sobre gasto novo). O Android é desprezível.

## 6. Prazos (a partir do "vá" humano)

| Marco | Capacitor (recomendado) | Expo |
|---|---|---|
| Conta Apple (organização, D-U-N-S) | 1–3 semanas (pode rodar em paralelo, iniciar cedo) | idem |
| Conta Google (teste fechado, se pessoal) | 2–3 semanas | idem |
| Desenvolvimento do app | 3–5 semanas | 2–4 meses |
| Revisão + correções | 1–2 semanas | 1–2 semanas |
| **Total** | **~5–8 semanas** | **~3–5 meses** |

## 7. O que preparar já, sem implementar o app nativo
1. API estável e versionada (`/api/v1`), sem `?token=`, autenticação por cookie **e** por token Bearer de sessão para cliente nativo (compatível com 002).
2. Modelo de dados sem acoplamento ao navegador (nada de `localStorage` como fonte de verdade de identidade do convidado; id de convidado e segredo emitidos pelo servidor).
3. Rotas de **denúncia, ocultar, apagar, exportar e excluir conta** prontas (item 9) — são requisito de loja.
4. Política de privacidade/termos com URL pública e versionada.
5. Ícones e splash em alta resolução (Forja-CSS/Designer), 1024×1024 sem transparência para iOS.
6. Deep links/Universal Links: `/e/:id` abrindo no app quando instalado (assetlinks.json / apple-app-site-association) — decidir domínio definitivo antes.
7. Registrar em `docs/ACTIONS.md`: abertura das contas (decisão humana, gasto, D-U-N-S se organização).

## 8. Pergunta que precisa de decisão humana
Conta **pessoal ou organização** nas lojas (afeta prazo, nome do vendedor e o teste fechado do Google), e **nome/domínio definitivos** (afetam bundle id e Universal Links).
