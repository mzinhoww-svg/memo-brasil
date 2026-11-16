// A senha do master nunca por argumento: histórico do shell e `ps` são públicos
// para qualquer processo da máquina. Vale MASTER_SENHA, o stdin ou o prompt.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'master-criar.js');
const novoDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'memo-mastercli-'));
const SENHA = 'senha-muito-forte-123';

function rodar(args, env = {}, input) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: 30000,
    input,
    env: { ...process.env, DATA_DIR: novoDir(), NODE_ENV: 'test', MASTER_SENHA: '', ...env },
  });
}

test('senha por argumento é recusada e não aparece na saída', () => {
  const r = rodar(['ana@exemplo.com', 'Ana', SENHA]);
  assert.equal(r.status, 2, 'sai com erro de uso');
  assert.match(r.stderr, /MASTER_SENHA/, 'explica o caminho certo');
  assert.equal(r.stdout.includes(SENHA), false);
  assert.equal(r.stderr.includes(SENHA), false);
});

test('MASTER_SENHA cria a conta e nunca imprime a senha', () => {
  const r = rodar(['ana@exemplo.com', 'Ana'], { MASTER_SENHA: SENHA, MASTER_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.id);
  assert.ok(out.totpSecret);
  assert.equal(out.recoveryCodes.length, 10);
  assert.equal(r.stdout.includes(SENHA), false, 'a senha não vai para o stdout');
});

test('sem MASTER_SENHA, lê a primeira linha do stdin', () => {
  const r = rodar(['bia@exemplo.com', 'Bia'], {}, 'senha-muito-forte-456\n');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(JSON.parse(r.stdout).id);
});

test('senha fraca é recusada com a mensagem da política', () => {
  const r = rodar(['cia@exemplo.com', 'Cia'], { MASTER_SENHA: '123456' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /12 caracteres/);
});
