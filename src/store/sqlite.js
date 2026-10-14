const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const Store = require('./interface');

const CONFIG_PADRAO = { recadosAtivos: true, apenasLista: false, mostrarAutor: true };

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
  });
  return ev;
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
    this._data = { events: {} };
    this._loadAll();
    const jsonPath = path.join(dataDir, 'db.json');
    if (Object.keys(this._data.events).length === 0 && fs.existsSync(jsonPath)) {
      this.importFromJson(jsonPath);
    }
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

  _loadAll() {
    const rows = this.conn.prepare('SELECT * FROM events').all();
    for (const r of rows) {
      const ev = normalizeEvent({
        id: r.id,
        hostToken: r.host_token,
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
      for (const g of guests) ev.guests.push({ id: g.id, nome: g.nome, entrouEm: g.entrou_em, listaId: g.lista_id || undefined });
      const photos = this.conn.prepare('SELECT * FROM photos WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const p of photos) ev.photos.push({ id: p.id, ext: p.ext, guestId: p.guest_id, autor: p.autor, criadaEm: p.criada_em });
      const lista = this.conn.prepare('SELECT * FROM lista WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const l of lista) ev.lista.push({ id: l.id, nome: l.nome, grupo: l.grupo, acompanhantes: l.acompanhantes, rsvp: l.rsvp, origem: l.origem });
      const equipe = this.conn.prepare('SELECT * FROM equipe WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const e of equipe) ev.equipe.push({ id: e.id, nome: e.nome, papel: e.papel, token: e.token });
      const recados = this.conn.prepare('SELECT * FROM recados WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const r2 of recados) ev.recados.push({ id: r2.id, guestId: r2.guest_id, autor: r2.autor, texto: r2.texto, criadoEm: r2.criado_em });
      const push = this.conn.prepare('SELECT * FROM push_subscriptions WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const p of push) ev.push.push({ id: p.id, guestId: p.guest_id, sub: { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } }, criadoEm: p.criado_em });
      const avisos = this.conn.prepare('SELECT * FROM avisos WHERE tenant_id = ? ORDER BY rowid').all(tid);
      for (const a of avisos) ev.avisos.push({ id: a.id, titulo: a.titulo, corpo: a.corpo, enviadoEm: a.enviado_em, por: a.por, alvos: a.alvos, entregues: a.entregues, falhas: a.falhas });
      this._data.events[ev.id] = ev;
    }
  }

  _normGuest(g) {
    const o = { id: g.id, entrou_em: g.entrouEm, lista_id: g.listaId || null };
    return o;
  }

  save() {
    this.conn.exec('BEGIN IMMEDIATE');
    try {
      const currentIds = new Set(Object.keys(this._data.events));
      const dbIds = this.conn.prepare('SELECT id FROM events').all().map((r) => r.id);
      for (const id of dbIds) {
        if (!currentIds.has(id)) {
          this.conn.prepare('DELETE FROM events WHERE id = ?').run(id);
        }
      }
      for (const ev of Object.values(this._data.events)) {
        normalizeEvent(ev);
        // reset children
        this.conn.prepare('DELETE FROM events WHERE id = ?').run(ev.id);
        this.conn.prepare(`INSERT INTO events (id, host_token, titulo, reveal_at, fotos_por_convidado, data_evento, local, endereco, mensagem, contato, suspenso, config_json, limites_json, reveal_notified, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          ev.id, ev.hostToken, ev.titulo, ev.revealAt, ev.fotosPorConvidado,
          ev.dataEvento || null, ev.local || '', ev.endereco || '', ev.mensagem || '', ev.contato || '',
          ev.suspenso ? 1 : 0, JSON.stringify(ev.config || {}), JSON.stringify(ev.limites || {}), ev.revealNotified ? 1 : 0, ev.createdAt
        );
        for (const g of ev.guests || []) {
          this.conn.prepare('INSERT INTO guests (id, tenant_id, nome, entrou_em, lista_id) VALUES (?,?,?,?,?)').run(g.id, ev.id, g.nome, g.entrouEm, g.listaId || null);
        }
        for (const p of ev.photos || []) {
          this.conn.prepare('INSERT INTO photos (id, tenant_id, guest_id, autor, ext, criada_em) VALUES (?,?,?,?,?,?)').run(p.id, ev.id, p.guestId, p.autor, p.ext, p.criadaEm);
        }
        for (const l of ev.lista || []) {
          this.conn.prepare('INSERT INTO lista (id, tenant_id, nome, grupo, acompanhantes, rsvp, origem) VALUES (?,?,?,?,?,?,?)').run(l.id, ev.id, l.nome, l.grupo || '', l.acompanhantes || 0, l.rsvp || 'pendente', l.origem || 'organizacao');
        }
        for (const e of ev.equipe || []) {
          this.conn.prepare('INSERT INTO equipe (id, tenant_id, nome, papel, token) VALUES (?,?,?,?,?)').run(e.id, ev.id, e.nome, e.papel, e.token);
        }
        for (const r of ev.recados || []) {
          this.conn.prepare('INSERT INTO recados (id, tenant_id, guest_id, autor, texto, criado_em) VALUES (?,?,?,?,?,?)').run(r.id, ev.id, r.guestId, r.autor, r.texto, r.criadoEm);
        }
        for (const p of ev.push || []) {
          this.conn.prepare('INSERT INTO push_subscriptions (id, tenant_id, guest_id, endpoint, p256dh, auth, criado_em) VALUES (?,?,?,?,?,?,?)').run(p.id, ev.id, p.guestId, p.sub.endpoint, p.sub.keys.p256dh, p.sub.keys.auth, p.criadoEm);
        }
        for (const a of ev.avisos || []) {
          this.conn.prepare('INSERT INTO avisos (id, tenant_id, titulo, corpo, enviado_em, por, alvos, entregues, falhas) VALUES (?,?,?,?,?,?,?,?,?)').run(a.id, ev.id, a.titulo, a.corpo, a.enviadoEm, a.por || '', a.alvos || 0, a.entregues || 0, a.falhas || 0);
        }
      }
      this.conn.exec('COMMIT');
    } catch (e) {
      try { this.conn.exec('ROLLBACK'); } catch {}
      throw e;
    }
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

  // Transação síncrona (SQLite + Node single-thread). `fn` recebe um handle
  // tx { run/get/all } ligado à mesma conexão; não chamar store.save() dentro.
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
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const src = (raw && raw.events) ? raw.events : raw;
    for (const [id, ev] of Object.entries(src || {})) {
      normalizeEvent(ev);
      this._data.events[id] = ev;
    }
    this.save();
    return this.counts();
  }

  // compat: método explícito
  importJson(jsonPath) { return this.importFromJson(jsonPath); }
}

module.exports = SqliteStore;