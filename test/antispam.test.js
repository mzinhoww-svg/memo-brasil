// Testes da frente anti-spam (item 13): Turnstile opcional, rate limit por hash
// de IP e por e-mail, teto diário, TRUST_PROXY e mensagens em pt-BR.
// O verificador do Turnstile é falso (fetch/servidor injetados).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const { createTurnstile } = require('../src/antispam/turnstile.js');
const { createLimites } = require('../src/antispam/limites.js');
const { createAntispam, producao } = require('../src/antispam/index.js');

// ───── Turnstile (verificador falso)

test('turnstile: desligado em desenvolvimento sem chaves — verificação é no-op', async () => {
  const t = createTurnstile({ siteKey: '', secret: '', fetchImpl: async () => ({ json: async () => ({ success: false }) }) });
  assert.equal(t.enabled, false);
  assert.deepEqual(await t.verificar(undefined, '1.2.3.4'), { ok: true, desligado: true });
});

test('turnstile: com chaves exige token e valida no endpoint (fetch falso)', async () => {
  const chamadas = [];
  const fetchFalso = async (url, opts) => { chamadas.push({ url, opts }); return { json: async () => ({ success: opts.body.get('response') === 'valido' }) }; };
  const t = createTurnstile({ siteKey: 'site', secret: 'segredo', fetchImpl: fetchFalso, url: 'https://exemplo/siteverify' });
  assert.equal(t.enabled, true);
  assert.equal((await t.verificar('', '1.2.3.4')).ok, false);
  assert.equal((await t.verificar('ruim', '1.2.3.4')).ok, false);
  assert.equal((await t.verificar('valido', '1.2.3.4')).ok, true);
  assert.equal(chamadas.length, 2); // a chamada sem token nem chega ao fetch
  const ultima = chamadas[1];
  assert.equal(ultima.url, 'https://exemplo/siteverify');
  assert.equal(ultima.opts.method, 'POST');
  assert.equal(ultima.opts.body.get('secret'), 'segredo');
  assert.equal(ultima.opts.body.get('response'), 'valido');
});

test('turnstile: erro de rede/timeout é fail-closed, com mensagem em pt-BR', async () => {
  const t = createTurnstile({ siteKey: 's', secret: 'k', fetchImpl: async () => { throw new Error('rede offline'); } });
  const r = await t.verificar('x', '1.2.3.4');
  assert.equal(r.ok, false);
  assert.ok(/rob[ôo]|agora|instantes/i.test(r.erro));

  const t2 = createTurnstile({ siteKey: 's', secret: 'k', timeoutMs: 20, fetchImpl: (url, opts) => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new Error('abort')))) });
  const r2 = await t2.verificar('x', '1.2.3.4');
  assert.equal(r2.ok, false);
});

// ───── Limites (rate limit)

test('limites: IP só como hash curto e e-mail normalizado', () => {
  const l = createLimites({ env: {}, salt: 'sal' });
  const h = l.hashIp('200.1.2.3');
  assert.equal(h.length, 12);
  assert.ok(!h.includes('200.1.2.3'));
  assert.equal(h, l.hashIp('200.1.2.3'));
});

test('limites: bloqueia por IP após o teto da janela, com mensagem pt-BR, e libera depois', () => {
  let agora = 1_000_000;
  const l = createLimites({ env: {}, salt: 'sal', agora: () => agora, config: { maxPorIp: 2, maxPorEmail: 100, maxDiarioPorIp: 100, janelaMs: 1000 } });
  l.registrar(l.checar({ ip: '9.9.9.9' }).chaves);
  l.registrar(l.checar({ ip: '9.9.9.9' }).chaves);
  const bloqueado = l.checar({ ip: '9.9.9.9' });
  assert.equal(bloqueado.ok, false);
  assert.equal(bloqueado.status, 429);
  assert.ok(/tempo|dispositivo/i.test(bloqueado.erro));
  assert.equal(l.checar({ ip: '8.8.8.8' }).ok, true, 'outro IP não é afetado');
  agora += 2000;
  assert.equal(l.checar({ ip: '9.9.9.9' }).ok, true, 'a janela expira');
});

test('limites: bloqueia por e-mail (case-insensitive)', () => {
  const l = createLimites({ env: {}, salt: 'sal', config: { maxPorIp: 100, maxPorEmail: 2, maxDiarioPorIp: 100, janelaMs: 1000 } });
  l.registrar(l.checar({ ip: '1.1.1.1', email: 'A@Exemplo.com' }).chaves);
  l.registrar(l.checar({ ip: '2.2.2.2', email: 'a@exemplo.com' }).chaves);
  const b = l.checar({ ip: '3.3.3.3', email: 'a@EXEMPLO.com' });
  assert.equal(b.ok, false);
  assert.ok(/e-mail/i.test(b.erro));
  assert.equal(l.checar({ ip: '3.3.3.3', email: 'b@exemplo.com' }).ok, true, 'outro e-mail passa');
});

test('limites: teto diário por IP vale além da janela curta', () => {
  let agora = 0;
  const l = createLimites({ env: {}, salt: 'sal', agora: () => agora, config: { maxPorIp: 100, maxPorEmail: 100, maxDiarioPorIp: 3, janelaMs: 1000 } });
  for (let i = 0; i < 3; i++) { agora += 2000; l.registrar(l.checar({ ip: '5.5.5.5' }).chaves); }
  const b = l.checar({ ip: '5.5.5.5' });
  assert.equal(b.ok, false);
  assert.ok(/di[áa]rio/i.test(b.erro));
});

test('limites: lê os tetos do ambiente', () => {
  const l = createLimites({ env: { ANTISPAM_MAX_IP: '7', ANTISPAM_MAX_EMAIL: '2', ANTISPAM_MAX_DIA_IP: '9', ANTISPAM_JANELA_MIN: '1' }, salt: 'sal' });
  assert.equal(l.cfg.maxPorIp, 7);
  assert.equal(l.cfg.maxPorEmail, 2);
  assert.equal(l.cfg.maxDiarioPorIp, 9);
  assert.equal(l.cfg.janelaMs, 60000);
});

// ───── Produção

test('antispam: em produção exige Turnstile e endpoint https, ou falha ao subir', () => {
  assert.equal(producao({ NODE_ENV: 'development' }), false);
  assert.equal(producao({ PUBLIC_URL: 'https://a.com' }), true);
  assert.doesNotThrow(() => createAntispam({ env: { NODE_ENV: 'development' } }).exigirConfigProducao());
  assert.throws(() => createAntispam({ env: { NODE_ENV: 'production' } }).exigirConfigProducao(), /TURNSTILE/);
  const inseguro = createAntispam({ env: { NODE_ENV: 'production', TURNSTILE_SITE_KEY: 's', TURNSTILE_SECRET: 'k' }, turnstile: { enabled: true, url: 'http://inseguro', verificar: async () => ({ ok: true }) } });
  assert.throws(() => inseguro.exigirConfigProducao(), /https/);
  const seguro = createAntispam({ env: { NODE_ENV: 'production', TURNSTILE_SITE_KEY: 's', TURNSTILE_SECRET: 'k' }, turnstile: { enabled: true, url: 'https://ok/', verificar: async () => ({ ok: true }) } });
  assert.doesNotThrow(() => seguro.exigirConfigProducao());
});

// ───── Integração HTTP com verificador falso

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-antispam-'));
process.env.MASTER_TOKEN = 'master-de-teste';
process.env.NODE_ENV = 'test';
process.env.TURNSTILE_SITE_KEY = 'site-teste';
process.env.TURNSTILE_SECRET = 'segredo-teste';
process.env.ANTISPAM_MAX_IP = '2';
process.env.ANTISPAM_MAX_EMAIL = '100';
process.env.ANTISPAM_MAX_DIA_IP = '100';

let app, server, B, fakeSite;
const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (p, h = {}) => fetch(B + p, { headers: h });
const futuro = () => new Date(Date.now() + 3600e3).toISOString();

test.before(async () => {
  // Servidor falso de siteverify: só o token "token-valido" passa.
  fakeSite = http.createServer((req, res) => {
    let corpo = '';
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => {
      const ok = new URLSearchParams(corpo).get('response') === 'token-valido';
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ success: ok }));
    });
  });
  await new Promise((r) => fakeSite.listen(0, '127.0.0.1', r));
  process.env.TURNSTILE_VERIFY_URL = `http://127.0.0.1:${fakeSite.address().port}/siteverify`;
  app = require('../server.js');
  await new Promise((r) => { server = app.listen(0, r); });
  B = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { if (server) server.close(); if (fakeSite) fakeSite.close(); });

test('criação exige anti-robô configurado (verificador falso) e o rate limit por IP responde 429 em pt-BR', async () => {
  const semToken = await post('/api/events', { titulo: 'X', revealAt: futuro() });
  assert.equal(semToken.status, 403);
  assert.ok(/rob[ôo]/i.test((await semToken.json()).erro));

  const invalido = await post('/api/events', { titulo: 'X', revealAt: futuro(), turnstileToken: 'ruim' });
  assert.equal(invalido.status, 403);

  const um = await post('/api/events', { titulo: 'X', revealAt: futuro(), contato: 'a@exemplo.com', turnstileToken: 'token-valido' });
  assert.equal(um.status, 201);
  const dois = await post('/api/events', { titulo: 'Y', revealAt: futuro(), contato: 'b@exemplo.com', turnstileToken: 'token-valido' });
  assert.equal(dois.status, 201);

  const tres = await post('/api/events', { titulo: 'Z', revealAt: futuro(), contato: 'c@exemplo.com', turnstileToken: 'token-valido' });
  assert.equal(tres.status, 429);
  assert.ok(/tempo|dispositivo/i.test((await tres.json()).erro));
});

test('/api/config expõe a site key do Turnstile e o trust proxy padrão é 0', async () => {
  const cfg = await (await get('/api/config')).json();
  assert.equal(cfg.turnstileSiteKey, 'site-teste');
  assert.equal(app.get('trust proxy'), 0);
});
