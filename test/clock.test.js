// Prova que a injeção de relógio (TEST_NOW, advance, setNow) é só de teste:
// com NODE_ENV=production o relógio é o real e qualquer tentativa de forçar a
// hora falha. Isso protege a revelação de um TEST_NOW perdido em produção.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');

const CLOCK = path.join(__dirname, '..', 'src', 'clock.js');
const rodar = (env, script) =>
  execFileSync(process.execPath, ['-e', script], { env: { ...process.env, ...env }, encoding: 'utf8' }).trim();

test('produção ignora TEST_NOW e recusa advance/setNow', () => {
  const script = `
    const c = require(${JSON.stringify(CLOCK)});
    const dif = Math.abs(c.now().getTime() - Date.now());
    let avancar = 'nao', fixar = 'nao';
    try { c.advance(3600e3); } catch { avancar = 'sim'; }
    try { c.setNow('2099-01-01T00:00:00.000Z'); } catch { fixar = 'sim'; }
    console.log(JSON.stringify({ dif, avancar, fixar, emTeste: c.emTeste() }));
  `;
  const r = JSON.parse(rodar({ NODE_ENV: 'production', TEST_NOW: '2099-01-01T00:00:00.000Z' }, script));
  assert.equal(r.emTeste, false);
  assert.ok(r.dif < 5000, `relógio devia ser o real, diferença de ${r.dif}ms`);
  assert.equal(r.avancar, 'sim');
  assert.equal(r.fixar, 'sim');
});

test('NODE_ENV=test honra TEST_NOW e avança com advance', () => {
  const script = `
    const c = require(${JSON.stringify(CLOCK)});
    const inicio = c.iso();
    c.advance(3600e3);
    console.log(JSON.stringify({ inicio, depois: c.iso(), emTeste: c.emTeste() }));
  `;
  const r = JSON.parse(rodar({ NODE_ENV: 'test', TEST_NOW: '2030-05-05T12:00:00.000Z' }, script));
  const base = Date.parse('2030-05-05T12:00:00.000Z');
  assert.equal(r.emTeste, true);
  assert.ok(Date.parse(r.inicio) >= base && Date.parse(r.inicio) < base + 5000, r.inicio);
  assert.ok(Date.parse(r.depois) >= base + 3600e3 && Date.parse(r.depois) < base + 3600e3 + 5000, r.depois);
});

test('sem TEST_NOW o modo de teste continua no relógio real', () => {
  const script = `
    const c = require(${JSON.stringify(CLOCK)});
    console.log(JSON.stringify({ dif: Math.abs(c.now().getTime() - Date.now()) }));
  `;
  const r = JSON.parse(rodar({ NODE_ENV: 'test', TEST_NOW: '' }, script));
  assert.ok(r.dif < 5000, `diferença de ${r.dif}ms`);
});
