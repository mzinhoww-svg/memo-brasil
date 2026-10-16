// Convidado sem fricção (item 7): token de entrada, saldo, recados e reentrada.
// O id do convidado sozinho nunca basta: toda ação exige o token no cabeçalho x-guest-token.
// Rodar: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-guests-'));
process.env.DATA_DIR = DATA_DIR;
process.env.MASTER_TOKEN = 'master-de-teste';
const app = require('../server.js');

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const futuro = () => new Date(Date.now() + 3600e3).toISOString();
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

async function criar(titulo, nome = 'Rafa') {
  const r = await (await post('/api/events', { titulo, revealAt: futuro(), fotosPorConvidado: 2 })).json();
  const g = await (await post(`/api/events/${r.id}/guests`, { nome })).json();
  return { id: r.id, tk: r.hostToken, guest: g.guestId, gt: g.guestToken, nome: g.nome };
}
async function foto(ev, token = ev.gt) {
  const fd = new FormData(); fd.append('guestId', ev.guest); fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  return fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', headers: token ? { 'x-guest-token': token } : {}, body: fd });
}
const saldo = (ev, token = ev.gt) => get(`/api/events/${ev.id}/guests/${ev.guest}`, token ? { 'x-guest-token': token } : {});
const recado = (ev, token = ev.gt) => post(`/api/events/${ev.id}/recados`, { guestId: ev.guest, texto: 'Oi, noivos!' }, token ? { 'x-guest-token': token } : {});
const reentrar = (ev, token = ev.gt) => post(`/api/events/${ev.id}/sessao`, { guestId: ev.guest }, token ? { 'x-guest-token': token } : {});

test('a entrada devolve um token de 32 bytes e o servidor guarda só o hash', async () => {
  const ev = await criar('Token');
  assert.equal(typeof ev.gt, 'string');
  assert.equal(Buffer.from(ev.gt, 'base64url').length, 32);
  const disco = fs.readFileSync(path.join(DATA_DIR, 'db.json'), 'utf8');
  assert.ok(!disco.includes(ev.gt), 'o token cru não pode ficar salvo no disco');
  const salvo = JSON.parse(disco).events[ev.id].guests.find((g) => g.id === ev.guest);
  assert.equal(salvo.tokenHash, sha256(ev.gt));
  assert.equal(salvo.token, undefined);
});

test('id adivinhado sem token não passa em saldo, upload nem recados', async () => {
  const ev = await criar('So o id');
  assert.equal((await saldo(ev, null)).status, 403);
  assert.equal((await foto(ev, null)).status, 403);
  assert.equal((await recado(ev, null)).status, 403);
  assert.equal((await reentrar(ev, null)).status, 403);
});

test('token de outro evento não passa (nem id nem token sozinhos bastam)', async () => {
  const a = await criar('A'), b = await criar('B');
  assert.equal((await saldo(a, b.gt)).status, 403);
  assert.equal((await foto(a, b.gt)).status, 403);
  assert.equal((await recado(a, b.gt)).status, 403);
  assert.equal((await reentrar(a, b.gt)).status, 403);
});

test('token de outro convidado do mesmo evento não passa', async () => {
  const ev = await criar('Dupla');
  const outro = await (await post(`/api/events/${ev.id}/guests`, { nome: 'Bia' })).json();
  assert.equal((await saldo(ev, outro.guestToken)).status, 403);
});

test('token correto: saldo, upload, recados e reentrada funcionam', async () => {
  const ev = await criar('Festa');
  assert.equal((await foto(ev)).status, 201);
  const s = await (await saldo(ev)).json();
  assert.equal(s.nome, 'Rafa');
  assert.equal(s.fotosUsadas, 1);
  assert.equal(s.fotosRestantes, 1);
  assert.equal((await recado(ev)).status, 201);
  const r = await (await reentrar(ev)).json();
  assert.equal(r.guestId, ev.guest);
  assert.equal(r.fotosRestantes, 1);
});

test('token inválido é recusado com 403', async () => {
  const ev = await criar('Invasor');
  assert.equal((await saldo(ev, 'token-de-mentira')).status, 403);
  assert.equal((await reentrar(ev, '')).status, 403);
});
