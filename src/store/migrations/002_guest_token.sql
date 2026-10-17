-- Migração 002: credencial do convidado para o upload autenticado.
-- Guardamos só o hash (sha256 base64url); o token em claro existe apenas na
-- resposta da entrada do convidado e na memória do aparelho dele.
ALTER TABLE guests ADD COLUMN token_hash TEXT;
