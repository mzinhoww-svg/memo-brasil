# 005 — RSVP fora do escopo

- Status: **aceita** (2026-10-17, por Aurimar, via Orquestrador)
- Autor: Orquestrador

## Contexto

O MVP do Lume nasceu com confirmação de presença (RSVP): página `/e/:id/presenca`, `POST /api/events/:id/rsvp`, status por convidado na lista (`pendente`/`confirmado`/`recusado`) com `acompanhantes`, além de estatísticas no painel e coluna no CSV.

Isso junta duas promessas diferentes — "avise se você vai" (RSVP) e "seu álbum colaborativo" (fotos que se revelam) — e cria dado pessoal (quem vai, com quantos) e expectativa que o produto não quer sustentar. A decisão de produto é: **o Lume não é app de confirmação de presença.**

## Decisão

Remover toda a função de RSVP:

- Página `/e/:id/presenca` (`public/presenca.html`) e o atalho "Confirmar presença" no hub (`inicio.html`).
- Rota `POST /api/events/:id/rsvp`.
- Campos e estatísticas: `rsvp` e `acompanhantes` por convidado; "Pessoas confirmadas"/"Sem resposta" no Resumo; filtros e colunas `Resposta`/`+` na aba Convidados; coluna "Confirmados" no `/master`; colunas `Acompanhantes` e `Resposta` no CSV.

Mantém: **lista de convidados** e **identificação do convidado** (necessárias para fotos e recados) e o **push** de avisos, que não depende de RSVP.

## Compatibilidade (sem migração destrutiva)

As colunas legadas `lista.rsvp` e `lista.acompanhantes` (da migração 001) **permanecem no banco**, mas são ignoradas na leitura e nunca reescritas nem exportadas. Eventos antigos carregam normalmente; o campo legado não quebra a API nem vaza no CSV. `POST /rsvp` passa a responder **404**. A sessão do convidado não devolve mais `rsvp`/`acompanhantes` (mantém `naLista`).

## Consequências

- Menos superfície de dado pessoal: não se coleta mais quem vai nem com quantos acompanhantes.
- Painel e CSV mais enxutos; menos uma tela no convite (hub com câmera, álbum, programação e local, recados).
- Recados seguem a decisão 004 (privados ao casal por padrão).
- Se o produto um dia precisar de RSVP, volta como frente própria (lista + contagem) com consentimento e finalidade próprios — não como campo no álbum.
- Nenhum cliente externo depende de `POST /rsvp`.
