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

// helpers adicionais para os cenários do item 1
async function criarComReveal(titulo, revealAtISO) {
  const r = await (await post('/api/events', { titulo, revealAt: revealAtISO, fotosPorConvidado: 2 })).json();
  const g = await (await post(`/api/events/${r.id}/guests`, { nome: 'Rafa' })).json();
  return { id: r.id, tk: r.hostToken, guest: g.guestId };
}
const passado = () => new Date(Date.now() - 3600e3).toISOString();

test('criação de evento: valida campos e devolve id e token do organizador', async () => {
  await fetch(`${B}/api/master/settings`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-master-token': 'master-de-teste' }, body: JSON.stringify({ criacaoAberta: true }) });
  const ok = await post('/api/events', { titulo: 'Casamento Teste', revealAt: futuro() });
  assert.equal(ok.status, 201);
  const j = await ok.json();
  assert.match(j.id, /^[A-Za-z0-9_-]+$/);
  assert.match(j.hostToken, /^[A-Za-z0-9_-]+$/);
  const pub = await (await get(`/api/events/${j.id}`)).json();
  assert.equal(pub.titulo, 'Casamento Teste');
  assert.equal((await post('/api/events', { titulo: '', revealAt: futuro() })).status, 400);
  assert.equal((await post('/api/events', { titulo: 'X' })).status, 400);
  assert.equal((await post('/api/events', { titulo: 'X', revealAt: 'nao-e-data' })).status, 400);
});

test('entrada de convidado: cria convidado e consulta saldo; id inexistente', async () => {
  const ev = await criar('Entrada');
  const r = await post(`/api/events/${ev.id}/guests`, { nome: 'Maria' });
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.ok(j.guestId);
  const info = await (await get(`/api/events/${ev.id}/guests/${j.guestId}`)).json();
  assert.equal(info.nome, 'Maria');
  assert.equal(info.fotosRestantes, 2);
  assert.equal((await get(`/api/events/${ev.id}/guests/inexistente`)).status, 404);
});

test('upload de foto: funciona antes da revelação e valida tipo e guest', async () => {
  const ev = await criar('Upload');
  const r = await foto(ev);
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.ok(j.id);
  assert.equal(j.restantes, 1);
  const fd = new FormData();
  fd.append('guestId', ev.guest);
  fd.append('foto', new Blob(['x'], { type: 'text/plain' }), 'x.txt');
  const bad = await fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', body: fd });
  assert.equal(bad.status, 400);
  const fd2 = new FormData();
  fd2.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const noGuest = await fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', body: fd2 });
  assert.equal(noGuest.status, 403);
});

test('limite por convidado bloqueia upload excedente', async () => {
  const ev = await criar('Limite');
  assert.equal((await foto(ev)).status, 201);
  assert.equal((await foto(ev)).status, 201);
  assert.equal((await foto(ev)).status, 409);
});

test('foto bloqueada antes da revelação e liberada depois; token do organizador acessa antes', async () => {
  const ev = await criar('Bloqueio');
  const up = await (await foto(ev)).json();
  const id = up.id;
  assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file`)).status, 403);
  assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file`, { 'x-host-token': 'token-invalido' })).status, 403);
  assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file`, { 'x-host-token': ev.tk })).status, 200);
  const p = await fetch(`${B}/api/events/${ev.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-host-token': ev.tk }, body: JSON.stringify({ revealAt: new Date(Date.now() - 1000).toISOString() }) });
  assert.equal(p.status, 200);
  assert.equal((await get(`/api/events/${ev.id}/photos/${id}/file`)).status, 200);
  const lista = await (await get(`/api/events/${ev.id}/photos`)).json();
  assert.equal(lista.revelado, true);
  assert.ok(lista.fotos[0].url);
});

test('upload após revelação é bloqueado', async () => {
  const ev = await criarComReveal('Depois', passado());
  assert.equal((await foto(ev)).status, 409);
});

test('token do organizador: inválido não acessa; master acessa todos', async () => {
  const a = await criar('TokenOrg');
  const b = await criar('TokenOrg2');
  assert.equal((await get(`/api/events/${b.id}/host`, { 'x-host-token': a.tk })).status, 403);
  assert.equal((await get(`/api/events/${b.id}/host`, { 'x-host-token': 'qualquer' })).status, 403);
  assert.equal((await get(`/api/events/${b.id}/host`, { 'x-host-token': 'master-de-teste' })).status, 200);
});

test('ids inexistentes retornam 404', async () => {
  assert.equal((await get('/api/events/naoexiste')).status, 404);
  assert.equal((await get('/api/events/naoexiste/photos')).status, 404);
  assert.equal((await get('/api/events/naoexiste/photos/x/file')).status, 404);
  assert.equal((await get('/api/events/naoexiste/guests/y')).status, 404);
  assert.equal((await post('/api/events/naoexiste/guests', { nome: 'X' })).status, 404);
});

test('master: token inválido não lista casamentos', async () => {
  assert.equal((await get('/api/master/events', { 'x-master-token': 'errado' })).status, 403);
  assert.equal((await get('/api/master/events', { 'x-master-token': 'master-de-teste' })).status, 200);
});
