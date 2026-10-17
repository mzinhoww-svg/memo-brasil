-- Migração 003: estado do aviso de revelação e do contato verificado da organização.
--
-- O job de revelação (src/reveal/job.js) grava este estado no próprio evento para
-- não reenviar e-mail/push após repetir o ciclo ou reiniciar o servidor. O contato
-- do evento é texto livre digitado pela organização; o e-mail de revelação só sai
-- para endereço verificado (contato_verificado = 1) ou para a lista de confiança
-- EMAIL_VERIFICADOS — nunca para um endereço qualquer.

ALTER TABLE events ADD COLUMN contato_verificado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN email_enviado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN email_enviado_em TEXT;
ALTER TABLE events ADD COLUMN email_id TEXT;
ALTER TABLE events ADD COLUMN email_tentativas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN email_erro TEXT;
