// Decisão 004 + C4: recados privados ao casal por padrão; mural só com opt-in.
// GET /recados exige credencial (token do convidado ou da organização).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-recados-'));
process.env.MASTER_TOKEN = 'master-de-teste';
const app = require('../server.js');

let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const patch = (p, body, h = {}) => fetch(B + p, { method: 'PATCH', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const futuro = () => new Date(Date.now() + 3600e3).toISOString();
const CONSENT = { versao: 'consentimento-convidado v0.1', fotos: true, avisos: false };
const H = (g) => ({ 'x-guest-token': g.guestToken });
const ler = async (ev, g, tk) => (await (await get(`/api/events/${ev.id}/recados?guestId=${encodeURIComponent(g.guestId)}`, tk ? { 'x-guest-token': tk } : H(g))).json()).recados;
const escrever = (ev, g, texto, extra = {}) => post(`/api/events/${ev.id}/recados`, { guestId: g.guestId, texto, ...extra }, H(g));
const config = (ev, cfg) => patch(`/api/events/${ev.id}`, { config: cfg }, { 'x-host-token': ev.tk });

async function festa(titulo = 'Festa') {
  const r = await (await post('/api/events', { titulo, revealAt: futuro(), fotosPorConvidado: 2 })).json();
  const a = await (await post(`/api/events/${r.id}/guests`, { nome: 'Ana', consentimento: CONSENT })).json();
  const b = await (await post(`/api/events/${r.id}/guests`, { nome: 'Bia', consentimento: CONSENT })).json();
  return { id: r.id, tk: r.hostToken, a, b };
}

test('sem credencial o mural não é lido (403)', async () => {
  const ev = await festa('Sem credencial');
  assert.equal((await get(`/api/events/${ev.id}/recados`)).status, 403);
  // guestId sozinho também não basta.
  assert.equal((await get(`/api/events/${ev.id}/recados?guestId=${ev.a.guestId}`)).status, 403);
});

test('credencial de organização não vale pela URL: só no cabeçalho', async () => {
  const ev = await festa('URL');
  await escrever(ev, ev.a, 'recado');
  // token do casal na query não lê (decisão 002 §8: credencial nunca na URL).
  assert.equal((await get(`/api/events/${ev.id}/recados?token=${ev.tk}`)).status, 403);
  assert.equal((await get(`/api/events/${ev.id}/recados?token=master-de-teste`)).status, 403);
  // Pelo cabeçalho, funciona.
  assert.equal((await get(`/api/events/${ev.id}/recados`, { 'x-host-token': ev.tk })).status, 200);
});

test('convidado vê só os próprios recados; recado privado do outro não aparece', async () => {
  const ev = await festa('Privado');
  assert.equal((await escrever(ev, ev.a, 'segredo da Ana')).status, 201);
  const daAna = await ler(ev, ev.a);
  assert.equal(daAna.length, 1);
  assert.equal(daAna[0].texto, 'segredo da Ana');
  assert.equal(daAna[0].meu, true);
  assert.equal(daAna[0].visibilidade, 'casal');
  // Bia não vê o recado privado da Ana.
  assert.equal((await ler(ev, ev.b)).length, 0);
});

test('a organização vê todos os recados, com autor', async () => {
  const ev = await festa('Organização');
  await escrever(ev, ev.a, 'para os noivos');
  const r = await (await get(`/api/events/${ev.id}/recados`, { 'x-host-token': ev.tk })).json();
  assert.equal(r.organizacao, true);
  assert.equal(r.recados.length, 1);
  assert.equal(r.recados[0].texto, 'para os noivos');
  assert.equal(r.recados[0].autor, 'Ana');
});

test('recado é privado por padrão mesmo com mural desligado', async () => {
  const ev = await festa('Padrão');
  const r = await (await escrever(ev, ev.a, 'só para vocês', { mural: true })).json();
  assert.equal(r.visibilidade, 'casal', 'mural desligado ignora a caixa marcada');
  assert.equal((await ler(ev, ev.b)).length, 0);
});

test('recado mural só aparece no mural ligado e marcado', async () => {
  const ev = await festa('Mural');
  await config(ev, { recadosMural: true });
  await escrever(ev, ev.a, 'recado privado');
  const m = await (await escrever(ev, ev.a, 'recado do mural', { mural: true })).json();
  assert.equal(m.visibilidade, 'mural');
  const daBia = await ler(ev, ev.b);
  assert.equal(daBia.length, 1, 'a Bia vê só o recado do mural');
  assert.equal(daBia[0].texto, 'recado do mural');
  assert.equal(daBia[0].meu, false);
  assert.equal(daBia[0].autor, 'Ana', 'no mural, o nome aparece (mostrarAutor ligado)');
  // Desligar o mural esconde o recado de novo.
  await config(ev, { recadosMural: false });
  assert.equal((await ler(ev, ev.b)).length, 0);
});

test('apelido muralRecados (decisão 004) liga o mesmo campo', async () => {
  const ev = await festa('Apelido');
  await config(ev, { muralRecados: true });
  const info = await (await get(`/api/events/${ev.id}`)).json();
  assert.equal(info.config.recadosMural, true);
  assert.equal(info.config.muralRecados, true);
});

test('recados não vazam entre eventos', async () => {
  const a = await festa('A'), b = await festa('B');
  await escrever(a, a.a, 'segredo do A');
  // Token do evento B não lê o recado do evento A.
  assert.equal((await get(`/api/events/${a.id}/recados?guestId=${a.a.guestId}`, H(b.a))).status, 403);
});

test('POST /recados sem token é 403', async () => {
  const ev = await festa('Sem token');
  assert.equal((await post(`/api/events/${ev.id}/recados`, { guestId: ev.a.guestId, texto: 'oi' })).status, 403);
});

test('texto com HTML volta como texto e a tela usa textContent (sem innerHTML)', async () => {
  const ev = await festa('XSS');
  const payload = '<img src=x onerror=alert(1)>';
  await escrever(ev, ev.a, payload);
  const r = await ler(ev, ev.a);
  assert.equal(r[0].texto, payload, 'servidor guarda e devolve o texto cru; quem escapa é a tela');
  const html = await (await get(`/e/${ev.id}/recados`)).text();
  assert.match(html, /textContent/);
  assert.equal(html.includes('innerHTML'), false, 'a tela de recados não usa innerHTML');
});

test('a tela de recados traz o aviso de consentimento', async () => {
  const ev = await festa('Consentimento');
  const html = await (await get(`/e/${ev.id}/recados`)).text();
  assert.match(html, /Seu recado é só para os noivos\./);
  assert.match(html, /Este recado vai aparecer para todos os convidados, com o seu nome\./);
});
