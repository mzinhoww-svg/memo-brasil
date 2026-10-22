# MemoriesMT — entrega operacional com escopo fechado

Data de referência: 21/10/2026, America/Cuiaba. Solicitado por Aurimar: finalizar, disponibilizar para uso e evoluir pelo roadmap, sem estender o projeto indefinidamente.

## Decisão de entrega

Entregar primeiro a V2 operacional para eventos reais acompanhados pelo operador. Premissa deste corte: uso inicial assistido, sem checkout ou cobrança automática. Isto permite usar o produto enquanto monetização e aquisição evoluem. Não representa conclusão da plataforma comercial inteira.

Preservar a implementação existente de Design System, Studio, Master e Supabase. Corrigir somente falhas reproduzíveis e lacunas necessárias para o uso inicial. Nenhuma nova arquitetura ou rodada de discovery.

## Estado e evidência de partida

| Frente | O que está comprovado ou reportado | O que continua aberto |
|---|---|---|
| A — V2 | Implementação disponível; 16 migrations remotas, duas Functions, seis jobs; Master provisionado e acesso informado pelo operador | A.5 parcial, NO-GO: E2E autenticado, sessão/refresh/expiração, isolamento por HTTP, Studio completo, mídia/revelação e aparelhos físicos |
| B — backlog | Proposta de 256 itens reportada nos anexos; fonte acessível tem 213 itens sem épicos | Recuperar diferenças locais, reconciliar e integrar sem perder IDs/evidências; branches citadas não localizadas no remoto consultado |
| Codex — Growth Factory | Pipeline, 540 ideias, 300 pautas e dez pilotos reportados nos anexos | Recuperação dos artefatos; infraestrutura persistente/ENOSPC, avatar/lip sync e publicação oficial Instagram/TikTok |
| C — GTM | Estudos e hipóteses reportados nos anexos | Preços/planos validados com clientes, piloto comercial, cerimonialistas, custos/CAC e aquisição real |

Resultados anteriores desta rodada: 266/266 unitários, 4/4 testes do probe, 30/30 verificações HTTP; typecheck, lint e build com saída 0. E2E alternativo: uma falha, 15 não executados. Integração e pgTAP não executados nesta rodada; 430/430 pgTAP e 14/14 integração são históricos. Nenhuma promoção de produção.

Referências: `docs/supabase/A5-HOMOLOGATION-REPORT.md`, `docs/supabase/A4-AUTH-VERCEL-AUDIT.md`, `docs/backlog/backlog.json` e os dois handoffs.

## Restrições globais

- Ordem: A → B → Codex → C; preparar o plano não inicia B ou C.
- Não refazer discovery nem implementar funcionalidades fora do corte operacional V2.
- Não alterar dados reais de usuários, executar reset remoto ou limpeza destrutiva.
- Nunca exportar segredos, cookies ou tokens; service_role não entra no frontend nem na Vercel.
- Testes de escrita, revogação, falha de purga e limpeza de fixtures usam stack descartável; preview compartilhado recebe somente eventos sintéticos identificados, pela UI e permissões normais.
- iOS Safari e Android Chrome reais são requisitos de aceite; emulação não os substitui.
- Execução técnica autônoma, sem aprovações entre fases; preservar a restrição específica de promoção de produção sem autorização explícita para publicar a versão identificada.
- Não transformar pendência adiada em DONE: registrar motivo, mitigação, responsável e condição de retomada.

## Definição de pronto para uso

1. Um organizador entra com Google, cria e personaliza evento, salva/reabre e distribui link, código e QR corretos.
2. Convidado entra em aparelho independente, usa câmera ou fototeca, envia foto e recebe confirmação somente após persistência; interrupção permite nova tentativa sem duplicar foto ou consumir quota duas vezes.
3. Quotas e permissões são impostas pelo servidor. Convidado não organiza, organizador não administra a plataforma, e nenhum deles lê/escreve mídia de evento alheio. Sem sessão, somente a prévia pública autorizada do convite aparece.
4. Fotos privadas não podem ser obtidas antes da revelação por identidades não autorizadas, inclusive por URL/RPC. Após o horário, o job libera a galeria correta; downloads respeitam o papel e o evento.
5. Sessão com access token vencido e refresh válido renova normalmente; refresh inválido encerra acesso protegido sem travar a interface. Concessão Master continua validada no backend.
6. iPhone/Safari e Android/Chrome reais completam uma jornada focada: QR → entrada → câmera/fototeca → envio → segundo plano/retorno → revelação/galeria.
7. Há termos/privacidade, aceite versionado e auditado e revisão registrada (COM-004, requisito R2 existente); retenção é explícita e compatível com os jobs reais.
8. Backup cobre banco e objetos de mídia, com restauração demonstrada em destino isolado; operador consegue consultar saúde, reconhecer falha de upload/purga/revelação e executar o procedimento de recuperação.
9. Preview homologado corresponde ao SHA candidato; publicação e rollback têm procedimento comprovável. Nenhuma falha crítica de acesso, privacidade, integridade ou jornada principal fica aberta.

## Bloqueios e tratamento do corte

| Item | Tratamento para esta entrega |
|---|---|
| Acesso Vercel | Pré-requisito externo atual. A criação de link temporário foi autorizada pelo usuário; a ferramenta falhou com 403 em `lookup_deployment`, sem criar link. Falta acesso efetivo à equipe/projeto, não nova autorização verbal. |
| INF-004 | Confirmar dependência do Lume e remover a service key da configuração Vercel sem quebrar o legado; verificar ausência por metadados. Não presumir exposição nem rotacionar sem causa. |
| INF-005 | Build correto a partir de `web/`, SHA conhecido e procedimento repetível de preview/rollback são obrigatórios. Automação por push pode seguir aberta se o caminho manual estiver comprovado e registrado. |
| SCV-010 | DONE na branch QA com teste negativo; reaproveitar a evidência, sem reprovisionar o Master. |
| SCV-009 | Publicar e provar a correção HTTP 500/retry em ambiente isolado. Alerta automático >2h pode ficar aberto durante uso acompanhado se houver responsável, verificação ao iniciar/encerrar evento e a cada hora enquanto houver uploads. |
| QAV-004 | Higiene adiada; inventário preservado, sem excluir contas/objetos. Só bloqueia uso se evidência mostrar exposição, interferência ou capacidade insuficiente. |
| COM-009 | Backup e recuperação mínimos obrigatórios; PITR avançado pode continuar no roadmap, sem contratar infraestrutura para cumprir um rótulo. |

Adiar QAV-004 e partes de INF-005/SCV-009 altera o corte de release; não conclui esses itens nem permite afirmar que todos os pontos originais de A foram encerrados. O relatório final distinguirá **GO operacional** de **pendências originais de A**. Se houver pendência com risco crítico sem mitigação demonstrada, permanece NO-GO.

## Como impedir extensão de escopo

- Sete entregas no plano, com uma matriz de aceite e um candidato de release por rodada.
- Nova descoberta só entra antes da entrega se quebrar um dos nove critérios acima. As demais viram itens do roadmap; não reabrir auditoria inteira.
- Problema de ferramenta é registrado uma vez e encaminhado ao executor adequado; não repetir tentativas equivalentes de 403 ou trocar indefinidamente de navegador incompatível.
- Recuperar o trabalho local anterior por comparação pontual; a ausência das branches de B/C não paralisa a homologação da V2 disponível.
- Meta de planejamento: uma janela de cinco dias úteis após os pré-requisitos estarem disponíveis, sem promessa de prazo para acesso externo, revisão de texto ou aparelhos. Ao fim da janela, entregar GO/NO-GO e lista exata do que impede publicar; não iniciar outro ciclo de planejamento.

## Depois que o produto estiver utilizável

Concluir A com parecer explícito e exceções identificadas. B integra o backlog já produzido e escolhe o próximo lote curto; Codex recupera a Growth Factory e entrega o primeiro canal operacional; C executa piloto e valida preços/canal com clientes. Essas frentes continuam abertas enquanto o produto operacional recebe correções e melhorias.

Não condicionar a primeira utilização à conclusão de pagamentos, CRM, catálogo inteiro de ideias, avatar, lip sync, dashboards avançados ou todos os 213/256 itens. Não anunciar cobrança ou funcionalidade comercial ainda indisponível.
