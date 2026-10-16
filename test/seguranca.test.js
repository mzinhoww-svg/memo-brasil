// Segurança do rebase com o #7: fotos por hash/sessão, rate limit com trust proxy
// padrão 0 (X-Forwarded-For não burla) e válvula MASTER_EMERGENCY auditada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-seg-test-'));
process.env.MASTER_TOKEN = 'master-token-seg';
delete process.env.PUBLIC_URL;
delete process.env.TRUST_PROXY;
const app = require('../server.js');

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.beforeEach(() => app.clearRateLimits());
test.after(() => server.close());

const futuro = () => new Date(Date.now() + 3600e3).toISOString();
const get = (p, h = {}) => fetch(B + p, { headers: h });
const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });

function cookieHeader(setCookie) {
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return raw ? raw.split(';')[0] : '';
}
async function organizadorAutenticado(email) {
  await post('/api/auth/link', { email });
  const log = fs.readFileSync(path.join(process.env.DATA_DIR, 'auth.log'), 'utf8').trim().split('\n').pop();
  const token = decodeURIComponent(log.match(/t=([^\s]+)$/)[1]);
  const r = await post('/api/auth/entrar', { token });
  assert.equal(r.status, 200);
  return cookieHeader(r.headers.get('set-cookie'));
}
async function criarEvento(cookie) {
  const r = await post('/api/events', { titulo: 'Casamento', revealAt: futuro(), fotosPorConvidado: 2 }, cookie ? { cookie } : {});
  assert.equal(r.status, 201);
  return r.json();
}
async function subirFoto(id, guestId) {
  const fd = new FormData();
  fd.append('guestId', guestId);
  fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const r = await fetch(`${B}/api/events/${id}/photos`, { method: 'POST', body: fd });
  assert.equal(r.status, 201);
  return r.json();
}

test('organizador lê a foto antes da revelação pela sessão; outro vínculo não', async () => {
  const cookieA = await organizadorAutenticado('dona@exemplo.com');
  const ev = await criarEvento(cookieA); // cria já vinculado como casal
  const g = await (await post(`/api/events/${ev.id}/guests`, { nome: 'Rafa' })).json();
  const foto = await subirFoto(ev.id, g.guestId);
  const url = `/api/events/${ev.id}/photos/${foto.id}/file`;

  assert.equal((await get(url)).status, 403, 'sem credencial continua bloqueada');
  assert.equal((await get(url, { cookie: cookieA })).status, 200, 'a organização lê antes da revelação');
  assert.equal((await get(url, { 'x-host-token': ev.hostToken })).status, 200, 'token do casal por hash');

  // Organizador de outro casamento não lê o arquivo alheio.
  const cookieB = await organizadorAutenticado('outra@exemplo.com');
  const evB = await criarEvento(cookieB);
  assert.notEqual(evB.id, ev.id);
  assert.equal((await get(url, { cookie: cookieB })).status, 403, 'vínculo de outro tenant não vale');
  assert.equal((await get(`/api/events/${evB.id}/photos/${foto.id}/file`, { cookie: cookieB })).status, 404, 'id de foto de outro tenant não vaza');
});

test('X-Forwarded-For forjado não burla o limite de criação (trust proxy padrão 0)', async () => {
  const statuses = [];
  for (let i = 0; i < 22; i++) {
    const r = await post('/api/events', { titulo: `E${i}`, revealAt: futuro() }, { 'x-forwarded-for': `10.0.0.${i}` });
    statuses.push(r.status);
  }
  assert.ok(statuses.includes(429), 'o limite por IP vale mesmo com o cabeçalho forjado');
});

test('MASTER_EMERGENCY vale com conta master e fica auditada; desligada, recusa', async () => {
  // Sem conta master, o token estático é bootstrap normal.
  assert.equal(app.aceitaTokenEstatico(process.env.MASTER_TOKEN), 'bootstrap');

  const m = await app.criarMaster({ email: 'root@exemplo.com', nome: 'Root', senha: 'senha-muito-forte-123', totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
  assert.ok(m.id);
  const H = { 'x-master-token': process.env.MASTER_TOKEN };
  assert.equal((await get('/api/master/events', H)).status, 403, 'sem válvula, token estático é recusado');

  process.env.MASTER_EMERGENCY = '1';
  assert.equal(app.aceitaTokenEstatico(process.env.MASTER_TOKEN), 'emergencia');
  assert.equal((await get('/api/master/events', H)).status, 200, 'válvula libera em desenvolvimento');
  const linha = app.store.get(`SELECT acao, ator_tipo FROM auditoria WHERE acao = 'master.token_emergencia' ORDER BY id DESC LIMIT 1`);
  assert.ok(linha, 'cada uso da válvula entra na auditoria');
  assert.equal(linha.ator_tipo, 'master');

  delete process.env.MASTER_EMERGENCY;
  assert.equal(app.aceitaTokenEstatico(process.env.MASTER_TOKEN), null);
  assert.equal((await get('/api/master/events', H)).status, 403, 'válvula desligada volta a recusar');
});

test('equipe continua entrando por link próprio (token por hash)', async () => {
  const dono = await criarEvento();
  const m = await (await post(`/api/events/${dono.id}/equipe`, { nome: 'Carla', papel: 'cerimonial' }, { 'x-host-token': dono.hostToken })).json();
  const ct = m.link.split('#t=')[1];
  assert.ok(ct, 'a criação devolve o link uma vez');
  assert.equal((await get(`/api/events/${dono.id}/host`, { 'x-host-token': ct })).status, 200);
  const info = await (await get(`/api/events/${dono.id}/host`, { 'x-host-token': dono.hostToken })).json();
  assert.equal(info.equipe[0].link, null, 'depois da criação só existe o hash, não o link');
  assert.equal((await get(`/api/events/${dono.id}/host`, { 'x-host-token': 'token-inventado' })).status, 403);
});
