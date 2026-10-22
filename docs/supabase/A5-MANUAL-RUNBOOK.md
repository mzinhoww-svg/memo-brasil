# A.5 — Intervenções e roteiro de aceite

Não promover produção. Não executar reset remoto, limpeza, revogação de usuários reais ou alterações de Auth sem escopo próprio. Não copiar tokens, cookies, senhas ou service_role para relatório, chat ou frontend.

## 1. Recuperar o estado local anterior

No checkout original do MemoriesMT no Mac:

```bash
pwd
git status --short
git worktree list
git branch --all
git show --stat 6d84c31
git log --all --oneline -- docs/handoff docs/supabase/A5-HOMOLOGATION-REPORT.md
```

Se 6d84c31 existir apenas localmente, comparar com a branch de homologação desta rodada. Preservar alterações não commitadas. Não adicionar `supabase/ops/provision_master_sqleditor.sql` personalizado nem backups. Os novos handoffs desta rodada descrevem somente o estado acessível; não substituem silenciosamente o conteúdo local anterior.

## 2. Vercel e preview

- Escopo retornado: `mzinhoww-gmailcoms-projects`, ID `team_SOZVnHod91BcrmLMYmdmvB8k`.
- Projeto: `newmemocuiaba`, ID `prj_IpHyqsnnbrXS213AGrOmxizb0Kjl`.
- Conceder ao conector acesso a essa equipe por seu fluxo normal de autorização; as ferramentas de autorização de equipe sugeridas pelo erro não estavam expostas nesta sessão. Não trocar para outro escopo para contornar o 403.
- No navegador autenticado do operador, abrir `https://newmemocuiaba-p3dzw49y4-mzinhoww-gmailcoms-projects.vercel.app/master` e conferir a identidade e o painel. A sessão deste navegador remoto não é a do Mac.
- O operador autorizou explicitamente o link temporário que dispensa login Vercel. Após a rejeição inicial de auto-review, a chamada permitida falhou com 403 em `lookup_deployment`; nenhum link foi criado. Não pedir novamente essa autorização. Retentar somente após mudança comprovada do acesso efetivo à equipe/projeto, ou usar o preview no painel autenticado do operador.
- Para INF-005, conferir Settings → Build and Deployment → Root Directory `web`, Framework `Next.js`, repositório e branch corretos. Registrar os valores anteriores, corrigir em janela acordada e provar com um novo push para branch de preview. Não alterar branch Production nem promover deployment.
- Para INF-004, conferir dependência do legado antes de remover `SUPABASE_SERVICEROLE_KEY` de Environment Variables → Production. A remoção é intervenção separada; não fazer deploy Production para testar. Registrar apenas nome/alvo/ausência, nunca o valor. Nenhuma exposição da chave foi demonstrada nesta sessão; rotação não é presumida como executada.

## 3. Stack descartável e testes

Requer Docker e Supabase CLI disponíveis no computador executor. Antes de iniciar, confirmar CLI pela ajuda. Estes comandos usam apenas a stack local das portas 55421/55422:

```bash
supabase --help
supabase start --help
supabase test db --help
supabase start
supabase test db
cd web
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Configurar privadamente SUPABASE_URL=http://127.0.0.1:55421, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_KEY com chaves da stack local, sem imprimir seu conteúdo. Não usar `ALLOW_REMOTE_TEST=1` no projeto compartilhado.

```bash
npm run test:integration
npx playwright install chromium
npm run e2e -- studio-local.spec.ts flows.spec.ts reveal.spec.ts
```

Para `master-studio.spec.ts` / `supabase.spec.ts`, em um terminal dentro de `web/` com as três variáveis LOCAIS já configuradas, subir o app em modo Supabase local. Não apontar esse processo para produção:

```bash
NEXT_PUBLIC_MM_BACKEND=supabase NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY" npx next dev --hostname 127.0.0.1 --port 3187
```

Em outro terminal, também em `web/` e com as mesmas três variáveis LOCAIS:

```bash
E2E_BASE_URL=http://127.0.0.1:3187 npx playwright test --config playwright.supabase.config.ts
```

Para os probes REMOTOS, voltar explicitamente à raiz do repositório e substituir as variáveis LOCAIS por URL/chave PÚBLICA remotas. Não reutilizar a service_role da stack nem exportar valor sensível. O arquivo de saída padrão tem timestamp e preserva a evidência anterior:

```bash
cd ..
export SUPABASE_URL=https://asyaegeodyttttaubvxh.supabase.co
export A5_EXPECTED_PROJECT=asyaegeodyttttaubvxh
export SUPABASE_PUBLISHABLE_KEY='CHAVE_PUBLICA_REMOTA'
node supabase/ops/a5-readonly-probe.mjs
```

O modo padrão só lê. A opção abaixo acrescenta uma tentativa NEGATIVA de cadastro sintético, apenas quando o servidor anuncia Email desabilitado. O endpoint é capaz de criar usuário se a configuração mudar entre as requisições; não usar essa opção sem autorização para testar esse fluxo. Nesta sessão a tentativa foi recusada, sem criação:

```bash
node supabase/ops/a5-readonly-probe.mjs --check-disabled-email-signup
```

## 4. Matriz autenticada, com identidades descartáveis

Usar quatro perfis de navegador separados: Master de homologação, organizador A, convidado e sem sessão; adicionar organizador B para IDOR. Não promover/rebaixar o Master real. Registrar device/browser/versão, commit, horário e resultado de cada teste sem tokens ou dados pessoais.

1. Google: login → callback no mesmo domínio → `/master`; refresh da página; `getUser` e `is_master` no backend. A UI deve acompanhar a autorização real, não somente mostrar o painel.
2. Sessão: em identidade de homologação, renovar via fluxo normal do SDK; verificar expiração do access token com refresh válido e, separadamente, refresh inválido/revogado. Confirmar retorno ao login e nenhuma chamada administrativa autorizada após término. Não alterar tokens/sessão da conta real nem reduzir o TTL global.
3. Organizador A: criar evento com nome/tipo/data/fuso/local/limites/revelação; personalizar preset/paleta/fonte/mensagem/logo/capa/QR; salvar, recarregar, restaurar. Conferir tema nas telas de convidado e isolamento da plataforma/admin.
4. Organizador B: negar leitura/escrita de evento, tema, convite e foto alheios, inclusive chamadas diretas; negar `/master` e RPCs administrativas. Convidado não cria evento nem escreve tema/settings.
5. Convite: código válido/inválido, QR, token limitado/esgotado/revogado, reentrada e lotação. Evitar tentativas que enviem mensagens a pessoas reais.
6. Upload: câmera autorizada/negada, JPEG/PNG/WebP, arquivo acima da quota/MIME falso, duas fases, interrupção e retry, caminho de outro usuário, upsert negado, rolo esgotado. Confirmar persistência e quota no servidor.
7. Galeria: antes da revelação, convidados não listam nem assinam/baixam fotos prontas; organizador autorizado consegue. Após cron, convidados membros veem; usuários externos e anônimos continuam negados. Confirmar idempotência sem invocar jobs destrutivos.
8. Auditoria: ação administrativa permitida exige justificativa, gera registro com ator/papel/alvo; grants de UPDATE/DELETE/TRUNCATE permanecem negados. Fazer o teste de escrita só em fixtures próprias na stack descartável.

## 5. Dispositivos físicos

Repetir os passos 3–7 em iPhone/iOS Safari e Android/Chrome reais. Registrar modelo, versões de SO/browser e evidência de: QR abrindo link certo; permissões da câmera; orientação/frente-verso; arquivo da fototeca; envio interrompido e retomado; voltar do segundo plano; quota; espera/galeria e horário de revelação. Captura emulando iPhone/Android não fecha o requisito físico.

## 6. Purga e higiene

SCV-009: a correção HTTP é local; publicar em ambiente de teste e injetar falha de Storage/baixa de fila sem afetar dados reais. Verificar HTTP 500 em `net._http_response`, itens retidos e retry recuperando. Implementar e provar alerta de idade >7200 s. Cron `succeeded` sozinho não prova sucesso HTTP. Não inserir falhas na fila compartilhada.

QAV-004: preparar inventário sem PII, backup com restauração testada e lista exata de IDs/objetos comprovadamente sintéticos. Só então solicitar autorização de limpeza e executar em janela própria. Não há comando destrutivo autorizado neste runbook.
