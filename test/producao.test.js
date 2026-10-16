// Produção: fail-closed ao subir (NODE_ENV=production exige PUBLIC_URL https) e a
// válvula MASTER_TOKEN_COMPAT/MASTER_EMERGENCY não vale com PUBLIC_URL https.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SERVER = path.join(__dirname, '..', 'server.js');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'memo-prod-test-'));

function subir(env) {
  return spawnSync(process.execPath, [SERVER], {
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, PORT: '0', DATA_DIR: tmp(), ...env },
  });
}

test('NODE_ENV=production sem PUBLIC_URL https não sobe', () => {
  const r = subir({ NODE_ENV: 'production', PUBLIC_URL: '', MASTER_TOKEN: 'x' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /PUBLIC_URL começando com https/);
});

test('NODE_ENV=production com PUBLIC_URL http não sobe', () => {
  const r = subir({ NODE_ENV: 'production', PUBLIC_URL: 'http://memo.exemplo.com' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /PUBLIC_URL começando com https/);
});

test('PUBLIC_URL https sem MASTER_TOTP_KEY não sobe', () => {
  const r = subir({ PUBLIC_URL: 'https://memo.exemplo.com', EMAIL_PROVIDER: 'x', EMAIL_API_KEY: 'y' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /MASTER_TOTP_KEY/);
});

test('com PUBLIC_URL https a válvula de token estático é recusada', async () => {
  const dir = tmp();
  process.env.DATA_DIR = dir;
  process.env.PUBLIC_URL = 'https://memo.exemplo.com';
  process.env.MASTER_TOKEN = 'master-token-prod';
  process.env.MASTER_TOKEN_COMPAT = '1';
  process.env.MASTER_EMERGENCY = '1';
  const app = require('../server.js');
  assert.equal(app.isProd, true);
  assert.equal(app.emergenciaAtiva(), false, 'https desliga a válvula');
  const m = await app.criarMaster({ email: 'root@exemplo.com', nome: 'Root', senha: 'senha-muito-forte-123', totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
  assert.ok(m.id);
  assert.equal(app.aceitaTokenEstatico(process.env.MASTER_TOKEN), null);
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const port = srv.address().port;
  const resp = await fetch(`http://127.0.0.1:${port}/api/master/events`, { headers: { 'x-master-token': process.env.MASTER_TOKEN } });
  assert.equal(resp.status, 403);
  srv.close();
});
