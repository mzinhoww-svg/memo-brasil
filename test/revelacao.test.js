// Revelação: job idempotente (trava, timeout, destino verificado) e retrospectiva.
// Provedor de e-mail falso e relógio controlado; a API e o store SQLite são reais.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-revelacao-'));
process.env.DATA_DIR = DATA_DIR;
process.env.MASTER_TOKEN = 'master-de-teste';
process.env.EMAIL_PROVIDER = 'console';

const app = require('../server.js');
const createStore = require('../src/store');
const { processarRevelacoes } = require('../src/reveal/job');
const { montarRetrospectiva } = require('../src/reveal/retrospectiva');
const { fotoVisivel } = require('../src/util/fotos');

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const json = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (p) => fetch(B + p);
// Lê o que ficou gravado no SQLite (outra conexão, como faria um processo novo).
function lerEvento(id) {
  const store = createStore(DATA_DIR);
  try { return JSON.parse(JSON.stringify(store.db.events[id])); } finally { store.close(); }
}

// ───── Job: unidade, com provedor falso e relógio controlado
const relogio = (iso) => () => new Date(iso);
const evento = (over = {}) => ({
  id: 'ev1', titulo: 'Casamento da Ana e do Bia', contato: 'noivos@exemplo.com', contatoVerificado: true,
  hostToken: 'segredo-do-casal',
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
  assert.equal(r.ocupado, false);
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

test('Atlas: e-mail só para endereço verificado (contatoVerificado ou lista de confiança)', async () => {
  const naoVerificado = { ev1: evento({ contatoVerificado: false }) };
  const email = fakeEmail();
  const r = await processarRevelacoes({ eventos: naoVerificado, agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: fakePush().pushEnviar, persistir: () => {} });
  assert.equal(email.enviados.length, 0, 'endereço não verificado não recebe nada');
  assert.equal(r.emailsNaoVerificados, 1);
  assert.match(naoVerificado.ev1.emailErro, /não verificado/i);
  assert.equal(naoVerificado.ev1.emailTentativas || 0, 0, 'não consome tentativa: libera quando confirmar');
  assert.equal(naoVerificado.ev1.revealNotified, true, 'o push continua');

  // Na lista de confiança do operador, o mesmo endereço passa.
  const liberado = { ev1: evento({ contatoVerificado: false }) };
  const email2 = fakeEmail();
  await processarRevelacoes({ eventos: liberado, agora: relogio('2026-06-01T02:00:00.000Z'), email: email2, pushEnviar: fakePush().pushEnviar, persistir: () => {}, verificados: ['noivos@exemplo.com'] });
  assert.equal(email2.enviados.length, 1);
});

test('trava: um ciclo por vez; chamada concorrente devolve ocupado', async () => {
  let liberar;
  const preso = new Promise((resolve) => { liberar = resolve; });
  const eventos = { ev1: evento() };
  const email = { nome: 'lento', enviar: async () => { await preso; return { id: 'x' }; } };
  const deps = { eventos, agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: fakePush().pushEnviar, persistir: () => {} };

  const primeira = processarRevelacoes(deps);
  const segunda = await processarRevelacoes(deps);
  assert.equal(segunda.ocupado, true, 'segundo ciclo não pode rodar em paralelo');
  assert.equal(segunda.emailsEnviados, 0);
  liberar();
  const r1 = await primeira;
  assert.equal(r1.ocupado, false);
  assert.equal(r1.emailsEnviados, 1);
});

test('timeout: provedor que não responde não trava o job', async () => {
  const eventos = { ev1: evento() };
  const email = { nome: 'travado', enviar: () => new Promise(() => {}) };
  const r = await processarRevelacoes({ eventos, agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: fakePush().pushEnviar, persistir: () => {}, timeoutMs: 20 });
  assert.equal(r.emailsFalhos, 1);
  assert.match(eventos.ev1.emailErro, /tempo esgotado/);
  assert.equal(eventos.ev1.emailEnviado, false);
  assert.equal(eventos.ev1.revealNotified, true, 'o push não depende do e-mail');
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

test('sem e-mail ou com contato inválido o job registra o motivo e segue', async () => {
  const semContato = { ev1: evento({ contato: '' }) };
  const invalido = { ev1: evento({ contato: '11 99999-0000' }) };
  for (const eventos of [semContato, invalido]) {
    const email = fakeEmail();
    await processarRevelacoes({ eventos, agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: fakePush().pushEnviar, persistir: () => {} });
    assert.equal(email.enviados.length, 0);
    assert.equal(eventos.ev1.revealNotified, true);
    assert.match(eventos.ev1.emailErro, /e-mail/i);
  }
});

test('e-mail de revelação é em pt-BR, escapa o título e fala no singular/plural certo', async () => {
  const casos = [
    { ev: evento({ titulo: '<script>alert(1)</script> Ana & Bia' }), esperado: /já tem 1 foto registrada/ },
    {
      ev: evento({
        photos: [
          { id: 'a', guestId: 'g1', autor: 'Rafa', criadaEm: '2026-06-01T03:10:00.000Z' },
          { id: 'b', guestId: 'g1', autor: 'Rafa', criadaEm: '2026-06-01T03:20:00.000Z' },
          { id: 'c', guestId: 'g2', autor: 'Bia', criadaEm: '2026-06-01T04:00:00.000Z' },
        ],
        recados: [{ id: 'r1' }],
      }),
      esperado: /já tem 3 fotos registradas e 1 recado no mural/,
    },
  ];
  for (const { ev, esperado } of casos) {
    const email = fakeEmail();
    await processarRevelacoes({ eventos: { ev1: ev }, agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: fakePush().pushEnviar, baseUrl: 'https://lume.app', persistir: () => {} });
    const msg = email.enviados[0];
    assert.match(msg.texto, esperado);
    assert.ok(msg.texto.includes('https://lume.app/e/ev1/album'));
  }
  const comTitulo = fakeEmail();
  await processarRevelacoes({ eventos: { ev1: evento({ titulo: '<script>alert(1)</script> Ana & Bia' }) }, agora: relogio('2026-06-01T02:00:00.000Z'), email: comTitulo, pushEnviar: fakePush().pushEnviar, persistir: () => {} });
  assert.ok(!comTitulo.enviados[0].html.includes('<script>'));
  assert.ok(comTitulo.enviados[0].html.includes('&lt;script&gt;'));
  assert.ok(comTitulo.enviados[0].html.includes('&amp;'));
});

// ───── Fotos ocultas
test('fotoVisivel: só o que a moderação ocultou fica de fora', () => {
  assert.equal(fotoVisivel({ id: 'a' }), true);
  assert.equal(fotoVisivel({ id: 'a', oculta: false }), true);
  assert.equal(fotoVisivel({ id: 'a', oculta: true }), false);
  assert.equal(fotoVisivel({ id: 'a', ocultaEm: '2026-06-01T00:00:00.000Z' }), false);
  assert.equal(fotoVisivel(null), false);
});

test('Atlas: foto oculta sai da retrospectiva e da contagem do e-mail', async () => {
  const photos = [
    { id: 'p1', guestId: 'g1', autor: 'Rafa', criadaEm: '2026-06-01T03:10:00.000Z' },
    { id: 'p2', guestId: 'g2', autor: 'Bia', criadaEm: '2026-06-01T03:40:00.000Z', oculta: true },
    { id: 'p3', guestId: 'g3', autor: 'Caio', criadaEm: '2026-06-01T04:10:00.000Z', ocultaEm: '2026-06-02T10:00:00.000Z' },
  ];
  const r = montarRetrospectiva({ id: 'ev1', titulo: 'X', revealAt: '2026-06-01T02:00:00.000Z', config: { mostrarAutor: true }, guests: [1, 2, 3], recados: [], photos });
  assert.equal(r.totais.fotos, 1);
  assert.equal(r.totais.fotografos, 1);
  assert.deepEqual(r.topFotografos.map((t) => t.nome), ['Rafa']);
  assert.equal(r.linhaDoTempo.reduce((t, h) => t + h.fotos, 0), 1);

  const email = fakeEmail();
  await processarRevelacoes({ eventos: { ev1: evento({ photos }) }, agora: relogio('2026-06-01T02:00:00.000Z'), email, pushEnviar: fakePush().pushEnviar, persistir: () => {} });
  assert.match(email.enviados[0].texto, /já tem 1 foto registrada/);
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
const verificarContato = (id, valor) => fetch(`${B}/api/master/events/${id}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', 'x-master-token': 'master-de-teste' },
  body: JSON.stringify({ contatoVerificado: valor }),
});

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

test('Atlas ponta a ponta: revelação só manda e-mail para contato verificado, e o estado fica no banco', async () => {
  const ev = await criarEvento('Casamento Verificado', new Date(Date.now() + 3600e3).toISOString(), 'noivos@exemplo.com');
  const gid = await entrar(ev.id, 'Rafa');
  assert.equal((await subirFoto(ev.id, gid)).status, 201);
  assert.equal((await revelarAgora(ev)).status, 200);

  await app.processarRevelacoes();
  let salvo = lerEvento(ev.id);
  assert.equal(salvo.revealNotified, true);
  assert.equal(salvo.emailEnviado, false, 'sem verificação não sai e-mail');
  assert.match(salvo.emailErro, /não verificado/i);

  // O operador confirma o endereço; o próximo ciclo envia uma única vez.
  assert.equal((await verificarContato(ev.id, true)).status, 200);
  await app.processarRevelacoes();
  salvo = lerEvento(ev.id);
  assert.equal(salvo.contatoVerificado, true);
  assert.equal(salvo.emailEnviado, true);
  assert.ok(salvo.emailEnviadoEm);
  assert.equal(salvo.emailErro, null);
  assert.equal(salvo.avisos.length, 1, 'um aviso de revelação no painel');

  // Repetir o ciclo (ou reiniciar) não duplica.
  const antes = salvo.emailEnviadoEm;
  const r2 = await app.processarRevelacoes();
  assert.equal(r2.emailsEnviados, 0);
  assert.equal(lerEvento(ev.id).emailEnviadoEm, antes);
  assert.equal(lerEvento(ev.id).avisos.length, 1);
});

test('trocar o contato do evento derruba a verificação', async () => {
  const ev = await criarEvento('Casamento Troca', new Date(Date.now() + 3600e3).toISOString(), 'antes@exemplo.com');
  assert.equal((await verificarContato(ev.id, true)).status, 200);
  assert.equal(lerEvento(ev.id).contatoVerificado, true);
  const r = await fetch(`${B}/api/events/${ev.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-host-token': ev.hostToken },
    body: JSON.stringify({ contato: 'depois@exemplo.com' }),
  });
  assert.equal(r.status, 200);
  assert.equal(lerEvento(ev.id).contatoVerificado, false, 'endereço novo precisa ser confirmado de novo');
});

test('política registra o operador no exterior e a regra do e-mail verificado', async () => {
  assert.equal((await fetch(`${B}/api/master/politicas`)).status, 403, 'políticas são do master');
  const doMaster = await (await fetch(`${B}/api/master/politicas`, { headers: { 'x-master-token': 'master-de-teste' } })).json();
  const texto = JSON.stringify(doMaster);
  assert.ok(!texto.includes('undefined'), 'políticas devem vir completas');
  assert.match(doMaster.operadorExterior, /exterior/i);
  assert.match(doMaster.operadorExterior, /LGPD/);
  assert.match(doMaster.emailRevelacao, /verificado/i);
});
