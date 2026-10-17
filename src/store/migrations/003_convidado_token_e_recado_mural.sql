-- Migração 002: item 7 (convidado sem fricção) + decisão 004 (visibilidade dos recados).
-- token_hash: guarda só o hash do token do convidado, como já se faz com host e equipe.
ALTER TABLE guests ADD COLUMN token_hash TEXT;
-- visibilidade: 'casal' (padrão: só a organização e o autor veem) ou 'mural' (opt-in).
ALTER TABLE recados ADD COLUMN visibilidade TEXT NOT NULL DEFAULT 'casal';
