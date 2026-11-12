# Validação final do Master Revela

Entrega na branch `feat/revela-master-antigas`, em worktree isolado com `web/node_modules` por link simbólico. Sem PR, merge, deploy ou alteração em Supabase remoto.

- `npx tsc --noEmit`: passou. O build local também verificou os tipos gerados do Next.
- `npx eslint src`: zero erros, 14 avisos existentes. E2E alterado também passou no lint.
- `npx vitest run --maxWorkers=1 --testTimeout=30000`: 117 arquivos, 895 testes passaram. A concorrência foi reduzida após timeouts sob carga simultânea de navegador/compilação; o timeout maior é somente argumento desta execução.
- Funções: 11 arquivos, 195 testes passaram.
- Banco: reset local limpo aplicou todas as migrations, incluindo as dez aditivas; suíte integral pgTAP passou com 36 arquivos e 1.686 verificações. A expectativa antiga de saúde foi atualizada de seis para sete jobs, incluindo `mm-purge-anon-orphans`, já criado pela migration de 2026-10-24; a verificação mantém contagem e conjunto exatos.
- Build de produção executado localmente: passou, sem publicação.
- E2E de autorização no build local: 2 passaram, cobrindo 12 itens, rotas atuais/antigas, master ativo, claim sem papel, organizador, convidado e ausência de sessão. Não corresponde à execução de toda a suíte E2E do repositório.
- Navegador: 9 checks passaram; filtros, abas, CSV de equipe, cinco redirecionamentos com parâmetros, descarte de rascunho, motivo/confirmar/cancelar e sete folhas de ações. Nenhuma ação sensível foi submetida; somente o CSV gerou sua auditoria local.
- Evidência: 15 capturas reais 1440×900, compostas em PNG 2880×900 (app | desenho), além das 15 fixtures suplementares. O login é sem sessão; demais telas com JWT master local.
- Revisões de código: contratos e consumidores aprovados sem achados críticos ou importantes. SQL39–48 cobrem autorização, máscara, auditoria, consentimento, limites, fatos ausentes e busca/paginação antes do limite.

As tentativas no servidor de desenvolvimento apresentaram corridas de hidratação/redirecionamento. Os E2E passaram no build local estável; a massa de usuários temporários não foi executada em paralelo à conferência de CSV. Nenhuma proteção do produto foi removida para obter aprovação.

Limites preservados: avisos nativos exigem navegador aberto; dados históricos ausentes aparecem como desconhecidos. Fotos privadas não são carregadas pelo Master. A retenção exibida vem do banco, sem substituir valores ausentes pelos exemplos do desenho. M14 mostra rascunho local não salvo.
