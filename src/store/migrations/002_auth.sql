-- Migração 002: autenticação organizador (magic link + sessão) e master seguro.
-- Apenas tabelas e triggers; código aplica TTL, hash e rls de aplicação.

CREATE TABLE IF NOT EXISTS organizadores (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_norm TEXT NOT NULL UNIQUE,
  criado_em TEXT NOT NULL,
  consentimento_em TEXT,
  consentimento_versao TEXT
);

CREATE TABLE IF NOT EXISTS organizador_membros (
  id TEXT PRIMARY KEY,
  organizador_id TEXT NOT NULL,
  evento_id TEXT NOT NULL,
  papel TEXT NOT NULL CHECK(papel IN ('casal','cerimonial')),
  criado_em TEXT NOT NULL,
  UNIQUE(organizador_id, evento_id),
  FOREIGN KEY (organizador_id) REFERENCES organizadores(id) ON DELETE CASCADE,
  FOREIGN KEY (evento_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS magic_tokens (
  token_hash TEXT PRIMARY KEY,
  email_norm TEXT NOT NULL,
  organizador_id TEXT,
  evento_id TEXT,
  papel TEXT,
  tipo TEXT NOT NULL DEFAULT 'login' CHECK(tipo IN ('login','invite','claim')),
  criado_em TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  usado_em TEXT,
  cancelado INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (organizador_id) REFERENCES organizadores(id) ON DELETE SET NULL,
  FOREIGN KEY (evento_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessoes (
  id_hash TEXT PRIMARY KEY,
  organizador_id TEXT NOT NULL,
  criada_em TEXT NOT NULL,
  ultimo_uso_em TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  expira_absoluta_em TEXT NOT NULL,
  ua_resumo TEXT,
  revogada INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (organizador_id) REFERENCES organizadores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS master_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_norm TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  totp_secret TEXT NOT NULL,
  totp_ultimo_passo INTEGER NOT NULL DEFAULT 0,
  recuperacao_hashes TEXT NOT NULL DEFAULT '[]',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  falhas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate TEXT
);

CREATE TABLE IF NOT EXISTS master_sessoes (
  id_hash TEXT PRIMARY KEY,
  master_id TEXT NOT NULL,
  criada_em TEXT NOT NULL,
  ultimo_uso_em TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  expira_absoluta_em TEXT NOT NULL,
  ua_resumo TEXT,
  revogada INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (master_id) REFERENCES master_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quando TEXT NOT NULL,
  ator_tipo TEXT NOT NULL,
  ator_id TEXT,
  evento_id TEXT,
  acao TEXT NOT NULL,
  alvo TEXT,
  detalhe TEXT,
  ip_hash TEXT,
  resultado TEXT,
  hash_anterior TEXT,
  hash_atual TEXT
);

CREATE TRIGGER IF NOT EXISTS auditoria_no_update
  BEFORE UPDATE ON auditoria
  BEGIN
    SELECT RAISE(ABORT, 'auditoria e somente insercao');
  END;

CREATE TRIGGER IF NOT EXISTS auditoria_no_delete
  BEFORE DELETE ON auditoria
  BEGIN
    SELECT RAISE(ABORT, 'auditoria e somente insercao');
  END;

CREATE INDEX IF NOT EXISTS idx_magic_tokens_email ON magic_tokens(email_norm);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_expira ON magic_tokens(expira_em);
CREATE INDEX IF NOT EXISTS idx_sessoes_org ON sessoes(organizador_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em);
CREATE INDEX IF NOT EXISTS idx_org_membros_evento ON organizador_membros(evento_id);
CREATE INDEX IF NOT EXISTS idx_org_membros_org ON organizador_membros(organizador_id);
CREATE INDEX IF NOT EXISTS idx_master_sessoes_master ON master_sessoes(master_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_quando ON auditoria(quando);
CREATE INDEX IF NOT EXISTS idx_auditoria_evento ON auditoria(evento_id);