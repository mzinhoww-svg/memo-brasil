const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const Store = require('./interface');

const CONFIG_PADRAO = { recadosAtivos: true, apenasLista: false, mostrarAutor: true, recadosMural: false };

function normalizeEvent(ev) {
  Object.assign(ev, {
    dataEvento: ev.dataEvento || null,
    local: ev.local || '',
    endereco: ev.endereco || '',
    mensagem: ev.mensagem || '',
    contato: ev.contato || '',
    suspenso: !!ev.suspenso,
    cronograma: ev.cronograma || [],
    lista: ev.lista || [],
    equipe: ev.equipe || [],
    recados: ev.recados || [],
    guests: ev.guests || [],
    photos: ev.photos || [],
    push: ev.push || [],
    avisos: ev.avisos || [],
    revealNotified: ev.revealNotified ?? (Date.now() >= new Date(ev.revealAt).getTime()),
    limites: ev.limites || {},
    config: { ...CONFIG_PADRAO, ...(ev.config || {}) },
    createdAt: ev.createdAt || new Date().toISOString(),
  });
  return ev;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('base64url');
}

function verifyToken(token, hash) {
  if (!token || !hash) return false;
  const a = Buffer.from(tokenHash(token));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

class SqliteStore extends Store {
  constructor(dataDir) {
    super(dataDir);
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'photos'), { recursive: true });
    this.dbFile = path.join(dataDir, 'memo.db');
    this.conn = new DatabaseSync(this.dbFile);
    try { this.conn.exec('PRAGMA journal_mode=WAL;'); } catch {}
    this.conn.exec('PRAGMA foreign_keys=ON;');
    this._runMigrations();
    this._setPermissions();
    this._data = { events: {} };
    this._shadow = {};
    this._loadAll();
    const jsonPath = path.join(dataDir, 'db.json');
    if (Object.keys(this._data.events).length === 0 && !this._jsonImported() && fs.existsSync(jsonPath)) {
      this.importFromJson(jsonPath);
    }
    this._setPermissions();
  }

  get db() { return this._data; }

  _runMigrations() {
    const dir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(dir)) return;
    this.conn.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const m = file.match(/^(\d+)/);
      const version = m ? parseInt(m[1], 10) : NaN;
      if (isNaN(version)) continue;
      const row = this.conn.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version);
      if (row) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      this.conn.exec('BEGIN IMMEDIATE');
      try {
        this.conn.exec(sql);
        this.conn.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?,?,?)').run(version, file, new Date().toISOString());
        this.conn.exec('COMMIT');
      } catch (e) {
        try { this.conn.exec('ROLLBACK'); } catch {}
        throw e;
      }
    }
  }

  _setPermissions() {
    for (const f of [this.dbFile, `${this.dbFile}-wal`, `${this.dbFile}-shm`]) {
      try { if (fs.existsSync(f)) fs.chmodSync(f, 0o600); } catch {}
    }
  }

  _jsonImported() {
    try {
      const row = this.conn.prepare("SELECT version FROM schema_migrations WHERE version = 0 AND name = 'json_imported'").get();
      return !!row;
    } catch { return false; }
  }

  _markJsonImported() {
    this.conn.prepare("INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (0,'json_imported',?)").run(new Date().toISOString());
  }

  _loadAll() {
    const rows = this.conn.prepare('SELECT * FROM events').all();
    for (const r of rows) {
      const ev = normalizeEvent({
        id: r.id,
        hostToken: null,
        hostTokenHash: r.host_token_hash,
        titulo: r.titulo,
        revealAt: r.reveal_at,
        fotosPorConvidado: r.fotos_por_convidado,
        dataEvento: r.data_evento,
        local: r.local,
        endereco: r.endereco,
        mensagem: r.mensagem,
        contato: r.contato,
        suspenso: !!r.suspenso,
        config: JSON.parse(r.config_json || '{}'),
        limites: JSON.parse(r.limites_json || '{}'),
        revealNotified: !!r.reveal_notified,
        createdAt: r.created_at,
        cronograma: [], lista: [], equipe: [], recados: [], guests: [], photos: [], push: [], avisos: [],
      });
      const tid = ev.id;
      const guests = this.conn.prepare('SELECT * FROM guests WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const g of guests) ev.guests.push({ id: g.id, nome: g.nome, entrouEm: g.entrou_em, listaId: g.lista_id || undefined, tokenHash: g.token_hash || undefined });
      const photos = this.conn.prepare('SELECT * FROM photos WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const p of photos) ev.photos.push({ id: p.id, ext: p.ext, guestId: p.guest_id, autor: p.autor, criadaEm: p.criada_em });
      const lista = this.conn.prepare('SELECT * FROM lista WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const l of lista) ev.lista.push({ id: l.id, nome: l.nome, grupo: l.grupo, acompanhantes: l.acompanhantes, rsvp: l.rsvp, origem: l.origem });
      const equipe = this.conn.prepare('SELECT * FROM equipe WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const e of equipe) ev.equipe.push({ id: e.id, nome: e.nome, papel: e.papel, tokenHash: e.token_hash });
      const recados = this.conn.prepare('SELECT * FROM recados WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const r2 of recados) ev.recados.push({ id: r2.id, guestId: r2.guest_id, autor: r2.autor, texto: r2.texto, visibilidade: r2.visibilidade || 'casal', criadoEm: r2.criado_em });
      const push = this.conn.prepare('SELECT * FROM push_subscriptions WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const p of push) ev.push.push({ id: p.id, guestId: p.guest_id, sub: { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } }, criadoEm: p.criado_em });
      const avisos = this.conn.prepare('SELECT * FROM avisos WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const a of avisos) ev.avisos.push({ id: a.id, titulo: a.titulo, corpo: a.corpo, enviadoEm: a.enviado_em, por: a.por, alvos: a.alvos, entregues: a.entregues, falhas: a.falhas });
      this._data.events[ev.id] = ev;
    }
    this._shadow = deepClone(this._data.events);
  }

  _hashIfNeeded(ev) {
    if (ev.hostToken && (!ev.hostTokenHash || !verifyToken(ev.hostToken, ev.hostTokenHash))) {
      ev.hostTokenHash = tokenHash(ev.hostToken);
    }
  }

  _insertEvent(ev) {
    this._hashIfNeeded(ev);
    this.conn.prepare(`INSERT INTO events (id, host_token_hash, titulo, reveal_at, fotos_por_convidado, data_evento, local, endereco, mensagem, contato, suspenso, config_json, limites_json, reveal_notified, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      ev.id, ev.hostTokenHash, ev.titulo, ev.revealAt, ev.fotosPorConvidado,
      ev.dataEvento || null, ev.local || '', ev.endereco || '', ev.mensagem || '', ev.contato || '',
      ev.suspenso ? 1 : 0, JSON.stringify(ev.config || {}), JSON.stringify(ev.limites || {}), ev.revealNotified ? 1 : 0, ev.createdAt
    );
    for (const g of ev.guests || []) {
      this.conn.prepare('INSERT INTO guests (id, tenant_id, nome, entrou_em, lista_id, token_hash) VALUES (?,?,?,?,?,?)').run(g.id, ev.id, g.nome, g.entrouEm, g.listaId || null, g.tokenHash || null);
    }
    for (const l of ev.lista || []) {
      this.conn.prepare('INSERT INTO lista (id, tenant_id, nome, grupo, acompanhantes, rsvp, origem) VALUES (?,?,?,?,?,?,?)').run(l.id, ev.id, l.nome, l.grupo || '', l.acompanhantes || 0, l.rsvp || 'pendente', l.origem || 'organizacao');
    }
    for (const e of ev.equipe || []) {
      const th = e.tokenHash || (e.token ? tokenHash(e.token) : '');
      this.conn.prepare('INSERT INTO equipe (id, tenant_id, nome, papel, token_hash) VALUES (?,?,?,?,?)').run(e.id, ev.id, e.nome, e.papel, th);
    }
    for (const p of ev.photos || []) {
      this.conn.prepare('INSERT INTO photos (id, tenant_id, guest_id, autor, ext, criada_em) VALUES (?,?,?,?,?,?)').run(p.id, ev.id, p.guestId, p.autor, p.ext, p.criadaEm);
    }
    for (const r of ev.recados || []) {
      this.conn.prepare('INSERT INTO recados (id, tenant_id, guest_id, autor, texto, visibilidade, criado_em) VALUES (?,?,?,?,?,?,?)').run(r.id, ev.id, r.guestId, r.autor, r.texto, r.visibilidade || 'casal', r.criadoEm);
    }
    for (const p of ev.push || []) {
      this.conn.prepare('INSERT INTO push_subscriptions (id, tenant_id, guest_id, endpoint, p256dh, auth, criado_em) VALUES (?,?,?,?,?,?,?)').run(p.id, ev.id, p.guestId, p.sub.endpoint, p.sub.keys.p256dh, p.sub.keys.auth, p.criadoEm);
    }
    for (const a of ev.avisos || []) {
      this.conn.prepare('INSERT INTO avisos (id, tenant_id, titulo, corpo, enviado_em, por, alvos, entregues, falhas) VALUES (?,?,?,?,?,?,?,?,?)').run(a.id, ev.id, a.titulo, a.corpo, a.enviadoEm, a.por || '', a.alvos || 0, a.entregues || 0, a.falhas || 0);
    }
  }

  _updateEvent(ev, old) {
    this._hashIfNeeded(ev);
    if (
      ev.hostTokenHash !== old.hostTokenHash ||
      ev.titulo !== old.titulo ||
      ev.revealAt !== old.revealAt ||
      ev.fotosPorConvidado !== old.fotosPorConvidado ||
      ev.dataEvento !== old.dataEvento ||
      ev.local !== old.local ||
      ev.endereco !== old.endereco ||
      ev.mensagem !== old.mensagem ||
      ev.contato !== old.contato ||
      !!ev.suspenso !== !!old.suspenso ||
      JSON.stringify(ev.config) !== JSON.stringify(old.config) ||
      JSON.stringify(ev.limites) !== JSON.stringify(old.limites) ||
      !!ev.revealNotified !== !!old.revealNotified
    ) {
      this.conn.prepare(`UPDATE events SET host_token_hash=?, titulo=?, reveal_at=?, fotos_por_convidado=?, data_evento=?, local=?, endereco=?, mensagem=?, contato=?, suspenso=?, config_json=?, limites_json=?, reveal_notified=? WHERE id=?`).run(
        ev.hostTokenHash, ev.titulo, ev.revealAt, ev.fotosPorConvidado,
        ev.dataEvento || null, ev.local || '', ev.endereco || '', ev.mensagem || '', ev.contato || '',
        ev.suspenso ? 1 : 0, JSON.stringify(ev.config || {}), JSON.stringify(ev.limites || {}), ev.revealNotified ? 1 : 0, ev.id
      );
    }

    this._syncArray('guests', ev.guests, old.guests || [],
      (g) => this.conn.prepare('INSERT INTO guests (id, tenant_id, nome, entrou_em, lista_id, token_hash) VALUES (?,?,?,?,?,?)').run(g.id, ev.id, g.nome, g.entrouEm, g.listaId || null, g.tokenHash || null),
      (g) => this.conn.prepare('UPDATE guests SET nome=?, entrou_em=?, lista_id=?, token_hash=? WHERE id=? AND tenant_id=?').run(g.nome, g.entrouEm, g.listaId || null, g.tokenHash || null, g.id, ev.id),
      (id) => this.conn.prepare('DELETE FROM guests WHERE id=? AND tenant_id=?').run(id, ev.id));

    this._syncArray('lista', ev.lista, old.lista || [],
      (l) => this.conn.prepare('INSERT INTO lista (id, tenant_id, nome, grupo, acompanhantes, rsvp, origem) VALUES (?,?,?,?,?,?,?)').run(l.id, ev.id, l.nome, l.grupo || '', l.acompanhantes || 0, l.rsvp || 'pendente', l.origem || 'organizacao'),
      (l) => this.conn.prepare('UPDATE lista SET nome=?, grupo=?, acompanhantes=?, rsvp=?, origem=? WHERE id=? AND tenant_id=?').run(l.nome, l.grupo || '', l.acompanhantes || 0, l.rsvp || 'pendente', l.origem || 'organizacao', l.id, ev.id),
      (id) => this.conn.prepare('DELETE FROM lista WHERE id=? AND tenant_id=?').run(id, ev.id));

    this._syncArray('equipe', ev.equipe, old.equipe || [],
      (e) => {
        const th = e.tokenHash || (e.token ? tokenHash(e.token) : '');
        this.conn.prepare('INSERT INTO equipe (id, tenant_id, nome, papel, token_hash) VALUES (?,?,?,?,?)').run(e.id, ev.id, e.nome, e.papel, th);
      },
      (e) => {
        const th = e.tokenHash || (e.token ? tokenHash(e.token) : old.equipe.find((x) => x.id === e.id)?.tokenHash || '');
        this.conn.prepare('UPDATE equipe SET nome=?, papel=?, token_hash=? WHERE id=? AND tenant_id=?').run(e.nome, e.papel, th, e.id, ev.id);
      },
      (id) => this.conn.prepare('DELETE FROM equipe WHERE id=? AND tenant_id=?').run(id, ev.id));

    this._syncArray('photos', ev.photos, old.photos || [],
      (p) => this.conn.prepare('INSERT INTO photos (id, tenant_id, guest_id, autor, ext, criada_em) VALUES (?,?,?,?,?,?)').run(p.id, ev.id, p.guestId, p.autor, p.ext, p.criadaEm),
      (p) => this.conn.prepare('UPDATE photos SET guest_id=?, autor=?, ext=?, criada_em=? WHERE id=? AND tenant_id=?').run(p.guestId, p.autor, p.ext, p.criadaEm, p.id, ev.id),
      (id) => this.conn.prepare('DELETE FROM photos WHERE id=? AND tenant_id=?').run(id, ev.id));

    this._syncArray('recados', ev.recados, old.recados || [],
      (r) => this.conn.prepare('INSERT INTO recados (id, tenant_id, guest_id, autor, texto, visibilidade, criado_em) VALUES (?,?,?,?,?,?,?)').run(r.id, ev.id, r.guestId, r.autor, r.texto, r.visibilidade || 'casal', r.criadoEm),
      (r) => this.conn.prepare('UPDATE recados SET guest_id=?, autor=?, texto=?, visibilidade=?, criado_em=? WHERE id=? AND tenant_id=?').run(r.guestId, r.autor, r.texto, r.visibilidade || 'casal', r.criadoEm, r.id, ev.id),
      (id) => this.conn.prepare('DELETE FROM recados WHERE id=? AND tenant_id=?').run(id, ev.id));

    this._syncArray('push', ev.push, old.push || [],
      (p) => this.conn.prepare('INSERT INTO push_subscriptions (id, tenant_id, guest_id, endpoint, p256dh, auth, criado_em) VALUES (?,?,?,?,?,?,?)').run(p.id, ev.id, p.guestId, p.sub.endpoint, p.sub.keys.p256dh, p.sub.keys.auth, p.criadoEm),
      (p) => this.conn.prepare('UPDATE push_subscriptions SET guest_id=?, endpoint=?, p256dh=?, auth=?, criado_em=? WHERE id=? AND tenant_id=?').run(p.guestId, p.sub.endpoint, p.sub.keys.p256dh, p.sub.keys.auth, p.criadoEm, p.id, ev.id),
      (id) => this.conn.prepare('DELETE FROM push_subscriptions WHERE id=? AND tenant_id=?').run(id, ev.id));

    this._syncArray('avisos', ev.avisos, old.avisos || [],
      (a) => this.conn.prepare('INSERT INTO avisos (id, tenant_id, titulo, corpo, enviado_em, por, alvos, entregues, falhas) VALUES (?,?,?,?,?,?,?,?,?)').run(a.id, ev.id, a.titulo, a.corpo, a.enviadoEm, a.por || '', a.alvos || 0, a.entregues || 0, a.falhas || 0),
      (a) => this.conn.prepare('UPDATE avisos SET titulo=?, corpo=?, enviado_em=?, por=?, alvos=?, entregues=?, falhas=? WHERE id=? AND tenant_id=?').run(a.titulo, a.corpo, a.enviadoEm, a.por || '', a.alvos || 0, a.entregues || 0, a.falhas || 0, a.id, ev.id),
      (id) => this.conn.prepare('DELETE FROM avisos WHERE id=? AND tenant_id=?').run(id, ev.id));
  }

  _syncArray(name, current, previous, insertFn, updateFn, deleteFn) {
    const prevMap = new Map((previous || []).map((x) => [x.id, x]));
    const currMap = new Map((current || []).map((x) => [x.id, x]));
    for (const [id, item] of currMap) {
      if (!prevMap.has(id)) insertFn(item);
      else {
        const oldItem = prevMap.get(id);
        if (JSON.stringify(item) !== JSON.stringify(oldItem)) updateFn(item);
      }
    }
    for (const id of prevMap.keys()) {
      if (!currMap.has(id)) deleteFn(id);
    }
  }

  save() {
    this.conn.exec('BEGIN IMMEDIATE');
    try {
      const currentIds = new Set(Object.keys(this._data.events));
      for (const id of Object.keys(this._shadow)) {
        if (!currentIds.has(id)) {
          this.conn.prepare('DELETE FROM events WHERE id = ?').run(id);
        }
      }
      for (const [id, ev] of Object.entries(this._data.events)) {
        normalizeEvent(ev);
        const old = this._shadow[id];
        if (!old) this._insertEvent(ev);
        else this._updateEvent(ev, old);
      }
      this.conn.exec('COMMIT');
      this._shadow = deepClone(this._data.events);
    } catch (e) {
      try { this.conn.exec('ROLLBACK'); } catch {}
      throw e;
    }
    this._setPermissions();
  }

  deleteEvent(id) {
    const ev = this._data.events[id];
    if (!ev) return false;
    const dir = path.join(this.dataDir, 'photos', id);
    this.conn.exec('BEGIN IMMEDIATE');
    try {
      this.conn.prepare('DELETE FROM events WHERE id = ?').run(id);
      delete this._data.events[id];
      this.conn.exec('COMMIT');
    } catch (e) {
      try { this.conn.exec('ROLLBACK'); } catch {}
      throw e;
    }
    this._shadow = deepClone(this._data.events);
    this._setPermissions();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    return true;
  }

  run(sql, ...params) {
    return this.conn.prepare(sql).run(...params);
  }

  get(sql, ...params) {
    return this.conn.prepare(sql).get(...params);
  }

  all(sql, ...params) {
    return this.conn.prepare(sql).all(...params);
  }

  transaction(fn) {
    this.conn.exec('BEGIN IMMEDIATE');
    try {
      const tx = {
        run: (sql, ...params) => this.conn.prepare(sql).run(...params),
        get: (sql, ...params) => this.conn.prepare(sql).get(...params),
        all: (sql, ...params) => this.conn.prepare(sql).all(...params),
      };
      const result = fn(tx);
      this.conn.exec('COMMIT');
      return result;
    } catch (e) {
      try { this.conn.exec('ROLLBACK'); } catch {}
      throw e;
    }
  }

  schemaVersion() {
    const row = this.conn.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations').get();
    return row ? row.v : 0;
  }

  close() {
    try { this.conn.close(); } catch {}
  }

  counts() {
    const events = Object.values(this._data.events);
    return {
      events: events.length,
      guests: events.reduce((s, e) => s + (e.guests || []).length, 0),
      photos: events.reduce((s, e) => s + (e.photos || []).length, 0),
      lista: events.reduce((s, e) => s + (e.lista || []).length, 0),
      recados: events.reduce((s, e) => s + (e.recados || []).length, 0),
      equipe: events.reduce((s, e) => s + (e.equipe || []).length, 0),
      push: events.reduce((s, e) => s + (e.push || []).length, 0),
      avisos: events.reduce((s, e) => s + (e.avisos || []).length, 0),
    };
  }

  importFromJson(jsonPath) {
    if (!fs.existsSync(jsonPath)) throw new Error('db.json não encontrado: ' + jsonPath);
    if (Object.keys(this._data.events).length > 0) throw new Error('O banco já contém dados. Migração só é permitida em banco vazio.');
    if (this._jsonImported()) throw new Error('O JSON já foi importado anteriormente (marcador presente).');
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const src = (raw && raw.events) ? raw.events : raw;
    for (const [id, ev] of Object.entries(src || {})) {
      normalizeEvent(ev);
      if (!ev.hostTokenHash && ev.hostToken) ev.hostTokenHash = tokenHash(ev.hostToken);
      for (const m of ev.equipe || []) {
        if (!m.tokenHash && m.token) m.tokenHash = tokenHash(m.token);
      }
      this._data.events[id] = ev;
    }
    this.save();
    this._markJsonImported();
    return this.counts();
  }

  importJson(jsonPath) { return this.importFromJson(jsonPath); }
}

module.exports = SqliteStore;
module.exports.tokenHash = tokenHash;
module.exports.verifyToken = verifyToken;