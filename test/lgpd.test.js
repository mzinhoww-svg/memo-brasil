// Moderação e privacidade (item 9): consentimento do convidado, denúncia de foto,
// ocultar/apagar com auditoria e o bloqueio de foto oculta para o convidado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-lgpd-'));
process.env.MASTER_TOKEN = 'master-de-teste';
const app = require('../server.js');
const DIR = process.env.DATA_DIR;

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const patch = (p, body, h = {}) => fetch(B + p, { method: 'PATCH', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const del = (p, h = {}) => fetch(B + p, { method: 'DELETE', headers: h });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const futuro = () => new Date(Date.now() + 3600e3).toISOString();
const dbLido = () => JSON.parse(fs.readFileSync(path.join(DIR, 'db.json'), 'utf8'));

async function criarVazio(titulo = 'C') {
  const r = await (await post('/api/events', { titulo, revealAt: futuro(), fotosPorConvidado: 5 })).json();
  return { id: r.id, tk: r.hostToken };
}
async function entrar(ev, nome = 'Rafa', consentimento) {
  const r = await (await post(`/api/events/${ev.id}/guests`, { nome, ...(consentimento ? { consentimento } : {}) })).json();
  return r.guestId;
}
async function criar(titulo = 'C') { const ev = await criarVazio(titulo); ev.guest = await entrar(ev); return ev; }
async function upload(ev, guestId) {
  const fd = new FormData(); fd.append('guestId', guestId); fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const r = await fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', body: fd });
  return (await r.json()).id;
}

test('convidado registra o consentimento na entrada (versão do texto e data)', async () => {
  const a = await criarVazio('Consentimento');
  const r1 = await (await post(`/api/events/${a.id}/guests`, { nome: 'Ana', consentimento: { versao: 'consentimento-convidado v1.0', fotos: true, avisos: false } })).json();
  assert.equal(r1.consentimento.versao, 'consentimento-convidado v1.0');
  const g1 = dbLido().events[a.id].guests.find((g) => g.id === r1.guestId);
  assert.equal(g1.consentimento.fotos, true);
  assert.equal(g1.consentimento.avisos, false);
  assert.ok(!Number.isNaN(new Date(g1.consentimento.em).getTime()));
  assert.equal(dbLido().events[a.id].consentimentos[0].guestId, g1.id);

  // Sem envio do cliente: registra a versão padrão e não presume consentimento.
  const r2 = await (await post(`/api/events/${a.id}/guests`, { nome: 'Bia' })).json();
  const g2 = dbLido().events[a.id].guests.find((g) => g.id === r2.guestId);
  assert.equal(g2.consentimento.versao, 'consentimento-convidado v0.1');
  assert.equal(g2.consentimento.fotos, null);
  assert.equal(dbLido().events[a.id].consentimentos.length, 2);
});

test('denúncia: só convidado do evento denuncia; organização vê; outro casamento não', async () => {
  const a = await criar('Denúncia'), b = await criar('Outro');
  const fotoId = await upload(a, a.guest);
  assert.equal((await post(`/api/events/${a.id}/fotos/${fotoId}/denunciar`, { motivo: 'x' })).status, 403);
  assert.equal((await post(`/api/events/${a.id}/fotos/${fotoId}/denunciar`, { guestId: b.guest })).status, 403);
  assert.equal((await post(`/api/events/${a.id}/fotos/naoexiste/denunciar`, { guestId: a.guest })).status, 404);
  const ok = await post(`/api/events/${a.id}/fotos/${fotoId}/denunciar`, { guestId: a.guest, motivo: 'foto íntima' });
  assert.equal(ok.status, 201);
  assert.equal((await post(`/api/events/${a.id}/fotos/${fotoId}/denunciar`, { guestId: a.guest })).status, 200); // repetida
  const lista = await (await get(`/api/events/${a.id}/denuncias`, { 'x-host-token': a.tk })).json();
  assert.equal(lista.denuncias.length, 1);
  assert.equal(lista.denuncias[0].fotoId, fotoId);
  assert.equal(lista.denuncias[0].status, 'aberta');
  assert.equal((await get(`/api/events/${a.id}/denuncias`, { 'x-host-token': b.tk })).status, 403);
  assert.equal(dbLido().events[a.id].denuncias.length, 1);
});

test('foto oculta some para o convidado (antes e depois da revelação); organização continua vendo', async () => {
  const a = await criar('Moderação');
  const fotoId = await upload(a, a.guest);
  const oc = await (await patch(`/api/events/${a.id}/photos/${fotoId}`, { oculta: true }, { 'x-host-token': a.tk })).json();
  assert.equal(oc.oculta, true);

  // Antes da revelação o convidado não vê a foto na lista e o arquivo dá 403.
  assert.equal((await (await get(`/api/events/${a.id}/photos`)).json()).fotos.length, 0);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`)).status, 403);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`, { 'x-host-token': a.tk })).status, 200);

  // Revela pelo relógio do servidor: o convidado continua sem ver a foto oculta.
  await patch(`/api/events/${a.id}`, { revealAt: new Date(Date.now() - 2000).toISOString() }, { 'x-host-token': a.tk });
  const lista = await (await get(`/api/events/${a.id}/photos`)).json();
  assert.equal(lista.revelado, true);
  assert.equal(lista.fotos.length, 0);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`)).status, 404);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`, { 'x-host-token': a.tk })).status, 200);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`, { 'x-master-token': 'master-de-teste' })).status, 200);

  const mod = await (await get(`/api/events/${a.id}/moderacao`, { 'x-host-token': a.tk })).json();
  assert.equal(mod.fotos[0].oculta, true);

  // ZIP do álbum não inclui a foto oculta (o nome da pasta do autor não aparece).
  const z = await get(`/api/events/${a.id}/fotos.zip`, { 'x-host-token': a.tk });
  assert.equal(z.status, 200);
  assert.ok(!Buffer.from(await z.arrayBuffer()).includes(Buffer.from('Rafa')));

  // Reexibir devolve a foto ao álbum do convidado.
  await patch(`/api/events/${a.id}/photos/${fotoId}`, { oculta: false }, { 'x-host-token': a.tk });
  assert.equal((await (await get(`/api/events/${a.id}/photos`)).json()).fotos.length, 1);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`)).status, 200);
});

test('ocultar fecha a denúncia; apagar foto também fecha', async () => {
  const a = await criar('Denúncia 2');
  const f1 = await upload(a, a.guest);
  await post(`/api/events/${a.id}/fotos/${f1}/denunciar`, { guestId: a.guest, motivo: 'x' });
  await patch(`/api/events/${a.id}/photos/${f1}`, { oculta: true }, { 'x-host-token': a.tk });
  assert.equal(dbLido().events[a.id].denuncias.find((d) => d.fotoId === f1).status, 'moderada');

  const f2 = await upload(a, a.guest);
  await post(`/api/events/${a.id}/fotos/${f2}/denunciar`, { guestId: a.guest, motivo: 'y' });
  assert.equal((await del(`/api/events/${a.id}/photos/${f2}`, { 'x-host-token': a.tk })).status, 200);
  assert.equal(dbLido().events[a.id].denuncias.find((d) => d.fotoId === f2).status, 'foto-apagada');
});
