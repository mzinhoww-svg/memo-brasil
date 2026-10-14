const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-store-test-'));
const DATA_DIR = process.env.DATA_DIR;
const createStore = require('../src/store');
const { tokenHash, verifyToken } = require('../src/store/sqlite');

function buildJson() {
  return {
    events: {
      ev1: {
        id: 'ev1', hostToken: 'tok123', titulo: 'A', revealAt: new Date(Date.now() + 3600e3).toISOString(), fotosPorConvidado: 5,
        guests: [{ id: 'g1', nome: 'Rafa', entrouEm: new Date().toISOString() }],
        photos: [{ id: 'p1', ext: 'jpg', guestId: 'g1', autor: 'Rafa', criadaEm: new Date().toISOString() }],
        lista: [], equipe: [], recados: [], push: [], avisos: [], config: {}, limites: {},
      },
    },
  };
}

test('migração idempotente: segunda execução recusa e não apaga dados novos', () => {
  const dbJson = path.join(DATA_DIR, 'db.json');
  fs.writeFileSync(dbJson, JSON.stringify(buildJson()));
  const store = createStore(DATA_DIR);
  assert.equal(store.counts().events, 1);
  assert.equal(store.counts().photos, 1);
  // dados novos
  store.db.events.ev1.photos.push({ id: 'p2', ext: 'jpg', guestId: 'g1', autor: 'Rafa', criadaEm: new Date().toISOString() });
  store.save();
  store.close();

  const r2 = spawnSync(process.execPath, ['scripts/migrate-json.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, DATA_DIR } });
  assert.notEqual(r2.status, 0, 'segunda migração deveria falhar');

  const store2 = createStore(DATA_DIR);
  assert.equal(store2.counts().events, 1);
  assert.equal(store2.counts().photos, 2, 'foto nova não deve ter sido apagada');
  store2.close();
});

test('evento excluído não ressuscita no restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-del-test-'));
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(buildJson()));
  const store = createStore(dir);
  assert.equal(store.counts().events, 1);
  store.deleteEvent('ev1');
  assert.equal(store.counts().events, 0);
  store.close();

  const store2 = createStore(dir);
  assert.equal(store2.counts().events, 0, 'evento excluído não deve voltar');
  assert.ok(store2.schemaVersion() >= 0, 'marcador de migração deve existir');
  store2.close();
});

test('cascade funciona mesmo com foreign_keys=OFF (triggers)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-cascade-test-'));
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(buildJson()));
  const store = createStore(dir);
  store.close();

  const raw = new DatabaseSync(path.join(dir, 'memo.db'));
  raw.exec('PRAGMA foreign_keys=OFF');
  raw.prepare('DELETE FROM events WHERE id = ?').run('ev1');
  raw.close();

  const check = new DatabaseSync(path.join(dir, 'memo.db'));
  const guests = check.prepare('SELECT COUNT(*) AS c FROM guests').get().c;
  const photos = check.prepare('SELECT COUNT(*) AS c FROM photos').get().c;
  check.close();
  assert.equal(guests, 0, 'guests devem ter sido removidos por trigger');
  assert.equal(photos, 0, 'photos devem ter sido removidas por trigger');
});

test('FK rejeita tenant_id inexistente em SQL direto', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-fk-test-'));
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(buildJson()));
  const store = createStore(dir);
  assert.throws(() => {
    store.run('INSERT INTO photos (id, tenant_id, guest_id, autor, ext, criada_em) VALUES (?,?,?,?,?,?)', 'px', 'outro', 'g1', 'a', 'jpg', new Date().toISOString());
  }, /FOREIGN KEY|foreign key/i);
  store.close();
});

test('save() incremental não apaga tabelas independentes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-diff-test-'));
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(buildJson()));
  const store = createStore(dir);
  store.run('CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, token TEXT)');
  store.run('INSERT INTO auth_sessions (id, token) VALUES (?,?)', 's1', 'abc');
  store.db.events.ev1.mensagem = 'atualizado';
  store.save();
  const row = store.get('SELECT token FROM auth_sessions WHERE id=?', 's1');
  assert.equal(row.token, 'abc');
  store.close();
});

test('tokens de host e equipe são armazenados como hash', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-hash-test-'));
  const store = createStore(dir);
  store.db.events.e1 = {
    id: 'e1', hostToken: 'rawhost', hostTokenHash: tokenHash('rawhost'), titulo: 'T', revealAt: new Date(Date.now() + 3600e3).toISOString(), fotosPorConvidado: 5,
    dataEvento: null, local: '', endereco: '', mensagem: '', contato: '', suspenso: false, limites: {}, config: { recadosAtivos: true, apenasLista: false, mostrarAutor: true },
    revealNotified: false, createdAt: new Date().toISOString(),
    guests: [], photos: [], lista: [], equipe: [{ id: 'm1', nome: 'Carla', papel: 'cerimonial', token: 'rawtok', tokenHash: tokenHash('rawtok') }], recados: [], push: [], avisos: [],
  };
  store.save();
  store.close();

  const raw = new DatabaseSync(path.join(dir, 'memo.db'));
  const ev = raw.prepare('SELECT host_token_hash FROM events WHERE id=?').get('e1');
  const eq = raw.prepare('SELECT token_hash FROM equipe WHERE id=?').get('m1');
  raw.close();
  assert.ok(verifyToken('rawhost', ev.host_token_hash));
  assert.ok(verifyToken('rawtok', eq.token_hash));

  const store2 = createStore(dir);
  assert.ok(verifyToken('rawhost', store2.db.events.e1.hostTokenHash));
  assert.ok(verifyToken('rawtok', store2.db.events.e1.equipe[0].tokenHash));
  store2.close();
});