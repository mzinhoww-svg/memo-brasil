# Evidência do Master

Referência fornecida: `design-system/revela/html/Master-*.html` e imagens WebP de `design-system/revela/telas/14-master/`.

Cada comparação coloca **app à esquerda e referência à direita**, quadros de 1440 × 900 (imagem final de 2880 × 900).

## Escopo da prova

- `fixtures/M00.png` a `fixtures/M14.png`: componentes com dados de referência, servidos por `/dev/revela/Master-*`; todos os 15 pares foram inspecionados. Servem para verificar markup, ícones, tokens e geometria.
- `M00.png` a `M14.png`: reservados para navegação real local por `/master/**`; só entram no relatório quando capturados com Auth local e dados de banco. M00 é login sem sessão; M01–M14 exigem JWT master validado e papel ativo no banco.
- Não se declara uma rota pronta pela porcentagem da fixture. O estado final por tela, RPCs, omissões e diferenças de dados está em [checklist](../../revela/checklist.md).
- `inventory.json`: 839 folhas extraídas dos 15 HTMLs, incluindo as repetições da moldura. O checklist enumera 587 folhas específicas e descreve uma vez as 252 repetições de moldura.

## Fixture após correção de fonte e ícones

Percentual pixelmatch é diagnóstico de rasterização/compressão, não tolerância automática de aceite. A fonte carregada e o token usam Schibsted Grotesk Variable.

| Tela | HTTP | Diferença de pixels | Comparação |
|---|---:|---:|---|
| M00 | 200 | 0.04% | [M00](fixtures/M00.png) |
| M01 | 200 | 0.30% | [M01](fixtures/M01.png) |
| M02 | 200 | 0.41% | [M02](fixtures/M02.png) |
| M03 | 200 | 0.33% | [M03](fixtures/M03.png) |
| M04 | 200 | 0.20% | [M04](fixtures/M04.png) |
| M05 | 200 | 0.37% | [M05](fixtures/M05.png) |
| M06 | 200 | 0.19% | [M06](fixtures/M06.png) |
| M07 | 200 | 0.23% | [M07](fixtures/M07.png) |
| M08 | 200 | 0.29% | [M08](fixtures/M08.png) |
| M09 | 200 | 0.16% | [M09](fixtures/M09.png) |
| M10 | 200 | 0.30% | [M10](fixtures/M10.png) |
| M11 | 200 | 0.21% | [M11](fixtures/M11.png) |
| M12 | 200 | 0.24% | [M12](fixtures/M12.png) |
| M13 | 200 | 0.35% | [M13](fixtures/M13.png) |
| M14 | 200 | 0.22% | [M14](fixtures/M14.png) |

## Prova real local

As 15 telas possuem captura de rota real local com HTTP 200. M00 é login sem sessão; M01–M14 usam JWT master validado pelo Auth local. As comparações são app à esquerda e referência à direita. HTTP 200 não substitui inspeção visual; os limites e dados por tela estão no [checklist](../../revela/checklist.md).

`route-results.json` registra rota, instante UTC, autenticação e dimensões. Não contém cookies, credenciais, senhas, chaves ou tokens. A captura rejeita URLs de Supabase/app externas e bloqueia requisições de rede para hosts que não sejam localhost/127.0.0.1. O script lê somente o arquivo de ambiente local fornecido explicitamente.

### Dados locais e variantes por tela

A seed descartável usa 53 contas fictícias, seis eventos, seis pedidos fictícios de pagamento, quatro códigos e três solicitações LGPD. Fotos são apenas registros agregados e metadados; nenhum arquivo de fotografia privada é carregado. Endereços `@revela-visual.test`, consentimentos e estado de falha de envio são dados de teste; nenhuma função de envio de e-mail ou provedor financeiro é executada.

Depois do primeiro lote, os direitos pagos foram ligados aos pedidos/eventos/planos/ambiente locais correspondentes, o pedido pendente ficou recente e a validade passou a 15 minutos. O destaque Casamento foi definido apenas na massa local para a prévia equivalente de M03/M04; não houve publicação de preços. O preço R$ 199,00 da captura é um rascunho de interface, descartado ao fechar o contexto de navegador.

M05 usa a variante de pedidos saudáveis (`needs_refund=false` no pedido local de Bodas) para comparar a tabela sem notas de exceção. M06 usa o mesmo pedido local com `needs_refund=true` para mostrar a ação de estorno. São cenários explícitos por tela; não se afirma que são um único instantâneo global. [M05 em divergências](states/M05-divergencias.png) preserva a primeira captura, anterior à coerência dos direitos pagos.

M00 usa o controle nativo de senha. A política real de retenção M12 segue dados do banco: 90 dias após encerramento; IP/backups não definidos. Não se substituem políticas ausentes pelos exemplos do desenho. O estado M11 documenta a nota de cron local inativo; essa condição é mantida como diagnóstico real.

M06 usa fatos recebidos na inbox e direitos do pedido; horários ausentes não são inferidos de pagamento. M07 usa código escolhido com confirmação auditada. M08 usa inscrições/exibições nativas reais observáveis no navegador aberto; dados históricos ausentes permanecem desconhecidos. Não há Web Push em segundo plano.

Na recaptura final, quatro eventos fictícios tiveram o relógio de revelação recolocado no futuro: o cron local os havia revelado durante a execução longa. É preparação de massa descartável por SQL local, não reversão oferecida pelo produto. Nenhum handler sensível de publicação, estorno ou moderação foi confirmado nas capturas.

## Verificação final

[Comandos, resultados e limites de homologação](verification.md). [Controles de navegador](controls-results.json). [Estado de cada tela](../../revela/checklist.md).
