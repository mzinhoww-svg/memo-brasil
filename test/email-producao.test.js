// Sem chave em produção o servidor recusa iniciar o envio e registra erro claro.
// Arquivo separado: o ambiente é definido antes de carregar o server.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-email-prod-'));
process.env.MASTER_TOKEN = 'master-de-teste';
process.env.NODE_ENV = 'production';
process.env.EMAIL_PROVEDOR = 'resend';
delete process.env.EMAIL_API_KEY;
delete process.env.EMAIL_FROM;

const erros = [];
const errorOriginal = console.error;
console.error = (...a) => erros.push(a.join(' '));

const app = require('../server.js');
console.error = errorOriginal;

test('produção sem EMAIL_API_KEY: envio desativado e erro registrado', async () => {
  const saida = erros.join('\n');
  assert.ok(/EMAIL_API_KEY/.test(saida), `esperava registro sobre EMAIL_API_KEY, veio: ${saida}`);

  const email = app.emailParaTestes;
  assert.equal(email.nome, 'desativado');
  await assert.rejects(
    () => email.enviar({ para: 'noivos@exemplo.com', assunto: 'x', texto: 'y' }),
    /EMAIL_API_KEY/,
  );
});
