# 04 · Avaliação de motor/modelo

> **Nenhum motor foi selecionado nem integrado.** O código depende apenas da interface `FaceEngine` (`supabase/functions/_shared/face-engine.ts`); o padrão é `DisabledFaceEngine`. `FakeFaceEngine` existe só para testes e não analisa rostos. As linhas abaixo são critérios e uma shortlist para avaliação — **não foram verificadas nesta sessão** (sem acesso de rede a fornecedores) e precisam de confirmação documental (licença, DPA, preços vigentes) antes de qualquer decisão.

## 1. Critérios eliminatórios
1. Licença comercial comprovada **do software e dos pesos** (muitos pesos públicos de reconhecimento são só para pesquisa — ex.: modelos treinados em bases de uso não comercial).
2. Sem retenção nem treinamento com dados enviados; DPA assinado; região compatível com o RIPD.
3. Saída mínima: comparação 1:1 referência × foto (ou embedding efêmero) sem guardar galeria.
4. Exclusão verificável e logs sem imagem.

## 2. Shortlist a avaliar
| Opção | Tipo | Pontos a verificar |
|---|---|---|
| A. API gerenciada de grande provedor de nuvem com operação "compare faces" 1:1 e sem coleção persistente | serviço | DPA e região (há região em São Paulo em alguns provedores), custo por imagem, garantias de não retenção, termos de uso para reconhecimento facial (alguns restringem casos de uso) |
| B. Modelo próprio em CPU/GPU (detector + alinhamento + embedding) servido num container isolado | auto-hospedado | licença dos **pesos** (eliminatório), custo de infraestrutura, p95 por foto, viés |
| C. Processamento no aparelho (WebAssembly/WebGPU) | local | peso do modelo no PWA, bateria/memória em celulares de entrada, iOS Safari; **não dispensa base legal** (rostos de terceiros continuam sendo processados) |

Observação: MediaPipe Face Detection/Landmarker detecta rostos, mas **não** oferece identificação/verificação; serviria só como pré-filtro (contar rostos), como hoje faz o `FaceDetector` do navegador quando existe.

## 3. Protocolo de benchmark (a executar)
- Conjunto: adultos voluntários com consentimento específico para teste; nunca fotos reais de produção. Variações: frontal, perfil, pouca luz, oclusão, grupo, selfie Google recortada (96→640 px), câmera frontal, rostos parecidos.
- Tamanhos: eventos de 100, 500 e 3.000 fotos; 10, 50 e 200 participantes opt-in.
- Métricas: precision@K, recall, FPR, FNR, latência p50/p95 por foto e por job, custo por evento; segmentação por condição de captura. Sem inferir atributos demográficos automaticamente (fairness avaliada por recortes declarados pelos voluntários, com consentimento).
- Regra de decisão: priorizar **precisão** (falso positivo em evento íntimo é dano de privacidade). Limiar `probable`/`review` fixado só após o benchmark e versionado em `FaceEngine.version`.
- Ataques: referência de celebridade, foto de outro convidado, avatar de grupo, imagem editada, tentativa de enumeração (rate limits já existem: 10 consentimentos/h, 10 referências/h, 6 buscas/h).

## 4. Custo (fórmula do plano, sem números)
`custo_por_evento = processamento_fotos_e_faces + buscas_dos_convidados + armazenamento_transitório + egress + retries + observabilidade`. Na estratégia A (on-demand), cada busca reprocessa as fotos elegíveis: custo ≈ participantes_opt_in × fotos_elegíveis × custo_por_comparação. Indexar o evento (estratégia B) reduz custo mas é tratamento biométrico de todos os rostos — proibido sem aprovação específica.

## 5. Status
| Item | Situação |
|---|---|
| Interface `FaceEngine` versionada | **feito** (unit) |
| Motor de teste isolado (`allow: true` obrigatório) | **feito** |
| Fornecedor/modelo escolhido | **não** |
| Licença/DPA verificados | **não** |
| Benchmark de qualidade/custo/latência | **não executado** |
| Avaliação de viés | **não executada** |
