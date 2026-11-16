const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

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

test('migrate-json: divergência preserva o JSON (exit 1, sem renomear)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-migrate-guard-'));
  const jsonPath = path.join(dir, 'db.json');
  fs.writeFileSync(jsonPath, JSON.stringify(buildJson()));

  // O construtor importa o JSON e grava o marcador; depois adicionamos dados
  // novos no banco para forçar a divergência de contagens.
  const createStore = require('../src/store');
  const store = createStore(dir);
  store.db.events.ev1.photos.push({ id: 'p2', ext: 'jpg', guestId: 'g1', autor: 'Rafa', criadaEm: new Date().toISOString() });
  store.save();
  store.close();

  const r = spawnSync(process.execPath, ['scripts/migrate-json.js'], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR: dir },
  });

  assert.notEqual(r.status, 0, 'migração com divergência deve falhar');
  assert.match(r.stderr.toString(), /diverg/i);
  assert.ok(fs.existsSync(jsonPath), 'o JSON original deve ser preservado');
  const migrados = fs.readdirSync(dir).filter((f) => f.startsWith('db.json.migrated-'));
  assert.equal(migrados.length, 0, 'nenhum arquivo .migrated- deve ser criado');

  const store2 = createStore(dir);
  assert.equal(store2.counts().photos, 2, 'os dados novos não podem ser apagados');
  store2.close();
});

test('migrate-json: caminho feliz verifica e só então renomeia o JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-migrate-ok-'));
  const jsonPath = path.join(dir, 'db.json');
  fs.writeFileSync(jsonPath, JSON.stringify(buildJson()));

  const r = spawnSync(process.execPath, ['scripts/migrate-json.js'], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR: dir },
  });

  assert.equal(r.status, 0, r.stderr.toString());
  assert.match(r.stdout.toString(), /Verificação: OK/);
  assert.equal(fs.existsSync(jsonPath), false, 'o JSON deve ser renomeado após a verificação');
  const migrados = fs.readdirSync(dir).filter((f) => f.startsWith('db.json.migrated-'));
  assert.equal(migrados.length, 1, 'deve existir exatamente um arquivo .migrated-');
});
