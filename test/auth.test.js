const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-auth-test-'));
process.env.MASTER_TOKEN = 'master-token-legado';
const app = require('../server.js');

function b32decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const s = String(str).replace(/=+$/g, '').toUpperCase().replace(/\s/g, '');
  let bits = 0, value = 0, out = [];
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
function totpNow(secret) { return hotp(b32decode(secret), Math.floor(Date.now() / 30000)); }
function totpAtStep(secret, step) { return hotp(b32decode(secret), step); }

let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.beforeEach(() => app.clearRateLimits());
test.after(() => server.close());

function extractCookies(setCookie) {
  const jar = {};
  if (!setCookie) return jar;
  for (const raw of Array.isArray(setCookie) ? setCookie : [setCookie]) {
    const part = raw.split(';')[0];
    const i = part.indexOf('=');
    if (i >= 0) jar[part.slice(0, i)] = part.slice(i + 1);
  }
  return jar;
}
function cookieHeader(jar) { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); }
function cookieHasHttpOnly(setCookie) { return setCookie && /HttpOnly/i.test(setCookie); }

// GET com cookie é leitura (livre); POST/PATCH/DELETE com cookie exigem Origin (CSRF).
const comOrigem = (h) => (h.cookie ? { origin: B, ...h } : h);
const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...comOrigem(h) }, body: JSON.stringify(body) });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const del = (p, h = {}) => fetch(B + p, { method: 'DELETE', headers: { 'content-type': 'application/json', ...comOrigem(h) } });
const futuro = () => new Date(Date.now() + 3600e3).toISOString();

async function criarEvento(titulo = 'Evento', cookie = '') {
  const r = await post('/api/events', { titulo, revealAt: futuro(), fotosPorConvidado: 2 }, cookie ? { cookie } : {});
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
// A entrada do convidado exige o aceite do texto vigente (LGPD, #15).
const CONSENT = { versao: 'consentimento-convidado v0.1', fotos: true, avisos: false };
async function subirFoto(eventoId, guestId, guestToken) {
  const fd = new FormData();
  fd.append('guestId', guestId);
  fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const r = await fetch(`${B}/api/events/${eventoId}/photos`, { method: 'POST', headers: guestToken ? { 'x-guest-token': guestToken } : {}, body: fd });
  assert.equal(r.status, 201);
  return r.json();
}

async function criarMasterLogado(email) {
  const senha = 'senha-muito-forte-123';
  const m = await app.criarMaster({ email, nome: 'Master', senha, totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
  const login = await post('/api/master/login', { email, senha, totp: totpNow(m.totpSecret) });
  assert.equal(login.status, 200);
  return { cookie: cookieHeader(extractCookies(login.headers.get('set-cookie'))), master: m, senha };
}

async function ultimoTokenDoLog() {
  const log = path.join(process.env.DATA_DIR, 'auth.log');
  if (!fs.existsSync(log)) return null;
  const line = fs.readFileSync(log, 'utf8').trim().split('\n').pop();
  const m = line.match(/t=([^\s]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function linkToken(email) {
  const r = await post('/api/auth/link', { email });
  assert.equal(r.status, 202);
  return ultimoTokenDoLog();
}

async function loginOrganizador(email) {
  const token = await linkToken(email);
  assert.ok(token);
  const r = await post('/api/auth/entrar', { token });
  assert.equal(r.status, 200);
  const j = await r.json();
  const jar = extractCookies(r.headers.get('set-cookie'));
  assert.ok(jar.memo_sid);
  assert.ok(cookieHasHttpOnly(r.headers.get('set-cookie')));
  return { cookie: cookieHeader(jar), id: j.organizador.id, email: j.organizador.email };
}

test('link mágico: reuso e expiração retornam 410', async () => {
  const token = await linkToken('reuso@exemplo.com');
  const r1 = await post('/api/auth/entrar', { token });
  assert.equal(r1.status, 200);
  const r2 = await post('/api/auth/entrar', { token });
  assert.equal(r2.status, 410);

  const token2 = await linkToken('expira@exemplo.com');
  const h = crypto.createHash('sha256').update(token2).digest('hex');
  app.store.run('UPDATE magic_tokens SET expira_em = ? WHERE token_hash = ?', new Date(Date.now() - 1000).toISOString(), h);
  const r3 = await post('/api/auth/entrar', { token: token2 });
  assert.equal(r3.status, 410);
});

test('pedido de link público ignora eventoId/papel (sem escalada)', async () => {
  const ev = await criarEvento('Vitima');
  assert.equal(ev.status, 201);
  const eventoId = ev.json.id;
  const r = await post('/api/auth/link', { email: 'evil@exemplo.com', eventoId, papel: 'casal' });
  assert.equal(r.status, 202);
  const token = await ultimoTokenDoLog();
  assert.ok(token);
  const r2 = await post('/api/auth/entrar', { token });
  assert.equal(r2.status, 200);
  const cookie = cookieHeader(extractCookies(r2.headers.get('set-cookie')));
  const host = await get(`/api/events/${eventoId}/host`, { cookie });
  assert.equal(host.status, 403, 'não deve virar casal do evento alheio');
});

test('sessão organizador é isolada entre tenants', async () => {
  const a = await criarEvento('A');
  const b = await criarEvento('B');
  const idA = a.json.id, idB = b.json.id;
  const org = await loginOrganizador('org@exemplo.com');
  app.store.run('INSERT INTO organizador_membros (id, organizador_id, evento_id, papel, criado_em) VALUES (?,?,?,?,?)',
    crypto.randomBytes(6).toString('base64url'), org.id, idA, 'casal', new Date().toISOString());
  assert.equal((await get(`/api/events/${idA}/host`, { cookie: org.cookie })).status, 200);
  assert.equal((await get(`/api/events/${idB}/host`, { cookie: org.cookie })).status, 403);
});

test('cookie é httpOnly, logout invalida e me retorna 401', async () => {
  const org = await loginOrganizador('cookie@exemplo.com');
  const me = await get('/api/auth/me', { cookie: org.cookie });
  assert.equal(me.status, 200);
  const out = await post('/api/auth/sair', {}, { cookie: org.cookie });
  assert.equal(out.status, 200);
  const me2 = await get('/api/auth/me', { cookie: org.cookie });
  assert.equal(me2.status, 401);
});

test('TOTP: reutilização e código antigo são rejeitados', async () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const m = await app.criarMaster({ email: 'master@exemplo.com', nome: 'Master', senha: 'senha-muito-forte-123', totpSecret: secret });
  const code = totpNow(secret);
  const r1 = await post('/api/master/login', { email: 'master@exemplo.com', senha: 'senha-muito-forte-123', totp: code });
  assert.equal(r1.status, 200);
  const r2 = await post('/api/master/login', { email: 'master@exemplo.com', senha: 'senha-muito-forte-123', totp: code });
  assert.equal(r2.status, 401, 'reuso do mesmo passo');
  const antigo = totpAtStep(secret, Math.floor(Date.now() / 30000) - 2);
  const r3 = await post('/api/master/login', { email: 'master@exemplo.com', senha: 'senha-muito-forte-123', totp: antigo });
  assert.equal(r3.status, 401, 'código de passo anterior');
});

test('rate limit na criação de eventos', async () => {
  const statuses = [];
  for (let i = 0; i < 22; i++) {
    const r = await post('/api/events', { titulo: `E${i}`, revealAt: futuro() });
    statuses.push(r.status);
  }
  assert.ok(statuses.some((s) => s === 429), 'atingiu limite');
  assert.ok(statuses.filter((s) => s === 201).length >= 10, 'primeiras criações foram liberadas');
});

test('token master estático é rejeitado quando existe conta master', async () => {
  const m = await app.criarMaster({ email: 'master2@exemplo.com', nome: 'M', senha: 'senha-muito-forte-123', totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
  assert.ok(m.id);
  const r = await get('/api/master/events', { 'x-master-token': process.env.MASTER_TOKEN });
  assert.equal(r.status, 403);
  const code = totpNow(m.totpSecret);
  const login = await post('/api/master/login', { email: 'master2@exemplo.com', senha: 'senha-muito-forte-123', totp: code });
  assert.equal(login.status, 200);
  const cookie = cookieHeader(extractCookies(login.headers.get('set-cookie')));
  assert.equal((await get('/api/master/events', { cookie })).status, 200);
});

test('vínculo de organizador sobrevive a save() do store', async () => {
  const ev = await criarEvento('Persist');
  const eventoId = ev.json.id;
  const org = await loginOrganizador('persist@exemplo.com');
  app.store.run('INSERT INTO organizador_membros (id, organizador_id, evento_id, papel, criado_em) VALUES (?,?,?,?,?)',
    crypto.randomBytes(6).toString('base64url'), org.id, eventoId, 'casal', new Date().toISOString());
  assert.equal((await get(`/api/events/${eventoId}/host`, { cookie: org.cookie })).status, 200);
  app.store.save(); // simula qualquer mutação que salva
  assert.equal((await get(`/api/events/${eventoId}/host`, { cookie: org.cookie })).status, 200, 'vínculo persistiu');
});

test('exclusão de evento gera linha de auditoria encadeada', async () => {
  const ev = await criarEvento('Audit');
  const eventoId = ev.json.id;
  const m = await app.criarMaster({ email: 'master3@exemplo.com', nome: 'M', senha: 'senha-muito-forte-123', totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
  const code = totpNow(m.totpSecret);
  const login = await post('/api/master/login', { email: 'master3@exemplo.com', senha: 'senha-muito-forte-123', totp: code });
  const cookie = cookieHeader(extractCookies(login.headers.get('set-cookie')));
  const before = app.store.get('SELECT hash_atual FROM auditoria ORDER BY id DESC LIMIT 1');
  const delR = await fetch(`${B}/api/master/events/${eventoId}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', cookie, origin: B },
    body: JSON.stringify({ confirmar: eventoId }),
  });
  assert.equal(delR.status, 200);
  const last = app.store.get('SELECT acao, hash_anterior, hash_atual FROM auditoria WHERE acao = ? ORDER BY id DESC LIMIT 1', 'evento.excluido');
  assert.ok(last);
  assert.equal(last.hash_anterior, before ? before.hash_atual : '');
  assert.ok(last.hash_atual);
});

test('master por sessão abre painel, moderação, arquivo e ZIP (não 500)', async () => {
  const { cookie } = await criarMasterLogado('painel-master@exemplo.com');
  const ev = await criarEvento('Painel do master');
  assert.equal(ev.status, 201);
  const g = await (await post(`/api/events/${ev.json.id}/guests`, { nome: 'Rafa', consentimento: CONSENT })).json();
  const foto = await subirFoto(ev.json.id, g.guestId, g.guestToken);
  const H = { cookie };

  assert.equal((await get(`/api/events/${ev.json.id}/host`, H)).status, 200, '/host');
  assert.equal((await get(`/api/events/${ev.json.id}/lista`, H)).status, 200, '/lista');
  assert.equal((await get(`/api/events/${ev.json.id}/moderacao`, H)).status, 200, '/moderacao');
  assert.equal((await get(`/api/events/${ev.json.id}/photos/${foto.id}/file`, H)).status, 200, 'arquivo antes da revelação');
  const zip = await get(`/api/events/${ev.json.id}/fotos.zip`, H);
  assert.equal(zip.status, 200, '/fotos.zip antes da revelação');
  assert.equal((await get(`/api/events/${ev.json.id}/lista.csv`, H)).status, 200, '/lista.csv');
  const patch = await fetch(`${B}/api/events/${ev.json.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie, origin: B },
    body: JSON.stringify({ titulo: 'Renomeado pelo master' }),
  });
  assert.equal(patch.status, 200, 'PATCH do evento');
  assert.equal((await patch.json()).titulo, 'Renomeado pelo master');
});

test('TOTP: dois logins concorrentes com o mesmo código — só um consome', async () => {
  const senha = 'senha-muito-forte-123';
  const m = await app.criarMaster({ email: 'conc-totp@exemplo.com', nome: 'M', senha, totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
  const body = { email: 'conc-totp@exemplo.com', senha, totp: totpNow(m.totpSecret) };
  const [a, b] = await Promise.all([post('/api/master/login', body), post('/api/master/login', body)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 401], 'um entra, o outro não');
});

test('recuperação: dois logins concorrentes com o mesmo código — só um consome', async () => {
  const senha = 'senha-muito-forte-123';
  const m = await app.criarMaster({ email: 'conc-rec@exemplo.com', nome: 'M', senha, totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
  const body = { email: 'conc-rec@exemplo.com', senha, recoveryCode: m.recoveryCodes[0] };
  const [a, b] = await Promise.all([post('/api/master/login', body), post('/api/master/login', body)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 401], 'código de recuperação é de uso único');
  // E o mesmo código não vale de novo depois.
  assert.equal((await post('/api/master/login', body)).status, 401);
});

test('sem provedor de e-mail fora de dev/teste, o pedido de link não promete envio', async () => {
  const antigo = process.env.NODE_ENV;
  process.env.NODE_ENV = 'staging';
  try {
    const r = await post('/api/auth/link', { email: 'staging@exemplo.com' });
    assert.equal(r.status, 503);
  } finally { process.env.NODE_ENV = antigo; }
});
