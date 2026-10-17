// Moderação e privacidade (item 9): consentimento exigido na entrada, denúncia
// autenticada por token do convidado, ocultar/apagar auditado, bloqueio da foto
// oculta e contagens que ignoram ocultas. Tudo sobre o Store/SQLite.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-lgpd-'));
process.env.MASTER_TOKEN = 'master-de-teste';
const app = require('../server.js');
const DIR = process.env.DATA_DIR;

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
const CONSENT = { versao: 'consentimento-convidado v0.1', fotos: true, avisos: false };
let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const patch = (p, body, h = {}) => fetch(B + p, { method: 'PATCH', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const del = (p, h = {}) => fetch(B + p, { method: 'DELETE', headers: h });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const futuro = () => new Date(Date.now() + 3600e3).toISOString();
const evento = (id) => app.store.db.events[id];
const sql = (q, ...p) => { const db = new DatabaseSync(path.join(DIR, 'memo.db')); try { return db.prepare(q).get(...p); } finally { db.close(); } };

async function criarVazio(titulo = 'C') {
  const r = await (await post('/api/events', { titulo, revealAt: futuro(), fotosPorConvidado: 5 })).json();
  return { id: r.id, tk: r.hostToken };
}
async function entrar(ev, nome = 'Rafa', consentimento = CONSENT) {
  const r = await (await post(`/api/events/${ev.id}/guests`, { nome, consentimento })).json();
  return r;
}
async function criar(titulo = 'C') {
  const ev = await criarVazio(titulo);
  const g = await entrar(ev);
  ev.guest = g.guestId; ev.guestToken = g.guestToken;
  return ev;
}
async function upload(ev, guestId) {
  const fd = new FormData(); fd.append('guestId', guestId); fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  const r = await fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', body: fd });
  return (await r.json()).id;
}

test('entrada exige consentimento com a versão vigente e fotos:true', async () => {
  const a = await criarVazio('Consentimento');
  assert.equal((await post(`/api/events/${a.id}/guests`, { nome: 'Sem' })).status, 400);
  assert.equal((await post(`/api/events/${a.id}/guests`, { nome: 'Nao', consentimento: { versao: CONSENT.versao, fotos: false } })).status, 400);
  assert.equal((await post(`/api/events/${a.id}/guests`, { nome: 'Velha', consentimento: { versao: 'consentimento-convidado v0.0', fotos: true } })).status, 400);
  const r = await (await post(`/api/events/${a.id}/guests`, { nome: 'Ana', consentimento: { ...CONSENT, avisos: true } })).json();
  assert.ok(r.guestToken);
  assert.equal(r.consentimento.versao, CONSENT.versao);
  const g = evento(a.id).guests.find((x) => x.id === r.guestId);
  assert.equal(g.consentimento.fotos, true);
  assert.equal(g.consentimento.avisos, true);
  assert.ok(!Number.isNaN(new Date(g.consentimento.em).getTime()));
  // A prova fica no SQLite (linha filha), não só na memória.
  const linha = sql('SELECT versao, fotos, avisos FROM consentimentos WHERE tenant_id=? AND guest_id=?', a.id, r.guestId);
  assert.equal(linha.versao, CONSENT.versao);
  assert.equal(linha.fotos, 1);
  assert.equal(linha.avisos, 1);
});

test('denúncia exige o token do convidado e limita por convidado/foto', async () => {
  const a = await criar('Denúncia'), b = await criar('Outro');
  const fotoId = await upload(a, a.guest);
  const url = `/api/events/${a.id}/fotos/${fotoId}/denunciar`;
  assert.equal((await post(url, { guestId: a.guest })).status, 403); // sem token
  assert.equal((await post(url, { guestId: a.guest, motivo: 'x' }, { 'x-guest-token': 'errado' })).status, 403);
  assert.equal((await post(url, { guestId: b.guest, motivo: 'x' }, { 'x-guest-token': b.guestToken })).status, 403); // convidado de outro evento
  assert.equal((await post(`/api/events/${a.id}/fotos/naoexiste/denunciar`, { guestId: a.guest }, { 'x-guest-token': a.guestToken })).status, 404);
  assert.equal((await post(url, { guestId: a.guest, motivo: 'foto íntima' }, { 'x-guest-token': a.guestToken })).status, 201);
  assert.equal((await post(url, { guestId: a.guest }, { 'x-guest-token': a.guestToken })).status, 200); // repetida
  const lista = await (await get(`/api/events/${a.id}/denuncias`, { 'x-host-token': a.tk })).json();
  assert.equal(lista.denuncias.length, 1);
  assert.equal(lista.denuncias[0].fotoId, fotoId);
  assert.equal((await get(`/api/events/${a.id}/denuncias`, { 'x-host-token': b.tk })).status, 403);
  const linha = sql('SELECT status, motivo FROM denuncias WHERE tenant_id=? AND foto_id=?', a.id, fotoId);
  assert.equal(linha.status, 'aberta');
  assert.equal(linha.motivo, 'foto íntima');
});

test('foto oculta some do convidado (lista, arquivo, ZIP e contagens); organização continua vendo', async () => {
  const a = await criar('Moderação');
  const fotoId = await upload(a, a.guest);
  assert.equal((await patch(`/api/events/${a.id}/photos/${fotoId}`, { oculta: true }, { 'x-host-token': a.tk })).status, 200);

  assert.equal((await (await get(`/api/events/${a.id}/photos`)).json()).fotos.length, 0);
  assert.equal((await (await get(`/api/events/${a.id}`)).json()).momentos, 0);
  const host = await (await get(`/api/events/${a.id}/host`, { 'x-host-token': a.tk })).json();
  assert.equal(host.fotosPorPessoa[0].fotos, 0);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`)).status, 403);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`, { 'x-host-token': a.tk })).status, 200);

  await patch(`/api/events/${a.id}`, { revealAt: new Date(Date.now() - 2000).toISOString() }, { 'x-host-token': a.tk });
  const lista = await (await get(`/api/events/${a.id}/photos`)).json();
  assert.equal(lista.revelado, true);
  assert.equal(lista.fotos.length, 0);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`)).status, 404);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`, { 'x-host-token': a.tk })).status, 200);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`, { 'x-master-token': 'master-de-teste' })).status, 200);
  const z = await get(`/api/events/${a.id}/fotos.zip`, { 'x-host-token': a.tk });
  assert.ok(!Buffer.from(await z.arrayBuffer()).includes(Buffer.from('Rafa')));
  const master = await (await get(`/api/events/${a.id}/host`, { 'x-host-token': 'master-de-teste' })).json();
  assert.equal(master.momentos, 0);

  await patch(`/api/events/${a.id}/photos/${fotoId}`, { oculta: false }, { 'x-host-token': a.tk });
  assert.equal((await (await get(`/api/events/${a.id}/photos`)).json()).fotos.length, 1);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`)).status, 200);
});

test('ocultar fecha a denúncia; apagar foto também fecha e a auditoria não guarda o nome do autor', async () => {
  const a = await criar('Denúncia 2');
  const f1 = await upload(a, a.guest);
  await post(`/api/events/${a.id}/fotos/${f1}/denunciar`, { guestId: a.guest }, { 'x-guest-token': a.guestToken });
  await patch(`/api/events/${a.id}/photos/${f1}`, { oculta: true }, { 'x-host-token': a.tk });
  assert.equal(evento(a.id).denuncias.find((d) => d.fotoId === f1).status, 'moderada');

  const f2 = await upload(a, a.guest);
  await post(`/api/events/${a.id}/fotos/${f2}/denunciar`, { guestId: a.guest }, { 'x-guest-token': a.guestToken });
  assert.equal((await del(`/api/events/${a.id}/photos/${f2}`, { 'x-host-token': a.tk })).status, 200);
  assert.equal(evento(a.id).denuncias.find((d) => d.fotoId === f2).status, 'foto-apagada');
  await new Promise((r) => setTimeout(r, 60)); // a auditoria do servidor grava em appendFile assíncrono
  const audit = fs.readFileSync(path.join(DIR, 'audit.log'), 'utf8');
  assert.ok(audit.includes('foto.apagada'));
  assert.ok(!audit.includes('Rafa'), 'a auditoria não pode guardar nome de convidado');
});

test('token só vale no header, nunca em ?token=', async () => {
  const a = await criar('Sem query');
  assert.equal((await get(`/api/events/${a.id}/host?token=${encodeURIComponent(a.tk)}`)).status, 403);
  assert.equal((await get(`/api/events/${a.id}/host`, { 'x-host-token': a.tk })).status, 200);
  const fotoId = await upload(a, a.guest);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file?token=${encodeURIComponent(a.tk)}`)).status, 403);
  assert.equal((await get(`/api/events/${a.id}/photos/${fotoId}/file`, { 'x-host-token': a.tk })).status, 200);
});

test('host expõe o prazo de retenção para avisar o casal', async () => {
  const a = await criar('Retenção');
  await patch(`/api/events/${a.id}`, { revealAt: new Date(Date.now() - 1000).toISOString() }, { 'x-host-token': a.tk });
  const host = await (await get(`/api/events/${a.id}/host`, { 'x-host-token': a.tk })).json();
  assert.ok(host.retencao);
  assert.ok(host.retencao.diasRestantes >= 170 && host.retencao.diasRestantes <= 365);
  assert.ok(!Number.isNaN(new Date(host.retencao.apagaEm).getTime()));
});

test('excluir pelo master remove do SQLite e deixa o túmulo para restore', async () => {
  const a = await criar('Excluir');
  const r = await fetch(`${B}/api/master/events/${a.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json', 'x-master-token': 'master-de-teste' }, body: JSON.stringify({ confirmar: a.id }) });
  assert.equal(r.status, 200);
  assert.equal(evento(a.id), undefined);
  assert.ok(!fs.existsSync(path.join(DIR, 'photos', a.id)));
  assert.ok(fs.readFileSync(path.join(DIR, 'excluidos.log'), 'utf8').includes(a.id));
});
