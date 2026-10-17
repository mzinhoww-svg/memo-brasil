-- Migração 002: moderação e privacidade (LGPD).
-- - photos.oculta: foto escondida pela organização (some do álbum e das contagens)
-- - guests.token_hash: token do convidado (denúncia autenticada); só o hash é guardado
-- - guests.consentimento_json: último aceite registrado (prova fica em consentimentos)
-- - events.retencao_aviso_em: quando o casal foi avisado da exclusão por retenção
-- - denuncias / consentimentos: linhas filhas com FK ON DELETE CASCADE

ALTER TABLE photos ADD COLUMN oculta INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guests ADD COLUMN token_hash TEXT;
ALTER TABLE guests ADD COLUMN consentimento_json TEXT;
ALTER TABLE events ADD COLUMN retencao_aviso_em TEXT;

CREATE TABLE IF NOT EXISTS denuncias (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  foto_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  resolvida_em TEXT,
  FOREIGN KEY (tenant_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS consentimentos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  versao TEXT NOT NULL,
  fotos INTEGER,
  avisos INTEGER,
  em TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_denuncias_tenant ON denuncias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_foto ON denuncias(foto_id);
CREATE INDEX IF NOT EXISTS idx_consentimentos_tenant ON consentimentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consentimentos_guest ON consentimentos(guest_id);

CREATE TRIGGER IF NOT EXISTS trg_cascade_events_denuncias BEFORE DELETE ON events
BEGIN DELETE FROM denuncias WHERE tenant_id = OLD.id; END;

CREATE TRIGGER IF NOT EXISTS trg_cascade_events_consentimentos BEFORE DELETE ON events
BEGIN DELETE FROM consentimentos WHERE tenant_id = OLD.id; END;
