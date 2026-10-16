// Testes de API e de isolamento entre casamentos (tenants). Rodar: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-test-'));
process.env.MASTER_TOKEN = 'master-de-teste';
const app = require('../server.js');

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const futuro = () => new Date(Date.now() + 3600e3).toISOString();
async function criar(titulo) {
  const r = await (await post('/api/events', { titulo, revealAt: futuro(), fotosPorConvidado: 2 })).json();
  const g = await (await post(`/api/events/${r.id}/guests`, { nome: 'Rafa' })).json();
  return { id: r.id, tk: r.hostToken, guest: g.guestId };
}
async function foto(ev) {
  const fd = new FormData(); fd.append('guestId', ev.guest); fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  return fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', body: fd });
}

test('álbum é individual: fotos de um casamento não aparecem em outro', async () => {
  const a = await criar('A'), b = await criar('B');
  const up = await (await foto(a)).json();
  assert.ok(up.id);
  const la = await (await get(`/api/events/${a.id}/photos`)).json();
  const lb = await (await get(`/api/events/${b.id}/photos`)).json();
  assert.equal(la.fotos.length, 1);
  assert.equal(lb.fotos.length, 0);
  assert.equal((await get(`/api/events/${b.id}/photos/${up.id}/file`, { 'x-host-token': b.tk })).status, 404);
});

test('convidado lê a ficha pública do evento sem vazar dados da organização', async () => {
  const a = await criar('A');
  const r = await get(`/api/events/${a.id}`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.titulo, 'A');
  assert.equal(j.id, a.id);
  assert.equal(j.hostToken, undefined);
  assert.equal(j.lista, undefined);
  assert.equal(JSON.stringify(j).includes('token'), false, 'nada de token na ficha pública');
});

test('convidado de um casamento não fotografa em outro', async () => {
  const a = await criar('A'), b = await criar('B');
  const fd = new FormData(); fd.append('guestId', a.guest); fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const r = await fetch(`${B}/api/events/${b.id}/photos`, { method: 'POST', body: fd });
  assert.equal(r.status, 403);
});

test('foto fica bloqueada antes da revelação e o casal de outro evento não acessa', async () => {
  const a = await criar('A'), b = await criar('B');
  const { id } = await (await foto(a)).json();
  assert.equal((await get(`/api/events/${a.id}/photos/${id}/file`)).status, 403);
  assert.equal((await get(`/api/events/${a.id}/photos/${id}/file`, { 'x-host-token': b.tk })).status, 403);
  assert.equal((await get(`/api/events/${a.id}/photos/${id}/file`, { 'x-host-token': a.tk })).status, 200);
  assert.equal((await get(`/api/events/${a.id}/photos/${id}/file`, { 'x-host-token': 'master-de-teste' })).status, 200);
});

test('painel do casal não abre outro casamento; master abre todos', async () => {
  const a = await criar('A'), b = await criar('B');
  assert.equal((await get(`/api/events/${b.id}/host`, { 'x-host-token': a.tk })).status, 403);
  assert.equal((await get(`/api/events/${b.id}/host`, { 'x-host-token': 'master-de-teste' })).status, 200);
  assert.equal((await get('/api/master/events', { 'x-master-token': a.tk })).status, 403);
  assert.equal((await get('/api/master/events', { 'x-master-token': 'master-de-teste' })).status, 200);
});

test('limite de fotos por convidado e upload bloqueado após revelação', async () => {
  const a = await criar('A');
  assert.equal((await foto(a)).status, 201);
  assert.equal((await foto(a)).status, 201);
  assert.equal((await foto(a)).status, 409);
});

test('cerimonial não altera equipe', async () => {
  const a = await criar('A');
  const m = await (await post(`/api/events/${a.id}/equipe`, { nome: 'Carla', papel: 'cerimonial' }, { 'x-host-token': a.tk })).json();
  const ct = m.link.split('#t=')[1];
  assert.equal((await get(`/api/events/${a.id}/lista`, { 'x-host-token': ct })).status, 200);
  assert.equal((await post(`/api/events/${a.id}/equipe`, { nome: 'X' }, { 'x-host-token': ct })).status, 403);
});

test('apenasLista exige nome da lista; suspensão bloqueia entrada', async () => {
  const a = await criar('A');
  const H = { 'x-host-token': a.tk };
  await fetch(`${B}/api/events/${a.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', ...H }, body: JSON.stringify({ config: { apenasLista: true } }) });
  assert.equal((await post(`/api/events/${a.id}/guests`, { nome: 'Penetra' })).status, 403);
  await post(`/api/events/${a.id}/lista`, { texto: 'Maria Silva' }, H);
  assert.equal((await post(`/api/events/${a.id}/guests`, { nome: 'maria silva' })).status, 201);
  await fetch(`${B}/api/master/events/${a.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-master-token': 'master-de-teste' }, body: JSON.stringify({ suspenso: true }) });
  assert.equal((await post(`/api/events/${a.id}/guests`, { nome: 'Maria Silva' })).status, 403);
});

test('variáveis da plataforma: fechar cadastro bloqueia novos eventos', async () => {
  const M = { 'content-type': 'application/json', 'x-master-token': 'master-de-teste' };
  await fetch(`${B}/api/master/settings`, { method: 'PUT', headers: M, body: JSON.stringify({ criacaoAberta: false }) });
  assert.equal((await post('/api/events', { titulo: 'X', revealAt: futuro() })).status, 403);
  await fetch(`${B}/api/master/settings`, { method: 'PUT', headers: M, body: JSON.stringify({ criacaoAberta: true }) });
  assert.equal((await post('/api/events', { titulo: 'X', revealAt: futuro() })).status, 201);
});

test('push: inscrição inválida é recusada; manifest é por casamento', async () => {
  const a = await criar('Casamento Z');
  assert.equal((await post(`/api/events/${a.id}/push/subscribe`, { guestId: a.guest, subscription: { endpoint: 'http://x' } })).status, 400);
  const ok = await post(`/api/events/${a.id}/push/subscribe`, { guestId: a.guest, subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } } });
  assert.equal(ok.status, 201);
  const m = await (await get(`/e/${a.id}/manifest.webmanifest`)).json();
  assert.equal(m.name, 'Casamento Z');
  assert.equal(m.start_url, `/e/${a.id}/inicio`);
});

test('ZIP do álbum só depois da revelação e só do próprio casamento', async () => {
  const a = await criar('A');
  assert.equal((await get(`/api/events/${a.id}/fotos.zip`, { 'x-host-token': a.tk })).status, 409);
  const M = { 'x-host-token': 'master-de-teste' };
  const r = await get(`/api/events/${a.id}/fotos.zip`, M);
  assert.equal(r.status, 200);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.slice(0, 2).toString(), 'PK');
  const b = await criar('B');
  assert.equal((await get(`/api/events/${a.id}/fotos.zip`, { 'x-host-token': b.tk })).status, 403);
});
