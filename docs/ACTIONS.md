# ACTIONS — pendências humanas

Itens que **só uma pessoa** pode resolver (conta, pagamento, nome, credencial). Nunca colar segredos aqui; registrar só o nome da variável. Atualizado em 2026-10-13.

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

## CI
- #1: o job `test` falha em ~2 s sem log; o QA cruzado atribui a cobrança/Actions. Regularizar o faturamento do GitHub Actions (ação humana) ou rodar a suíte localmente como evidência até lá.

## Conferir antes de usar
- Valores e prazos das lojas (Apple US$ 99/ano, Google US$ 25) estão em `docs/lojas.md` (#5) e devem ser reconferidos no momento da conta.
