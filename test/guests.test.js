// Convidado sem fricção (item 7): token de entrada, saldo, recados e reentrada.
// O id do convidado sozinho nunca basta: toda ação exige o token no cabeçalho x-guest-token.
// Rodar: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
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
const { tokenHash } = require('../src/store/sqlite');
const abrirBanco = () => { const { DatabaseSync } = require('node:sqlite'); return new DatabaseSync(path.join(DATA_DIR, 'memo.db')); };

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
const rsvp = (ev, token = ev.gt) => post(`/api/events/${ev.id}/rsvp`, { guestId: ev.guest, status: 'confirmado' }, token ? { 'x-guest-token': token } : {});
const push = (ev, token = ev.gt) => post(`/api/events/${ev.id}/push/subscribe`, { guestId: ev.guest, subscription: { endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' } } }, token ? { 'x-guest-token': token } : {});

test('a entrada devolve um token de 32 bytes e o servidor guarda só o hash', async () => {
  const ev = await criar('Token');
  assert.equal(typeof ev.gt, 'string');
  assert.equal(Buffer.from(ev.gt, 'base64url').length, 32);
  // Nada de token em claro nos arquivos do banco (memo.db e WAL).
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (!f.startsWith('memo.db')) continue;
    assert.equal(fs.readFileSync(path.join(DATA_DIR, f)).includes(ev.gt), false, `token cru em ${f}`);
  }
  const conn = abrirBanco();
  const linha = conn.prepare('SELECT token_hash FROM guests WHERE id = ?').get(ev.guest);
  conn.close();
  assert.equal(linha.token_hash, tokenHash(ev.gt), 'o banco guarda o hash (base64url), igual a host e equipe');
  assert.equal(linha.token, undefined);
});

test('id adivinhado sem token não passa em saldo, upload, recados, rsvp nem push', async () => {
  const ev = await criar('So o id');
  assert.equal((await saldo(ev, null)).status, 403);
  assert.equal((await foto(ev, null)).status, 403);
  assert.equal((await recado(ev, null)).status, 403);
  assert.equal((await reentrar(ev, null)).status, 403);
  assert.equal((await rsvp(ev, null)).status, 403);
  assert.equal((await push(ev, null)).status, 403);
});

test('token de outro evento não passa (nem id nem token sozinhos bastam)', async () => {
  const a = await criar('A'), b = await criar('B');
  assert.equal((await saldo(a, b.gt)).status, 403);
  assert.equal((await foto(a, b.gt)).status, 403);
  assert.equal((await recado(a, b.gt)).status, 403);
  assert.equal((await reentrar(a, b.gt)).status, 403);
  assert.equal((await rsvp(a, b.gt)).status, 403);
  assert.equal((await push(a, b.gt)).status, 403);
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

// Migração 003: as colunas do item 7 / decisão 004 existem (uma só ALTER de token_hash).
test('migração 003 aplicada: token_hash em guests e visibilidade em recados', () => {
  const conn = abrirBanco();
  const colunas = (t) => conn.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  const guests = colunas('guests'), recados = colunas('recados');
  const versao = conn.prepare('SELECT MAX(version) AS v FROM schema_migrations WHERE version > 0').get().v;
  conn.close();
  assert.ok(guests.includes('token_hash'));
  assert.ok(recados.includes('visibilidade'));
  assert.ok(versao >= 3, `versão de esquema ${versao}`);
});

// C3: nenhuma resposta pode expor o hash do token (host, equipe ou convidado).
test('nenhuma resposta expõe tokenHash nem hostTokenHash', async () => {
  const ev = await criar('Sem vazar');
  const H = { 'x-host-token': ev.tk };
  const membro = await (await post(`/api/events/${ev.id}/equipe`, { nome: 'Carla', papel: 'cerimonial' }, H)).json();
  const respostas = [
    await get(`/api/events/${ev.id}`),
    await get(`/api/events/${ev.id}/host`, H),
    await get(`/api/events/${ev.id}/moderacao`, H),
    await get(`/api/events/${ev.id}/guests/${ev.guest}`, { 'x-guest-token': ev.gt }),
    await get('/api/master/events', { 'x-master-token': 'master-de-teste' }),
  ];
  for (const r of respostas) {
    const corpo = await r.text();
    assert.equal(corpo.includes('tokenHash'), false, `tokenHash vazou em ${r.url}`);
    assert.equal(corpo.includes('hostTokenHash'), false, `hostTokenHash vazou em ${r.url}`);
  }
  // Sanidade: o hash continua no servidor (a limpeza só vale para a resposta).
  const conn = abrirBanco();
  const th = conn.prepare('SELECT token_hash FROM equipe WHERE id = ?').get(membro.id);
  conn.close();
  assert.ok(th.token_hash, 'o hash da equipe segue gravado');
});
