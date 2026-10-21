# 15 — Prontidão para reconstrução

| Área | Prontidão | Justificativa |
|---|---|---|
| Domínio e regras de evento | **Alta (85%)** | enums, fórmulas, erros e códigos extraídos do código (EST) |
| Modelo de dados | **Média-alta (75%)** | colunas reais; tipos/constraints/RLS inferidos |
| Fluxos e telas | **Média (65%)** | 7 telas observadas; 22 reconstruídas por texto/código |
| Design system | **Média-alta (70%)** | cores/raios/espaços/fontes verificados; medidas de componentes estimadas |
| Câmera/captura web | **Média (60%)** | comportamento claro; paridade de zoom/qualidade depende do navegador |
| Offline/sync | **Média (65%)** | lógica de fila conhecida; detalhes de retry não lidos |
| Notificações | **Média-baixa (45%)** | exige push/backend; sem alarme local web confiável |
| Pagamentos | **Baixa (30%)** | Play Billing sem equivalente; decisão de gateway pendente |
| Backend Supabase | **Não iniciado** (por design) | schema/RLS a projetar a partir de `08`/`09` |
| Marca/ativos | **Bloqueado** | ativos protegidos; criar identidade e imagens próprias |

**Geral: ~70% para iniciar o MVP P0.** Pode começar por E0–E3 do backlog sem bloqueios. Antes da etapa Supabase, resolver: (1) gateway de pagamento, (2) nome/marca próprios, (3) domínio para links, (4) política de revelação/privacidade (LGPD) e (5) conta de teste para fechar S-08…S-29.

## Riscos
Alto: pagamentos; push em iOS; legalidade de marca/ativos. Médio: qualidade de câmera web, cotas de IndexedDB. Baixo: UI/tipografia.
