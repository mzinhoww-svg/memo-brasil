# Revisão independente de A.5

Revisor separado, somente leitura, conforme Superpowers. Escopo: diff da correção da purga, testes, probe e pacote de evidências/runbook. Não houve revisão nova de toda a aplicação.

## Parecer e correções

- Correção HTTP da purga aceita: retorna 500 quando SDK de Storage ou baixa da fila falham, preservando a ordem das operações e os itens para retry. Testes executam o handler real; 4/4 GREEN após duas falhas RED.
- Achado importante: probe podia sair 0 com Email habilitado. Corrigido: settings devem anunciar Google e convidados ativos e Email inativo; caso contrário saída 1. Teste reproduziu a falha antes da correção.
- Achado importante: projeto remoto fixo podia rotular resultado local como remoto. Corrigido: origem/projeto derivados da URL, trava A5_EXPECTED_PROJECT e nome de saída padrão com timestamp. Testes de origem local e alvo divergente passaram após RED.
- Achado importante: comando do probe no runbook permanecia em web/ e herdava variáveis locais. Corrigido: voltar à raiz, definir origem/chave pública remotas e incluir comandos explícitos para app/E2E locais.
- Segurança do probe: modo padrão não faz signup. Tentativa negativa exige --check-disabled-email-signup e verifica recusa/ausência de usuário ou sessão. O endpoint pode criar conta se sua configuração mudar entre GET e POST; esta limitação está documentada. Nesta rodada foi observado email_provider_disabled sem criação.
- Testes do probe após correções: 4/4; logs probe-red.txt e probe-green.txt. Nenhuma segunda rodada de revisão encomendada: regressões verificam as correções, conforme workflow Superpowers.
- Inspeção direcionada do revisor não encontrou credenciais nos entregáveis. Nenhuma chave foi descriptografada ou exportada.

## Limites mantidos

Revisor considerou e não julgou: JWT/sessões reais, Function publicada, UI autenticada/IDOR, aparelhos físicos, pgTAP/integração atuais, logs Vercel, exploração exaustiva de segurança e trabalho não commitado no Mac. Permanecem pendentes; custo de aceitar sem essa evidência seria um falso GO. Parecer atual: NO-GO.

Os 11 avisos preexistentes de ESLint foram mantidos; zero erros. Não ampliar escopo para limpeza cosmética.
