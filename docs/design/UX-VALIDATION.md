# MemoriesMT — rastreabilidade do lote de UX

Escopo: 25 achados da auditoria de fluxos, sobre a base `6720373`. A publicação deve usar também as quatro migrations aditivas `20261107000100`, `20261107000200`, `20261107000300` e `20261107000500`. A aplicação do banco precede o frontend, preservando o histórico remoto, inclusive migrations exclusivas do ambiente hospedado.

| Achado | Comportamento implementado | Evidência de regressão |
|---|---|---|
| A01 | Oferta identificada `teste1real` indisponível em produção; preços e histórico preservados | SQL 14 |
| A02 | Falha de pré-validação/envio recuperável, com identidade da tentativa preservada | send-recovery, postar |
| A03 | Rascunho por identidade/evento, 24h, retomada explícita e descarte local | draft, postar, navegador |
| A04 | Pedido de remoção usa RPC de denúncia, com sucesso/erro verificável | moderation, report-feedback |
| A05 | Bloqueio persistente impede retorno, publicação e leitura; desbloqueio explícito | SQL 14, moderation, access, navegador |
| A06 | Preparação/criação falha sem prender o formulário; navegação lenta reutiliza evento salvo | wizard-recovery |
| A07 | Nome vazio mostra erro e permite corrigir/reenviar | panel-recovery, navegador |
| A08 | Outra data exige data e horário válidos | wizard-input, wizard-recovery, navegador |
| A09 | Pagamento recuperado limpa erro antigo | ValidaPayCheckout |
| A10 | Tentativa financeira incerta consulta o mesmo pedido, sem novo POST automático | ValidaPayCheckout |
| A11 | Configuração/cotação/retomada com nova tentativa explícita | ValidaPayCheckout |
| A12 | Plano, valor e método correspondem ao pedido retomado | ValidaPayCheckout |
| A13 | Pago, liberação ativa e devolução pendente são distintos | SQL 26, ValidaPayCheckout, CheckoutPending |
| A14 | Falha de leitura oferece recuperação antes de concluir inexistência | panel-recovery, Pronto, offline-destination |
| A15 | ZIP parcial informa incluídas e indisponíveis | admin export |
| A16 | Falha na preparação do ZIP libera o botão | admin export |
| A17 | Busca, contagem e paginação no servidor, incluindo pendências fora dos primeiros registros | SQL 19, master-lists |
| A18 | Encerrar informa a consequência real para revelação e público | end-consequence, confirm-recovery |
| A19 | Ação segura recebe foco; confirmação pendente contém Tab/Shift+Tab | confirm-recovery, navegador |
| A20 | Textos distinguem momento de revelação e público autorizado | invite-copy, postar, public-recovery |
| A21 | Câmera ocupada/ausente distingue falha de permissão; galeria permanece alternativa | capture |
| A22 | Jornada nova identifica ValidaPay; histórico mantém seu provedor real | payment-copy, CheckoutPending |
| A23 | Fotos desejadas distinguem limite Grátis e recomendação de plano | wizard-recovery |
| A24 | Falha OAuth mantém destino interno seguro para recuperação | callback, safe-next, public-recovery |
| A25 | Preços acessíveis por navegação pública visível | public-recovery |

A correção adicional do lote materializa a seleção da reconciliação antes de atualizar os registros: mantém limites de lote, isolamento de ambiente, `SKIP LOCKED` e privilégios restritos. Regressões SQL 12 e 27.

## Verificação local

- App: suíte integrada final de 710 testes aprovada.
- Funções: 186 testes; servidor existente: 203 aprovados e 1 ignorado.
- Banco: reset local com todas as migrations, 17 arquivos / 1.246 verificações aprovadas.
- TypeScript e build Turbopack aprovados; lint sem erros (avisos existentes).
- A suíte `playwright.ux.config.ts` passou nos 12 cenários reais locais em desktop e celular e roda em CI com backend local. A configuração bloqueia serviços externos e nunca gera cobranças.

## Limites práticos

Rascunhos dependem do armazenamento do navegador; exclusão dos dados do site também os apaga. Em navegadores sem Navigation API, Voltar/Avançar segue normalmente e a proteção depende do rascunho persistido. Descartar tentativa incerta nunca apaga uma foto possivelmente publicada. Reservas pendentes usam a limpeza existente, após uma hora e em execução futura com acesso/rede.

Os testes controlados não substituem homologação em câmera física, login Google real ou uma transação real de Pix/cartão/3DS e webhook. Não foram efetuadas cobranças ou devoluções reais. Reembolsos produtivos continuam sujeitos ao atendimento e às restrições já existentes.

O [guia de fluxo e design](UX-FLOW-IMPROVEMENTS.md) separa estas correções das oportunidades futuras, como resumo editável e reorganização móvel dos painéis.
