const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checarCopy } = require('../scripts/check-copy-features');

function pasta(arquivos, features) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-'));
  fs.writeFileSync(path.join(dir, 'features.json'), JSON.stringify(features));
  for (const [nome, conteudo] of Object.entries(arquivos)) fs.writeFileSync(path.join(dir, nome), conteudo);
  return dir;
}
const OFF = { 'feature.retencao': { ativo: false, descricao: 'job de retenção' } };
const ON = { 'feature.retencao': { ativo: true, descricao: 'job de retenção' } };

test('chave inexistente em features.json é erro', () => {
  const dir = pasta({ 'a.md': 'Apagamos tudo 🔧 feature.nao_existe\n' }, OFF);
  const r = checarCopy(dir);
  assert.strictEqual(r.erros.length, 1);
  assert.match(r.erros[0], /feature\.nao_existe/);
});

test('linha com chave sem 🔧 é erro', () => {
  const dir = pasta({ 'a.md': 'Apagamos tudo feature.retencao\n' }, OFF);
  assert.strictEqual(checarCopy(dir).erros.length, 1);
});

test('texto com 🔧 e chave desligada vira pendência, não erro', () => {
  const dir = pasta({ 'a.md': 'Apagamos tudo 🔧 feature.retencao\n' }, OFF);
  const r = checarCopy(dir);
  assert.deepStrictEqual(r.erros, []);
  assert.strictEqual(r.pendentes.length, 1);
});

test('publicar com chave desligada falha; com chave ligada passa', () => {
  const md = { 'a.md': 'Apagamos tudo 🔧 feature.retencao\n' };
  assert.strictEqual(checarCopy(pasta(md, OFF), { publicar: true }).erros.length, 1);
  assert.deepStrictEqual(checarCopy(pasta(md, ON), { publicar: true }).erros, []);
});

test('prazo de retenção fixo no texto é erro; variável é aceita', () => {
  assert.strictEqual(checarCopy(pasta({ 'a.md': 'Guardamos por 12 meses.\n' }, OFF)).erros.length, 1);
  assert.deepStrictEqual(checarCopy(pasta({ 'a.md': 'Guardamos por {retencao_meses} meses.\n' }, OFF)).erros, []);
});

test('nome antigo da marca é erro; coluna "atual" de tabela é ignorada', () => {
  assert.strictEqual(checarCopy(pasta({ 'a.md': 'Bem-vindo ao Memo Brasil\n' }, OFF)).erros.length, 1);
  assert.strictEqual(checarCopy(pasta({ 'a.md': 'Entre no {marca}\n' }, OFF)).erros.length, 1);
  const tabela = '| El | Atual | Novo |\n|---|---|---|\n| h1 | Organização — Memo Brasil | Organização · Lume |\n';
  assert.deepStrictEqual(checarCopy(pasta({ 'a.md': tabela }, OFF)).erros, []);
});

test('README.md documenta o mecanismo e não é texto publicado', () => {
  const dir = pasta({ 'README.md': 'Cite feature.retencao sem marcador e {marca}.\n' }, OFF);
  assert.deepStrictEqual(checarCopy(dir).erros, []);
});
