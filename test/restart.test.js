// Regressão: após reiniciar o app, o store só carrega hashes de token.
// Casal e equipe devem continuar moderando (ver fotos pré-revelação) e o
// painel não pode emitir link com token em claro que já não existe.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-restart-test-'));
process.env.MASTER_TOKEN = 'master-de-teste';

const SERVER = path.join(__dirname, '..', 'server.js');
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

const abertos = [];
function start() {
  delete require.cache[require.resolve(SERVER)];
  const app = require(SERVER);
  return new Promise((resolve) => {
    const srv = app.listen(0, () => { abertos.push(srv); resolve({ srv, base: `http://127.0.0.1:${srv.address().port}` }); });
  });
}
function stop(srv) {
  const i = abertos.indexOf(srv);
  if (i >= 0) abertos.splice(i, 1);
  return new Promise((resolve) => { srv.closeAllConnections?.(); srv.close(resolve); });
}
test.after(async () => { for (const srv of [...abertos]) await stop(srv); });

const post = (base, p, body, h = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (base, p, h = {}) => fetch(base + p, { headers: h });
const futuro = () => new Date(Date.now() + 3600e3).toISOString();
const CONSENT = { versao: 'consentimento-convidado v0.1', fotos: true, avisos: false };

async function novaFesta(base, titulo) {
  const r = await (await post(base, '/api/events', { titulo, revealAt: futuro(), fotosPorConvidado: 5 })).json();
  const g = await (await post(base, `/api/events/${r.id}/guests`, { nome: 'Rafa', consentimento: CONSENT })).json();
  const fd = new FormData(); fd.append('guestId', g.guestId); fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const up = await (await fetch(`${base}/api/events/${r.id}/photos`, { method: 'POST', headers: { 'x-guest-token': g.guestToken }, body: fd })).json();
  return { id: r.id, tk: r.hostToken, photo: up.id };
}

test('após restart, casal e equipe mantêm a moderação pré-revelação', async () => {
  const first = await start();
  const A = await novaFesta(first.base, 'A');
  const B = await novaFesta(first.base, 'B');
  const m = await (await post(first.base, `/api/events/${A.id}/equipe`, { nome: 'Carla', papel: 'cerimonial' }, { 'x-host-token': A.tk })).json();
  const equipeToken = m.link.split('#t=')[1];
  assert.ok(equipeToken && equipeToken !== 'undefined');
  await stop(first.srv);

  const second = await start();
  const file = (tk) => get(second.base, `/api/events/${A.id}/photos/${A.photo}/file`, tk ? { 'x-host-token': tk } : {});
  assert.equal((await file()).status, 403, 'anônimo não vê antes da revelação');
  assert.equal((await file(A.tk)).status, 200, 'host mantém acesso após restart');
  assert.equal((await file(equipeToken)).status, 200, 'equipe mantém acesso após restart');
  assert.equal((await file(B.tk)).status, 403, 'outro evento não acessa');

  // Moderação (listagem) também segue acessível para a equipe.
  assert.equal((await get(second.base, `/api/events/${A.id}/moderacao`, { 'x-host-token': equipeToken })).status, 200);

  // Item 4: o painel não pode montar link com token inexistente depois do restart.
  const host = await (await get(second.base, `/api/events/${A.id}/host`, { 'x-host-token': A.tk })).json();
  assert.equal(host.equipe.length, 1);
  const membro = host.equipe[0];
  assert.equal(membro.link, null, 'sem link em claro após restart');
  assert.equal(membro.linkEmitido, true);
  assert.equal(JSON.stringify(host).includes('#t=undefined'), false);

  // Rotacionar gera um link novo e válido, com o acesso preservado.
  const rot = await (await post(second.base, `/api/events/${A.id}/equipe/${membro.id}/rotacionar-link`, {}, { 'x-host-token': A.tk })).json();
  const novo = rot.link.split('#t=')[1];
  assert.ok(novo && novo !== 'undefined');
  assert.equal((await get(second.base, `/api/events/${A.id}/moderacao`, { 'x-host-token': novo })).status, 200);
  assert.equal((await get(second.base, `/api/events/${A.id}/moderacao`, { 'x-host-token': equipeToken })).status, 403, 'o link antigo deixa de funcionar');

  await stop(second.srv);
});

// C2: convidado criado antes do token (sem tokenHash) reivindica a própria sessão
// pelo nome na primeira entrada — uma única vez — para não perder a cota de fotos.
test('C2: convidado antigo sem tokenHash reivindica a sessão pelo nome uma vez', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const first = await start();
  const r = await (await post(first.base, '/api/events', { titulo: 'Legado', revealAt: futuro(), fotosPorConvidado: 3 })).json();
  const g = await (await post(first.base, `/api/events/${r.id}/guests`, { nome: 'Antiga', consentimento: CONSENT })).json();
  await stop(first.srv);

  // Simula a migração do JSON: convidado sem token (hash apagado no banco).
  const conn = new DatabaseSync(path.join(process.env.DATA_DIR, 'memo.db'));
  conn.prepare('UPDATE guests SET token_hash = NULL WHERE id = ?').run(g.guestId);
  conn.close();

  const again = await start();
  const claim = await post(again.base, `/api/events/${r.id}/guests`, { nome: 'Antiga', consentimento: CONSENT });
  assert.equal(claim.status, 201);
  const c = await claim.json();
  assert.equal(c.reivindicado, true);
  assert.equal(c.guestId, g.guestId, 'mesma pessoa, não uma nova');
  assert.equal((await get(again.base, `/api/events/${r.id}/guests/${c.guestId}`, { 'x-guest-token': c.guestToken })).status, 200);

  // A reivindicação vale uma vez: a próxima entrada com o mesmo nome cria outro convidado.
  const outra = await (await post(again.base, `/api/events/${r.id}/guests`, { nome: 'Antiga', consentimento: CONSENT })).json();
  assert.notEqual(outra.guestId, c.guestId);
  await stop(again.srv);
});
