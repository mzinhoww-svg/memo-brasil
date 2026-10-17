-- Migração 003: item 7 (convidado sem fricção) + decisão 004 (visibilidade dos recados).
-- Ordem de merge: #9=002 (auth), #13=003 (este), #14=004, #15=005, #16=006.
-- `guests.token_hash` é adicionado só aqui (#14 e #15 não repetem).
ALTER TABLE guests ADD COLUMN token_hash TEXT;
-- visibilidade: 'casal' (padrão: só a organização e o autor veem) ou 'mural' (opt-in).
ALTER TABLE recados ADD COLUMN visibilidade TEXT NOT NULL DEFAULT 'casal';
