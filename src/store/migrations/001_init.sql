-- Migração 001: esquema inicial persistente (SQLite/Postgres compatível).
-- tenant_id = id do evento em todas as tabelas filhas. FKs ON DELETE CASCADE.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  host_token TEXT NOT NULL,
  titulo TEXT NOT NULL,
  reveal_at TEXT NOT NULL,
  fotos_por_convidado INTEGER NOT NULL DEFAULT 20,
  data_evento TEXT,
  local TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  mensagem TEXT NOT NULL DEFAULT '',
  contato TEXT NOT NULL DEFAULT '',
  suspenso INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  limites_json TEXT NOT NULL DEFAULT '{}',
  reveal_notified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  entrou_em TEXT NOT NULL,
  lista_id TEXT,
  FOREIGN KEY (tenant_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  autor TEXT NOT NULL,
  ext TEXT NOT NULL,
  criada_em TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lista (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  grupo TEXT NOT NULL DEFAULT '',
  acompanhantes INTEGER NOT NULL DEFAULT 0,
  rsvp TEXT NOT NULL DEFAULT 'pendente',
  origem TEXT NOT NULL DEFAULT 'organizacao',
  FOREIGN KEY (tenant_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS equipe (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL,
  token TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recados (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  autor TEXT NOT NULL,
  texto TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS avisos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL,
  enviado_em TEXT NOT NULL,
  por TEXT NOT NULL DEFAULT '',
  alvos INTEGER NOT NULL DEFAULT 0,
  entregues INTEGER NOT NULL DEFAULT 0,
  falhas INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guests_tenant ON guests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_photos_tenant ON photos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lista_tenant ON lista(tenant_id);
CREATE INDEX IF NOT EXISTS idx_equipe_tenant ON equipe(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recados_tenant ON recados(tenant_id);
CREATE INDEX IF NOT EXISTS idx_push_tenant ON push_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_avisos_tenant ON avisos(tenant_id);