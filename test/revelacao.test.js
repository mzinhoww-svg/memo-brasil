// Revelação: job idempotente (e-mail ao organizador + push) e retrospectiva.
// Provedor de e-mail falso e relógio controlado; a API é exercitada de verdade.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-revelacao-'));
process.env.DATA_DIR = DATA_DIR;
process.env.MASTER_TOKEN = 'master-de-teste';
process.env.EMAIL_PROVEDOR = 'console';

const app = require('../server.js');
const { processarRevelacoes } = require('../src/reveal/job');
const { montarRetrospectiva } = require('../src/reveal/retrospectiva');

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const json = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (p) => fetch(B + p);

// ───── Job: unidade, com provedor falso e relógio controlado
const relogio = (iso) => () => new Date(iso);
const evento = (over = {}) => ({
  id: 'ev1', titulo: 'Casamento da Ana e do Bia', contato: 'noivos@exemplo.com', hostToken: 'segredo-do-casal',
  revealAt: '2026-06-01T02:00:00.000Z', revealNotified: false, emailEnviado: false,
  avisos: [], guests: [{ id: 'g1', nome: 'Rafa' }],
  photos: [{ id: 'p1', guestId: 'g1', autor: 'Rafa', criadaEm: '2026-06-01T03:10:00.000Z' }],
  config: { mostrarAutor: true },
  ...over,
});
const fakeEmail = () => {
  const enviados = [];
  return { nome: 'falso', enviados, enviar: async (msg) => { enviados.push(msg); return { ok: true, id: `f${enviados.length}` }; } };
};
const fakePush = () => {
  const chamadas = [];
  return { chamadas, pushEnviar: async (ev, payload) => { chamadas.push({ ev: ev.id, payload }); return { alvos: 3, entregues: 3, falhas: 0 }; } };
};

test('antes da hora da revelação o job não faz nada', async () => {
  const eventos = { ev1: evento() };
  const email = fakeEmail(), push = fakePush(), persistidos = [];
  const r = await processarRevelacoes({ eventos, agora: relogio('2026-06-01T01:59:59.000Z'), email, pushEnviar: push.pushEnviar, persistir: (ev) => persistidos.push(ev.id) });
  assert.equal(email.enviados.length, 0);
  assert.equal(push.chamadas.length, 0);
  assert.equal(eventos.ev1.revealNotified, false);
  assert.equal(persistidos.length, 0);
  assert.equal(r.emailsEnviados, 0);
});

test('na revelação envia o e-mail ao organizador e dispara o push uma única vez, inclusive após restart', async () => {
  const eventos = { ev1: evento() };
  const email = fakeEmail(), push = fakePush();
  let salvo = null;
  const deps = { agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: push.pushEnviar, baseUrl: 'https://lume.app', persistir: () => { salvo = JSON.parse(JSON.stringify(eventos)); } };

  const r1 = await processarRevelacoes({ eventos, ...deps });
  assert.equal(r1.emailsEnviados, 1);
  assert.equal(email.enviados.length, 1);
  assert.equal(email.enviados[0].para, 'noivos@exemplo.com');
  assert.match(email.enviados[0].assunto, /revelado/i);
  assert.equal(push.chamadas.length, 1);
  assert.equal(push.chamadas[0].ev, 'ev1');
  assert.equal(push.chamadas[0].payload.url, '/e/ev1/album');
  assert.equal(eventos.ev1.revealNotified, true);
  assert.equal(eventos.ev1.emailEnviado, true);
  assert.ok(eventos.ev1.emailEnviadoEm);
  assert.equal(eventos.ev1.avisos.length, 1);

  // O e-mail nunca leva token de acesso.
  assert.ok(!email.enviados[0].texto.includes('segredo-do-casal'));
  assert.ok(!email.enviados[0].html.includes('segredo-do-casal'));

  // Mesma execução de novo: nada duplica.
  await processarRevelacoes({ eventos, ...deps });
  assert.equal(email.enviados.length, 1);
  assert.equal(push.chamadas.length, 1);

  // Restart: o novo processo carrega o que foi salvo e não repete.
  const email2 = fakeEmail(), push2 = fakePush();
  await processarRevelacoes({ eventos: salvo, agora: relogio('2026-06-02T00:00:00.000Z'), email: email2, pushEnviar: push2.pushEnviar, persistir: () => {} });
  assert.equal(email2.enviados.length, 0);
  assert.equal(push2.chamadas.length, 0);
});

test('falha no e-mail não derruba o push e é retentada com teto de 5', async () => {
  const eventos = { ev1: evento() };
  let tentativas = 0;
  const email = { nome: 'quebrado', enviar: async () => { tentativas++; throw new Error('SMTP fora do ar'); } };
  const push = fakePush();
  const deps = { agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: push.pushEnviar, persistir: () => {} };
  for (let i = 0; i < 8; i++) await processarRevelacoes({ eventos, ...deps });
  assert.equal(tentativas, 5);
  assert.equal(eventos.ev1.emailEnviado, false);
  assert.equal(eventos.ev1.emailTentativas, 5);
  assert.match(eventos.ev1.emailErro, /SMTP/);
  assert.equal(push.chamadas.length, 1);
  assert.equal(eventos.ev1.revealNotified, true);
});

test('sem e-mail do organizador o job registra o motivo e segue', async () => {
  const eventos = { ev1: evento({ contato: '' }) };
  const email = fakeEmail();
  await processarRevelacoes({ eventos, agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: fakePush().pushEnviar, persistir: () => {} });
  assert.equal(email.enviados.length, 0);
  assert.equal(eventos.ev1.revealNotified, true);
  assert.match(eventos.ev1.emailErro, /e-?mail/i);
});

test('e-mail de revelação é em pt-BR e escapa o título do evento', async () => {
  const eventos = { ev1: evento({ titulo: '<script>alert(1)</script> Ana & Bia' }) };
  const email = fakeEmail();
  await processarRevelacoes({ eventos, agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: fakePush().pushEnviar, baseUrl: 'https://lume.app', persistir: () => {} });
  const msg = email.enviados[0];
  assert.ok(!msg.html.includes('<script>'), 'html não pode trazer o script do título');
  assert.ok(msg.html.includes('&lt;script&gt;'));
  assert.ok(msg.html.includes('&amp;'));
  assert.ok(msg.texto.includes('https://lume.app/e/ev1/album'));
  assert.match(msg.assunto, /álbum/i);
});

test('contato que não é e-mail não chega ao provedor', async () => {
  const eventos = { ev1: evento({ contato: '11 99999-0000' }) };
  const email = fakeEmail();
  await processarRevelacoes({ eventos, agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: fakePush().pushEnviar, persistir: () => {} });
  assert.equal(email.enviados.length, 0);
  assert.match(eventos.ev1.emailErro, /e-mail/i);
});

test('o texto do e-mail fala no singular com uma foto e no plural com várias', async () => {
  const uma = fakeEmail();
  await processarRevelacoes({ eventos: { ev1: evento() }, agora: relogio('2026-06-01T02:00:00.000Z'), email: uma, pushEnviar: fakePush().pushEnviar, persistir: () => {} });
  assert.match(uma.enviados[0].texto, /já tem 1 foto registrada/);

  const tres = fakeEmail();
  const ev = evento({ photos: [{ id: 'a', guestId: 'g1', autor: 'Rafa', criadaEm: '2026-06-01T03:10:00.000Z' }, { id: 'b', guestId: 'g1', autor: 'Rafa', criadaEm: '2026-06-01T03:20:00.000Z' }, { id: 'c', guestId: 'g2', autor: 'Bia', criadaEm: '2026-06-01T04:00:00.000Z' }], recados: [{ id: 'r1' }] });
  await processarRevelacoes({ eventos: { ev1: ev }, agora: relogio('2026-06-01T02:00:00.000Z'), email: tres, pushEnviar: fakePush().pushEnviar, persistir: () => {} });
  assert.match(tres.enviados[0].texto, /já tem 3 fotos registradas e 1 recado no mural/);
});

// ───── Retrospectiva: unidade
const evRetro = (over = {}) => ({
  id: 'ev1', titulo: 'Casamento da Ana e do Bia', revealAt: '2026-06-01T02:00:00.000Z',
  dataEvento: '2026-06-01T00:00:00.000Z', local: 'Salão', config: { mostrarAutor: true },
  contato: 'noivos@exemplo.com', guests: [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }],
  recados: [{ id: 'r1' }, { id: 'r2' }],
  photos: [
    { id: 'p1', guestId: 'g1', autor: 'Rafa', criadaEm: '2026-06-01T03:10:00.000Z' },
    { id: 'p2', guestId: 'g1', autor: 'Rafa', criadaEm: '2026-06-01T03:40:00.000Z' },
    { id: 'p3', guestId: 'g2', autor: 'Bia', criadaEm: '2026-06-01T04:05:00.000Z' },
  ],
  ...over,
});

test('retrospectiva: totais, top fotógrafos e linha do tempo por hora', () => {
  const r = montarRetrospectiva(evRetro());
  assert.deepEqual(r.totais, { fotos: 3, fotografos: 2, convidados: 3, recados: 2 });
  assert.deepEqual(r.topFotografos.map((t) => [t.nome, t.fotos]), [['Rafa', 2], ['Bia', 1]]);
  assert.deepEqual(r.linhaDoTempo, [
    { hora: '2026-06-01T03:00:00.000Z', fotos: 2 },
    { hora: '2026-06-01T04:00:00.000Z', fotos: 1 },
  ]);
  assert.equal(r.evento.id, 'ev1');
  assert.equal(r.revelado, true);
});

test('retrospectiva sem mostrar autor não revela nomes', () => {
  const r = montarRetrospectiva(evRetro({ config: { mostrarAutor: false } }));
  assert.equal(r.mostrarAutor, false);
  assert.equal(r.topFotografos.length, 2);
  assert.ok(r.topFotografos.every((t) => !t.nome));
});

// ───── API: só depois da revelação, só do próprio casamento
async function criarEvento(titulo, revealAt, contato) {
  return (await json('/api/events', { titulo, revealAt, contato, fotosPorConvidado: 5 })).json();
}
async function entrar(id, nome) {
  return (await (await json(`/api/events/${id}/guests`, { nome })).json()).guestId;
}
async function subirFoto(id, guestId) {
  const fd = new FormData(); fd.append('guestId', guestId); fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  return fetch(`${B}/api/events/${id}/photos`, { method: 'POST', body: fd });
}
// A organização adianta a revelação: é assim que o relógio do servidor passa a hora marcada.
async function revelarAgora(ev) {
  return fetch(`${B}/api/events/${ev.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-host-token': ev.hostToken },
    body: JSON.stringify({ revealAt: new Date(Date.now() - 60e3).toISOString() }),
  });
}

test('retrospectiva só abre depois da revelação e não vaza outro casamento', async () => {
  const futuro = new Date(Date.now() + 3600e3).toISOString();
  const a = await criarEvento('Casamento A', futuro, 'a@exemplo.com');
  const b = await criarEvento('Casamento B', futuro, 'b@exemplo.com');
  assert.equal((await get(`/api/events/${a.id}/retrospectiva`)).status, 403, 'antes de revelar não abre');
  assert.equal((await get('/api/events/nao-existe/retrospectiva')).status, 404);

  const gb = await entrar(b.id, 'Bia');
  assert.equal((await subirFoto(b.id, gb)).status, 201);
  assert.equal((await get(`/api/events/${b.id}/retrospectiva`)).status, 403, 'foto enviada não adianta a revelação');

  assert.equal((await revelarAgora(b)).status, 200);
  const rb = await (await get(`/api/events/${b.id}/retrospectiva`)).json();
  assert.equal(rb.totais.fotos, 1);
  assert.deepEqual(rb.topFotografos.map((t) => t.nome), ['Bia']);
  assert.equal(rb.linhaDoTempo.reduce((t, h) => t + h.fotos, 0), 1);

  assert.equal((await get(`/api/events/${a.id}/retrospectiva`)).status, 403);
  const corpoA = await (await get(`/api/events/${a.id}/retrospectiva`)).text();
  assert.ok(!corpoA.includes('Bia'), 'evento A não pode devolver dados de B');
  assert.ok(!corpoA.includes('Casamento B'));
});

test('o job do servidor grava revealNotified/emailEnviado e não repete no restart', async () => {
  const ev = await criarEvento('Casamento Revelado', new Date(Date.now() + 3600e3).toISOString(), 'noivos@exemplo.com');
  const gid = await entrar(ev.id, 'Rafa');
  assert.equal((await subirFoto(ev.id, gid)).status, 201);
  assert.equal((await revelarAgora(ev)).status, 200);

  const ler = () => JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'db.json'), 'utf8')).events[ev.id];
  assert.equal(ler().revealNotified, false, 'ainda não avisado antes do job rodar');

  await app.processarRevelacoes();
  const salvo1 = ler();
  assert.equal(salvo1.revealNotified, true);
  assert.equal(salvo1.emailEnviado, true);
  assert.ok(salvo1.emailEnviadoEm);
  assert.ok(salvo1.avisos.some((a) => /revelad/i.test(a.titulo)), 'aviso da revelação no painel');

  // Segundo ciclo (ou um novo processo lendo o db): não reenvia.
  const r2 = await app.processarRevelacoes();
  assert.equal(r2.emailsEnviados, 0);
  assert.equal(ler().emailEnviadoEm, salvo1.emailEnviadoEm);
});
