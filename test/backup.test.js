const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function runBackup(env) {
  return spawnSync('bash', ['scripts/backup.sh'], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test('backup: em produção sem chave/passphrase falha com mensagem clara', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-backup-prod-node-'));
  const r = runBackup({
    DATA_DIR: dir, NODE_ENV: 'production', PUBLIC_URL: '',
    BACKUP_GPG_KEY: '', BACKUP_PASSPHRASE: '',
  });
  assert.notEqual(r.status, 0, 'deve falhar sem cifra em produção');
  assert.match(r.stderr, /BACKUP_GPG_KEY|BACKUP_PASSPHRASE/);
  assert.equal(fs.existsSync(path.join(dir, 'backups')), false, 'não deve criar backup sem cifra');
});

test('backup: PUBLIC_URL https também é produção e exige cifra', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-backup-prod-url-'));
  const r = runBackup({
    DATA_DIR: dir, NODE_ENV: '', PUBLIC_URL: 'https://memo.exemplo.test',
    BACKUP_GPG_KEY: '', BACKUP_PASSPHRASE: '',
  });
  assert.notEqual(r.status, 0, 'PUBLIC_URL https deve exigir cifra');
  assert.match(r.stderr, /BACKUP_GPG_KEY|BACKUP_PASSPHRASE/);
  assert.equal(fs.existsSync(path.join(dir, 'backups')), false);
});

test('backup: NODE_ENV=Production (maiúsculas) também é tratado como produção', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-backup-prod-case-'));
  const r = runBackup({
    DATA_DIR: dir, NODE_ENV: 'Production', PUBLIC_URL: '',
    BACKUP_GPG_KEY: '', BACKUP_PASSPHRASE: '',
  });
  assert.notEqual(r.status, 0, 'NODE_ENV sem diferenciar maiúsculas');
  assert.match(r.stderr, /BACKUP_GPG_KEY|BACKUP_PASSPHRASE/);
  assert.equal(fs.existsSync(path.join(dir, 'backups')), false);
});

test('backup: PUBLIC_URL HTTPS:// (maiúsculas) também exige cifra', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-backup-url-case-'));
  const r = runBackup({
    DATA_DIR: dir, NODE_ENV: '', PUBLIC_URL: 'HTTPS://Memo.Exemplo.Test',
    BACKUP_GPG_KEY: '', BACKUP_PASSPHRASE: '',
  });
  assert.notEqual(r.status, 0, 'PUBLIC_URL https sem diferenciar maiúsculas');
  assert.match(r.stderr, /BACKUP_GPG_KEY|BACKUP_PASSPHRASE/);
});

test('backup: falha do gpg apaga o .tar.gz em claro e sai com erro', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-backup-gpgfail-'));
  const r = runBackup({
    DATA_DIR: dir, NODE_ENV: 'development', PUBLIC_URL: 'http://localhost:3210',
    BACKUP_GPG_KEY: 'chave-que-nao-existe@exemplo.test', BACKUP_PASSPHRASE: '',
  });
  assert.notEqual(r.status, 0, 'gpg falhou, o script deve sair com erro');
  const backups = fs.existsSync(path.join(dir, 'backups')) ? fs.readdirSync(path.join(dir, 'backups')) : [];
  assert.equal(backups.filter((f) => f.endsWith('.tar.gz')).length, 0, 'não pode sobrar .tar.gz em claro');
});

test('backup: fora de produção não exige cifra e gera o arquivo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-backup-dev-'));
  const r = runBackup({
    DATA_DIR: dir, NODE_ENV: 'development', PUBLIC_URL: 'http://localhost:3210',
    BACKUP_GPG_KEY: '', BACKUP_PASSPHRASE: '',
  });
  assert.equal(r.status, 0, r.stderr);
  const outs = fs.readdirSync(path.join(dir, 'backups')).filter((f) => f.startsWith('memo-') && f.endsWith('.tar.gz'));
  assert.equal(outs.length, 1, 'deve gerar um backup .tar.gz');
  assert.match(r.stdout, /retenção de 30 dias/);
});
