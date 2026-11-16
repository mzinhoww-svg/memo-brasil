// A tela do master entra por sessão (e-mail + senha + código do app), não pelo
// token estático. Aqui ficam as duas provas: o HTML não usa mais o token e o
// fluxo de sessão que a tela chama funciona de ponta a ponta.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-mastertela-'));
const app = require('../server.js');

function b32decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const s = String(str).replace(/=+$/g, '').toUpperCase().replace(/\s/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const c of s) {
    const idx = alphabet.indexOf(c);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}
const totpNow = (secret) => hotp(b32decode(secret), Math.floor(Date.now() / 30000));

let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.beforeEach(() => app.clearRateLimits());
test.after(() => server.close());

const SENHA = 'senha-muito-forte-123';
const cookieDe = (setCookie) => {
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return raw ? raw.split(';')[0] : '';
};

test('a tela do master pede sessão e não usa mais o token estático', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'master.html'), 'utf8');
  assert.match(html, /\/api\/master\/login/, 'faz login pela rota de sessão');
  assert.match(html, /\/api\/master\/me/, 'confere a sessão ao abrir');
  assert.match(html, /app autenticador/, 'pede o código do app (2º fator)');
  assert.equal(/x-master-token/.test(html), false, 'não manda o token estático em cabeçalho');
  assert.equal(/localStorage\.setItem\(\s*(KEY|'memo:master')/.test(html), false, 'não guarda token no navegador');
  assert.equal(/placeholder: 'Senha do admin master'/.test(html), false, 'não há mais campo só de token');
});

test('fluxo da tela: login por senha+TOTP, sessão, logout', async () => {
  const m = await app.criarMaster({ email: 'tela@exemplo.com', nome: 'Master', senha: SENHA, totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });

  // 1) login como a tela faz (POST /api/master/login com e-mail, senha e código)
  const login = await fetch(`${B}/api/master/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'tela@exemplo.com', senha: SENHA, totp: totpNow(m.totpSecret) }),
  });
  assert.equal(login.status, 200);
  const cookie = cookieDe(login.headers.get('set-cookie'));
  assert.ok(cookie.startsWith('memo_m='), 'recebe o cookie da sessão do master');

  // 2) a tela confere a sessão e carrega a lista
  assert.equal((await fetch(`${B}/api/master/me`, { headers: { cookie } })).status, 200);
  assert.equal((await fetch(`${B}/api/master/events`, { headers: { cookie } })).status, 200);

  // 3) logout (mutação com cookie: exige Origin do próprio host)
  const semOrigin = await fetch(`${B}/api/master/sair`, { method: 'POST', headers: { cookie } });
  assert.equal(semOrigin.status, 403, 'logout sem Origin é recusado (CSRF)');
  const sair = await fetch(`${B}/api/master/sair`, { method: 'POST', headers: { cookie, origin: B } });
  assert.equal(sair.status, 200);
  assert.equal((await fetch(`${B}/api/master/me`, { headers: { cookie } })).status, 401, 'sessão revogada');
});
