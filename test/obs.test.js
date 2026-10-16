// Testes da frente de Observabilidade e limites (item 11).
// Cobre: /healthz sem PII, log JSON por requisição sem PII, teto de fotos por
// evento e o cliente Sentry opcional (sem dependência nova). Rodar: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-obs-'));
process.env.MASTER_TOKEN = 'master-de-teste';
process.env.MAX_FOTOS_EVENTO = '3'; // teto pequeno para o teste do 413

const { createLogger, hashIp } = require('../src/obs/logger.js');
const { createHealthHandler, checarGravacao } = require('../src/obs/health.js');
const { tetoFotosEvento, limFotosEvento, estimativaDiscoBytes, TETO_PADRAO_FOTOS_EVENTO } = require('../src/obs/limites.js');
const { createSentry, parseDsn, buildEnvelope } = require('../src/obs/sentry.js');
const app = require('../server.js');

const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
let server, B;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); B = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const futuro = () => new Date(Date.now() + 3600e3).toISOString();
async function criar(titulo) {
  const r = await (await post('/api/events', { titulo, revealAt: futuro(), fotosPorConvidado: 50 })).json();
  const g = await (await post(`/api/events/${r.id}/guests`, { nome: 'Rafa' })).json();
  return { id: r.id, tk: r.hostToken, guest: g.guestId };
}
async function foto(ev) {
  const fd = new FormData(); fd.append('guestId', ev.guest); fd.append('foto', new Blob([JPG], { type: 'image/jpeg' }), 'f.jpg');
  return fetch(`${B}/api/events/${ev.id}/photos`, { method: 'POST', body: fd });
}

// ───── (1) GET /healthz sem dados pessoais

test('GET /healthz responde status, versão e gravação no DATA_DIR, sem PII', async () => {
  const r = await get('/healthz');
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.status, 'ok');
  assert.equal(typeof b.versao, 'string');
  assert.ok(b.versao.length > 0);
  assert.equal(b.gravacao.ok, true);
  assert.deepEqual(Object.keys(b).sort(), ['agora', 'gravacao', 'status', 'uptimeS', 'versao'].sort());
  const texto = JSON.stringify(b);
  assert.ok(!/token|senha|password|secret/i.test(texto), 'healthz não pode vazar segredo');
  assert.ok(!texto.includes('master-de-teste'));
  assert.ok(!texto.includes(process.env.DATA_DIR), 'healthz não deve expor o caminho do disco');
});

test('checarGravacao falha (ok=false) num caminho que não é diretório gravável', () => {
  const arquivo = path.join(os.tmpdir(), `memo-arquivo-${Date.now()}`);
  fs.writeFileSync(arquivo, 'x');
  try { assert.equal(checarGravacao(arquivo).ok, false); }
  finally { fs.unlinkSync(arquivo); }
});

test('healthz responde 503 quando a gravação falha', () => {
  let status, corpo;
  const handler = createHealthHandler({ dataDir: '/inexistente', versao: '9.9.9', checar: () => ({ ok: false, motivo: 'sem permissão' }), agora: () => '2026-01-01T00:00:00.000Z' });
  const res = { status(c) { status = c; return this; }, json(b) { corpo = b; return this; } };
  handler({}, res);
  assert.equal(status, 503);
  assert.equal(corpo.status, 'degradado');
  assert.equal(corpo.gravacao.ok, false);
});

// ───── (2) log estruturado JSON por requisição, sem PII

test('logger: uma linha JSON por requisição, com IP só como hash curto, sem PII', () => {
  const registros = [];
  let t = 1000;
  const logger = createLogger({ sink: (l) => registros.push(l), salt: 'sal-fixo', now: () => (t += 5) });
  const req = {
    method: 'POST',
    path: '/api/events/abc123/recados',
    url: '/api/events/abc123/recados?token=SUPERSECRETO',
    ip: '203.0.113.9',
    headers: { 'x-host-token': 'SUPERSECRETO' },
    body: { email: 'noiva@exemplo.com', nome: 'Fulana', texto: 'recado íntimo', token: 'SUPERSECRETO' },
  };
  const res = { statusCode: 201, on: (evento, cb) => { if (evento === 'finish') cb(); } };
  logger.middleware(req, res, () => {});

  assert.equal(registros.length, 1);
  const linha = registros[0];
  assert.equal(linha.msg, 'http');
  assert.equal(linha.nivel, 'info');
  assert.equal(linha.metodo, 'POST');
  assert.equal(linha.rota, '/api/events/abc123/recados', 'a query string (com token) não entra no log');
  assert.equal(linha.status, 201);
  assert.equal(typeof linha.ms, 'number');
  assert.equal(linha.ipH, logger.hashIp('203.0.113.9'));
  assert.equal(linha.ipH.length, 12);

  const texto = JSON.stringify(linha);
  for (const proibido of ['noiva@exemplo.com', 'Fulana', 'SUPERSECRETO', 'recado íntimo', '203.0.113.9']) {
    assert.ok(!texto.includes(proibido), `log vazou dado sensível: ${proibido}`);
  }
});

test('logger: hashIp é estável por sal e curto, e nunca devolve o IP puro', () => {
  const a = hashIp('200.1.2.3', 'sal');
  assert.equal(a, hashIp('200.1.2.3', 'sal'));
  assert.notEqual(a, hashIp('200.1.2.3', 'outro-sal'));
  assert.equal(a.length, 12);
  assert.ok(!a.includes('200.1.2.3'));
  assert.equal(hashIp('', 'sal'), null);
});

test('logs reais de requisição não contêm token, e-mail, nome, texto nem IP puro', async () => {
  const ev = await criar('Log');
  const original = process.stdout.write;
  const capturado = [];
  process.stdout.write = (chunk) => { capturado.push(String(chunk)); return true; };
  try {
    await post(`/api/events/${ev.id}/recados`, { guestId: ev.guest, texto: 'segredo-do-recado' }, { 'x-host-token': 'TOKEN-SECRETO' });
    await get(`/healthz?token=TOKEN-SECRETO`);
    await new Promise((r) => setTimeout(r, 60));
  } finally { process.stdout.write = original; }

  const saida = capturado.join('');
  assert.ok(saida.includes('"msg":"http"'), 'o middleware de log deve estar instalado no servidor');
  assert.ok(saida.includes(`/api/events/${ev.id}/recados`), 'o caminho (sem query) deve aparecer');
  for (const proibido of ['segredo-do-recado', 'TOKEN-SECRETO', '127.0.0.1', '::ffff']) {
    assert.ok(!saida.includes(proibido), `saída de log vazou: ${proibido}`);
  }
  // Toda linha de log http deve ser JSON válido com um ipH, nunca o IP cru.
  const linhas = saida.split('\n').filter((l) => l.includes('"msg":"http"'));
  assert.ok(linhas.length >= 1);
  for (const l of linhas) { const o = JSON.parse(l); assert.equal(typeof o.ipH, 'string'); assert.equal(o.ipH.length, 12); }
});

// ───── (3) teto de fotos por evento (MAX_FOTOS_EVENTO)

test('limites: teto padrão 3000, configurável por env, sempre o menor valor vence', () => {
  assert.equal(TETO_PADRAO_FOTOS_EVENTO, 3000);
  assert.equal(tetoFotosEvento({}), 3000);
  assert.equal(tetoFotosEvento({ MAX_FOTOS_EVENTO: '500' }), 500);
  assert.equal(tetoFotosEvento({ MAX_FOTOS_EVENTO: '-1' }), 3000);
  assert.equal(tetoFotosEvento({ MAX_FOTOS_EVENTO: 'abc' }), 3000);
  // limite por evento só aperta, nunca passa do teto
  assert.equal(limFotosEvento({ limites: { maxFotos: 5000 } }, { maxFotosPorEvento: 20000 }, { MAX_FOTOS_EVENTO: '3000' }), 3000);
  assert.equal(limFotosEvento({ limites: { maxFotos: 120 } }, { maxFotosPorEvento: 20000 }, { MAX_FOTOS_EVENTO: '3000' }), 120);
});

test('estimativa de disco por evento é calculável (pior caso)', () => {
  assert.equal(estimativaDiscoBytes(3000, 10), 3000 * 10 * 1024 * 1024);
  assert.equal(estimativaDiscoBytes(0, 10), 0);
});

test('upload acima do teto de fotos do evento responde 413 com mensagem em pt-BR', async () => {
  const ev = await criar('Teto');
  for (let i = 0; i < 3; i++) assert.equal((await foto(ev)).status, 201, `a foto ${i + 1} deveria entrar`);
  const excedente = await foto(ev);
  assert.equal(excedente.status, 413);
  const corpo = await excedente.json();
  assert.ok(typeof corpo.erro === 'string');
  assert.ok(/teto|limite/i.test(corpo.erro), `mensagem em pt-BR sobre o limite: ${corpo.erro}`);
  // O evento realmente parou em 3 fotos.
  const lista = await (await get(`/api/events/${ev.id}/photos`)).json();
  assert.equal(lista.fotos.length, 3);
});

test('bloqueio de foto antes da revelação continua no servidor (rota tocada pela frente)', async () => {
  const ev = await criar('Bloqueio');
  const up = await (await foto(ev)).json();
  assert.ok(up.id);
  assert.equal((await get(`/api/events/${ev.id}/photos/${up.id}/file`)).status, 403);
  assert.equal((await get(`/api/events/${ev.id}/photos/${up.id}/file`, { 'x-host-token': ev.tk })).status, 200);
  const lista = await (await get(`/api/events/${ev.id}/photos`)).json();
  assert.equal(lista.revelado, false);
  assert.equal(lista.fotos[0].bloqueada, true);
  assert.equal(lista.fotos[0].url, undefined);
});

// ───── (4) Sentry opcional (sem dependência nova)

test('sentry: sem SENTRY_DSN é no-op e nunca chama fetch', async () => {
  let chamou = false;
  const s = createSentry({ dsn: '', fetchImpl: async () => { chamou = true; } });
  assert.equal(s.enabled, false);
  const r = await s.captureException(new Error('boom'));
  assert.equal(r.enviado, false);
  assert.equal(chamou, false);
});

test('sentry: DSN inválido vira no-op', () => {
  assert.equal(parseDsn('não-é-url'), null);
  assert.equal(parseDsn(''), null);
  assert.equal(parseDsn('https://sem-projeto@host.com'), null);
  assert.equal(createSentry({ dsn: 'https://sem-projeto@host.com', fetchImpl: async () => {} }).enabled, false);
});

test('sentry: envia envelope ao endpoint do DSN, sem corpo de requisição', async () => {
  const chamadas = [];
  const s = createSentry({
    dsn: 'https://abc123@o0.ingest.sentry.io/456', version: '1.2.3',
    fetchImpl: async (url, opts) => { chamadas.push({ url, opts }); return { ok: true }; },
  });
  assert.equal(s.enabled, true);
  const r = await s.captureException(new Error('falhou no upload de foto'));
  assert.equal(r.enviado, true);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].url, 'https://o0.ingest.sentry.io/api/456/envelope/');
  assert.equal(chamadas[0].opts.method, 'POST');
  assert.ok(chamadas[0].opts.headers['x-sentry-auth'].includes('sentry_key=abc123'));

  const corpo = chamadas[0].opts.body;
  assert.ok(corpo.includes('falhou no upload de foto'), 'a mensagem do erro deve ir no envelope');
  assert.ok(corpo.includes('"type":"event"'));
  assert.ok(corpo.includes('memo-brasil'), 'release/logger da aplicação');
  // Nunca enviamos corpo de requisição nem dados pessoais.
  assert.ok(!corpo.includes('senha-secreta'));
});

test('sentry: buildEnvelope tem cabeçalho com dsn e event_id e um item do tipo event', () => {
  const dsn = 'https://k@host/1';
  const env = buildEnvelope(dsn, { event_id: 'e1' }, 'e1');
  const [cabecalho, item, payload] = env.trim().split('\n');
  const h = JSON.parse(cabecalho);
  assert.equal(h.dsn, dsn);
  assert.equal(h.event_id, 'e1');
  assert.equal(JSON.parse(item).type, 'event');
  assert.equal(JSON.parse(payload).event_id, 'e1');
});
