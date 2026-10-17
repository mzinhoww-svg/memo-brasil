# Moderação e privacidade (LGPD)

Procedimentos do item 9 do checklist. Vale para o casal, o cerimonial, o admin master e quem opera os comandos. As decisões de produto (textos, bases legais) estão em `docs/copy/` e `docs/decisions/`; aqui ficam as regras que o código aplica.

## 1. Consentimento do convidado

- Na entrada (`POST /api/events/:id/guests`) o servidor **exige** `consentimento.fotos === true` e a versão vigente do texto (`consentimento-convidado v0.1`). Sem isso responde `400` e não cria o convidado.
- O aceite é registrado com: id do convidado, versão do texto, data/hora UTC, fotos/avisos marcados. **Não guardamos IP** nesse registro.
- A prova fica na tabela `consentimentos` (append-only; nunca truncamos o registro mais antigo) e o último aceite também no convidado.
- O token do convidado (`guestToken`) é entregue uma única vez na entrada; guardamos só o hash (`guests.token_hash`). Ele autentica a denúncia. Convidados que entraram **antes** desta versão não têm token: peça para entrarem de novo (o convite reaproveita o nome) ou trate a denúncia pelo painel.
- Mudou o texto? Suba a constante `VERSAO_PADRAO` em `src/lgpd/consentimento.js`. Entradas com a versão antiga passam a ser recusadas e o convite pede o aceite de novo.

## 2. Fotos: ocultar × apagar

| Ação | O que acontece | Quando usar |
|---|---|---|
| **Ocultar** (`PATCH /api/events/:id/photos/:pid` com `{"oculta":true}`) | Some do álbum, do ZIP, das contagens e do acesso do convidado (404). **O arquivo permanece no disco** para a organização. | Dúvida, conteúdo impróprio leve, pedido de alguém que pode mudar de ideia. |
| **Apagar** (`DELETE /api/events/:id/photos/:pid`) | Remove o registro e o arquivo do disco. Fecha as denúncias abertas como `foto-apagada`. | Conteúdo ilícito, foto de menor sem autorização, pedido de exclusão. |

Procedimento para conteúdo ilícito ou de menor (resposta em até **48 horas**):

1. Abra `Painel → Fotos e recados` e clique em **Apagar** na foto (um clique + confirmação).
2. **Não** baixe, encaminhe ou copie a imagem para outro lugar. A denúncia e a auditoria guardam apenas ids.
3. Registre o ocorrido na política interna (data, id do evento, id da foto, ação) — sem anexar a imagem.
4. Se houver risco a menor, avise os responsáveis e, se necessário, a autoridade competente. Não faça uso secundário do conteúdo.

A organização vê as fotos antes da revelação apenas nessa aba; o convidado nunca vê foto oculta, antes ou depois da revelação.

## 3. Denúncia

- `POST /api/events/:id/fotos/:pid/denunciar` exige `guestId` **e** o header `x-guest-token` (token recebido na entrada). Sem token, `403`.
- Limites: 20 denúncias por convidado, 50 por foto e 5.000 por evento. Denúncia repetida do mesmo convidado/foto devolve a mesma (`200`).
- A organização vê em `GET /api/events/:id/denuncias` e no painel (contador ⚑ e seção “Denúncias”). Ocultar/apagar fecha a denúncia como `moderada`/`foto-apagada`.
- **Aviso ao casal**: cada denúncia grava um arquivo em `DATA_DIR/outbox/denuncia-<id>.json` (permissão 0600) para o envio de e-mail. O envio real depende do item de e-mail; até lá, o painel é a fonte de acompanhamento.
- Prazo de resposta na política: 48 horas. Conteúdo que viole os termos pode ser ocultado de imediato e apagado após a análise.

## 4. Exportar os dados de um evento

```
node scripts/exportar-evento.js <id> [--saida=/caminho/evento.zip]
```

- Lê o **SQLite** (`memo.db`) pelo mesmo `Store` do servidor. Pode rodar com o servidor no ar (é somente leitura).
- Gera um `.zip` com `dados.json` (evento, convidados, recados, programação, denúncias e consentimentos) e as fotos. Removemos tokens em claro e hashes (`hostToken`, `token`, `hostTokenHash`, `tokenHash`, `guestTokenHash`), inscrições push e chaves.
- O arquivo sai com permissão **0600** (só o dono lê). A pasta padrão `exportacoes/` é criada com **0700**.
- **Verificação de identidade antes de entregar**: confirme que quem pede é o casal (contato cadastrado no evento) ou o titular dos dados. Em dúvida, peça confirmação por um canal já conhecido. Nunca envie o zip para um endereço informado só na solicitação.
- Entregue por canal seguro e **apague o arquivo local depois da entrega**. Ele contém dados pessoais.

## 5. Apagar um evento

```
node scripts/apagar-evento.js <id> --confirmar=<id>
```

- Exige `--confirmar` igual ao id e o **servidor parado**. Com o servidor no ar, o script recusa (lock em `DATA_DIR/server.lock`) para a exclusão não ser desfeita por uma cópia em memória.
- Apaga o evento e as linhas filhas no SQLite (FK/trigger em cascata) e o diretório `photos/<id>`.
- Grava auditoria (`evento.excluido`, só contagens) e o túmulo em `DATA_DIR/excluidos.log` (`id`, motivo, data), sem PII.
- O painel master também exclui pelo botão; nesse caso o túmulo é gravado igualmente.

## 6. Retenção

```
node scripts/retencao.js            # dry-run: lista vencidos e avisos
node scripts/retencao.js --executar # avisa quem está a 30 dias e apaga os vencidos
```

- Regra: a contagem é sempre a partir de **`revealAt`**, nunca de `createdAt`.
  - Álbum aberto: apaga depois de `RETENCAO_DIAS_APOS_REVELACAO` (padrão **365**) contados de `revealAt`.
  - `revealAt` passou sem revelação efetiva: `RETENCAO_DIAS_SEM_REVELACAO` (padrão **180**) contados de `revealAt`.
  - `revealAt` no futuro: **nunca** apaga por retenção, mesmo que o evento tenha sido criado há muito tempo.
- Variáveis de ambiente têm precedência sobre `settings.json` da plataforma.
- **Aviso 30 dias antes**: com `--executar`, eventos que vencem nos próximos 30 dias recebem `retencaoAvisoEm`, uma linha de auditoria (`retencao.aviso`) e um e-mail em `DATA_DIR/outbox/retencao-<id>.json`. O painel também mostra o prazo em Resumo.
- O log não tem PII: só ids, motivo, dias e datas.
- Agende (cron/systemd) `retencao.js --executar` diariamente, com o servidor parado ou em uma janela de manutenção. O lock impede rodar junto do servidor.

## 7. Backups e restauração

- `npm run backup` gera o `.tar.gz` com banco, fotos, auditoria, **`excluidos.log`** e `outbox`. Em produção é obrigatoriamente cifrado (`BACKUP_GPG_KEY`/`BACKUP_PASSPHRASE`).
- `BACKUP_RETENTION_DIAS` (padrão 30) nunca pode passar de `retencaoDiasAposRevelacao`; o script reduz automaticamente e avisa.
- **Restauração**: um backup antigo pode conter eventos que já foram apagados. Depois de restaurar, reaplique o `excluidos.log` **atual** (guardado fora do backup ou no host) antes de subir o servidor:

```sh
# para cada id em excluidos.log (o operador confere a lista antes)
sqlite3 data/memo.db "DELETE FROM events WHERE id = '<id>';"
rm -rf "data/photos/<id>"
```

- O `Store` também remove as linhas filhas por trigger/FK; o `DELETE` do evento basta. Confira `SELECT id FROM events;` depois.
- Sem o `excluidos.log`, a exclusão vale só até o próximo restore — por isso ele não entra em backups antigos e deve ser preservado à parte.

## 8. Auditoria

- `data/audit.log` é só inserção. Registra quem (papel), quando, evento e ação.
- Não grava nome de convidado, motivo de denúncia nem imagem. `foto.apagada` guarda só o id da foto.
- O admin master lê pelo painel (aba Auditoria). A retenção do próprio log deve seguir a política interna (mínimo de guarda de registros de acesso).

## 9. Direitos do titular

- **Acesso/portabilidade**: `exportar-evento.js` entrega os dados do evento.
- **Correção**: painel da organização para lista, programação e recados.
- **Exclusão**: apagar foto (organização), apagar evento (comando) ou retenção automática.
- **Retirada do consentimento**: o titular pode pedir a remoção das próprias fotos; a organização oculta/apaga. O registro do aceite permanece como prova do que foi autorizado, com a data da retirada anotada no atendimento.

## 10. Limitações conhecidas

- Envio de e-mail ainda não implementado: os avisos ficam na fila `outbox/` (item de e-mail).
- Autenticação do organizador ainda é por token (PR #9); a denúncia já usa token do convidado com hash.
- O lock é local (mesmo host). Em vários hosts, use um único escritor ou migre para Postgres.
