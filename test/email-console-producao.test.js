// Em produção o provedor de console é recusado (fail-closed): o servidor registra
// o motivo e segue com o envio desativado, em vez de fingir que entregou e-mail.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-email-console-prod-'));
process.env.MASTER_TOKEN = 'master-de-teste';
process.env.NODE_ENV = 'production';
process.env.EMAIL_PROVIDER = 'console';

const erros = [];
const errorOriginal = console.error;
console.error = (...a) => erros.push(a.join(' '));

const app = require('../server.js');
console.error = errorOriginal;

test('produção com console: envio desativado com erro claro', async () => {
  const saida = erros.join('\n');
  assert.ok(/console/i.test(saida), `esperava registro sobre console, veio: ${saida}`);
  assert.equal(app.emailParaTestes.nome, 'desativado');
  await assert.rejects(() => app.emailParaTestes.enviar({ para: 'a@b.co', assunto: 'x', texto: 'y' }), /console/i);
});
