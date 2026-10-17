-- Migração 004: uploads seguros (frente #14, APR-029 itens 7 e 11).
--
-- A credencial do convidado (coluna guests.token_hash) é criada pela migração
-- do convidado (003_convidado_token_e_recado_mural.sql); NÃO repetimos a coluna
-- aqui. Este arquivo existe para reservar o número 004 na ordem de merge das
-- frentes (#9=002, #13=003, #14=004, #15=005, #16=006) e traz um índice que
-- acelera a contagem de fotos por convidado (cota e moderação por nome).
CREATE INDEX IF NOT EXISTS idx_photos_tenant_guest ON photos (tenant_id, guest_id);
