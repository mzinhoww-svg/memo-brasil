# ACTIONS — pendências humanas

Itens que **só uma pessoa** pode resolver (conta, pagamento, nome, credencial). Nunca colar segredos aqui; registrar só o nome da variável. Atualizado em 2026-10-16.

> Nota: este arquivo vive em `docs/status`; esta cópia foi trazida para o PR #9 apenas para registrar as variáveis novas (proxy e válvulas do master). Ao mergear, manter a versão de `docs/status` e somar estas linhas.

## Decisões
| # | Ação | Por quê | Bloqueia |
|---|---|---|---|
| D1 | Aceitar (ou ajustar) as decisões 002, 003 e 004 | Hoje só a 001 foi aceita; as outras três estão recomendadas | Itens 5, 9, 13 |
| D2 | Nome **Lume** já decidido por Aurimar: falta busca INPI (classes 9/42/38), domínio e handles | Strings de produto já usam "Lume" (#4) | Publicação, lojas, textos |
| D3 | Conta de desenvolvedor Apple/Google: pessoal ou organização (CNPJ) | Define nome de vendedor e DUNS | Lojas (pós-MVP) |
| D4 | Plano/custo da publicação aprovado (VPS, domínio, e-mail, backup) | Primeiro deploy só após aprovação | Item 4 |

## Credenciais e contas (não presentes)
| Variável / recurso | Uso | Observação |
|---|---|---|
| `EMAIL_PROVIDER`, `EMAIL_API_KEY` | E-mail transacional (link mágico, revelação) | Sem isto o link cai em log (B5 do #9); produção deve recusar subir |
| `MASTER_TOTP_KEY` (32 bytes aleatórios) | Cifrar segredo TOTP do master | Exigir em produção (B6 do #9) |
| `MASTER_BOOTSTRAP_*` | Criar o primeiro master | Preferir `scripts/master-criar.js` interativo, não argv |
| Google OAuth (client id/secret) | Só se a decisão 002 for a opção C | Opcional |
| Turnstile (site/secret) | Anti-spam na criação aberta (item 13) | Pendente |
| Sentry DSN | Alerta de erro (item 11) | Plano gratuito |
| Bucket de backup externo | Backup cifrado fora do host (A2 do #7) | Pendente |
| `PUBLIC_URL` (https) | QR Code, cookies `Secure` | Depois do domínio |

## Infraestrutura
- VPS `reinerscloud`: 1 vCPU, 2 GB, 50 GB, SAO2, IP existente, **compartilhada com outro serviço**. Senha inicial devolvida pela API do provedor: nunca imprimir nem commitar; trocar por chave SSH.
- Confirmar que o teto de fotos por evento cabe nos 50 GB (limite atual 20.000 fotos × 10 MB).

## Proxy, IP e limites (PR #9)
- `TRUST_PROXY` — número de saltos de proxy confiáveis, **padrão `0`** (sem proxy na frente). Com `0`, `req.ip` é o endereço do socket e um `X-Forwarded-For` forjado pelo cliente é ignorado; os limites por IP (criação de evento, pedido de link, login master) não podem ser contornados por cabeçalho.
  - **Quem preenche**: quem opera o deploy, ao colocar o app atrás do proxy reverso.
  - **Valor**: `1` atrás de um único proxy que anexa `X-Forwarded-For` (nginx/Caddy na mesma máquina); `2` se houver dois saltos confiáveis; `true` só se o proxy for totalmente confiável e inacessível de fora.
  - **Nunca** deixar o padrão `0` com o app publicado atrás de proxy (todos os acessos passam a contar como um único IP e os limites bloqueiam usuários legítimos); **nunca** usar valor maior que a quantidade real de saltos (o cliente volta a poder forjar o IP).
- `MASTER_EMERGENCY`, `MASTER_TOKEN_COMPAT` — válvulas que reativam o `MASTER_TOKEN` estático mesmo com conta master criada. Padrão: desligadas. **São recusadas quando `PUBLIC_URL` é `https://`** e cada uso é gravado na auditoria (`master.token_emergencia`). Só ligar para recuperar acesso em ambiente de desenvolvimento/emergência; desligar em seguida.
- **Credencial nunca na URL.** O painel e o master mandam o token só no cabeçalho (`x-host-token`/`x-master-token`); a rota do arquivo de foto e o painel **não** aceitam `?token=`. As miniaturas são buscadas com `fetch` e viram `blob:` (helper `imgAutenticada` em `public/common.js`), para o token não cair em log, histórico do navegador ou `Referer`.

## CI
- #1: o job `test` falha em ~2 s sem log; o QA cruzado atribui a cobrança/Actions. Regularizar o faturamento do GitHub Actions (ação humana) ou rodar a suíte localmente como evidência até lá.
- `.gitleaks.toml` libera **apenas** o vetor de teste público da RFC 6238 (`GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ`, apêndice B) usado nos testes de TOTP. Qualquer outro candidato a segredo continua falhando o scan; nada de valor real deve ser acrescentado a esse allowlist.

## Conferir antes de usar
- Valores e prazos das lojas (Apple US$ 99/ano, Google US$ 25) estão em `docs/lojas.md` (#5) e devem ser reconferidos no momento da conta.
