// Testes unitários do limite por IP (src/limite.js). Rodar: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { criarLimite } = require('../src/limite.js');

test('bloqueia depois de max falhas e libera ao expirar a janela', () => {
  const l = criarLimite({ max: 3, janelaMs: 1000 });
  const ip = '10.0.0.1';
  assert.equal(l.atingiu(ip, 0), false);
  l.falhou(ip, 0);
  l.falhou(ip, 1);
  assert.equal(l.atingiu(ip, 2), false, 'duas falhas ainda não bloqueiam');
  l.falhou(ip, 2);
  assert.equal(l.atingiu(ip, 3), true, 'a terceira falha bloqueia');
  assert.equal(l.atingiu(ip, 999), true, 'ainda dentro da janela');
  assert.equal(l.atingiu(ip, 1000), false, 'fora da janela, libera');
});

test('um acerto zera o balde; IPs são independentes', () => {
  const l = criarLimite({ max: 2, janelaMs: 1000 });
  l.falhou('a', 0);
  l.limpou('a');
  l.falhou('a', 1);
  assert.equal(l.atingiu('a', 2), false, 'o acerto zerou a contagem');
  l.falhou('a', 2);
  assert.equal(l.atingiu('a', 3), true);
  assert.equal(l.atingiu('b', 3), false, 'outro IP não é afetado');
});
