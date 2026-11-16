-- Migração 006: estado do aviso de revelação e do contato verificado da organização.
--
-- Numeração conforme a ordem combinada dos PRs: #9 = 002, #13 = 003, #14 = 004,
-- #15 = 005 e #16 = 006, para não colidir com as migrações das outras frentes.
--
-- O job de revelação (src/reveal/job.js) grava este estado no próprio evento para
-- não reenviar e-mail/push após repetir o ciclo ou reiniciar o servidor. O contato
-- do evento é texto livre digitado pela organização; o e-mail de revelação só sai
-- para endereço verificado (contato_verificado = 1) ou para a lista de confiança
-- EMAIL_VERIFICADOS — nunca para um endereço qualquer.
--
-- email_incerto: o envio passou do timeout e não sabemos se chegou. Fica marcado e
-- NÃO é reenviado automaticamente (o operador pode liberar um reenvio manual).

ALTER TABLE events ADD COLUMN contato_verificado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN email_enviado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN email_enviado_em TEXT;
ALTER TABLE events ADD COLUMN email_id TEXT;
ALTER TABLE events ADD COLUMN email_tentativas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN email_erro TEXT;
ALTER TABLE events ADD COLUMN email_incerto INTEGER NOT NULL DEFAULT 0;
