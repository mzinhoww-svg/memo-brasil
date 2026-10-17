// Testes dos artefatos de publicação (item 4): Docker, Caddy, systemd, scripts e docs.
// Não fazem deploy nem tocam em rede/servidor: só leem arquivos e rodam scripts em --dry-run.
// Rodar: npm test  (ou node --test test/deploy.test.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const p = (...a) => path.join(ROOT, ...a);
const read = (f) => fs.readFileSync(p(f), 'utf8');
const exists = (f) => fs.existsSync(p(f));

// ─────────────────────────── Dockerfile ───────────────────────────
test('Dockerfile usa Node 24 e roda como usuário não-root', () => {
  assert.ok(exists('Dockerfile'), 'Dockerfile ausente');
  const df = read('Dockerfile');
  assert.match(df, /^FROM\s+node:24/m, 'deve partir de uma imagem node:24');
  const users = df.split('\n').map((l) => l.trim()).filter((l) => /^USER\s+/i.test(l));
  assert.ok(users.length > 0, 'deve declarar USER (não rodar como root)');
  const ultimo = users.at(-1).replace(/^USER\s+/i, '').trim();
  assert.doesNotMatch(ultimo, /^(root|0)([:\s]|$)/i, 'o último USER não pode ser root');
  assert.doesNotMatch(df, /^\s*USER\s+root\s*$/im, 'não pode usar USER root');
});

test('Dockerfile copia src/ e scripts/ para a imagem (B1)', () => {
  const df = read('Dockerfile');
  assert.match(df, /^COPY\s+.*\bsrc\b.*\bsrc\b\s*$/m, 'deve copiar src/');
  assert.match(df, /^COPY\s+.*\bscripts\b.*\bscripts\b\s*$/m, 'deve copiar scripts/');
  const di = read('.dockerignore');
  assert.doesNotMatch(di, /^scripts\s*$/m, '.dockerignore não pode excluir scripts/ (B1)');
  assert.doesNotMatch(di, /^src\s*$/m, '.dockerignore não pode excluir src/');
  // scripts/backup.sh precisa de bash, sqlite3 e gpg dentro do container (backup antes do deploy).
  assert.match(df, /apk add[^\n]*\bbash\b/, 'deve instalar o bash');
  assert.match(df, /apk add[^\n]*\bsqlite\b/, 'deve instalar o CLI sqlite3');
  assert.match(df, /apk add[^\n]*\bgnupg\b/, 'deve instalar o gpg (gnupg)');
});

test('Dockerfile instala só dependências de produção e expõe DATA_DIR em volume', () => {
  const df = read('Dockerfile');
  assert.match(df, /npm ci[^\n]*--omit=dev|npm ci[^\n]*--production/, 'deve instalar apenas deps de produção');
  assert.match(df, /DATA_DIR\s*=\s*\/data/, 'DATA_DIR deve apontar para /data');
  assert.match(df, /VOLUME\s+\[?["']?\/data/, 'deve declarar /data como volume');
  assert.match(df, /^\s*HEALTHCHECK\b/im, 'deve ter HEALTHCHECK');
  assert.match(df, /EXPOSE\s+3210/, 'deve expor a porta 3210');
});

// ─────────────────────────── .env.example ───────────────────────────
test('.env.example lista apenas nomes de variáveis, sem valores', () => {
  assert.ok(exists('.env.example'), '.env.example ausente');
  const linhas = read('.env.example').split('\n');
  for (const [i, linha] of linhas.entries()) {
    const l = linha.trim();
    if (!l || l.startsWith('#')) continue;
    assert.match(
      l,
      /^[A-Z][A-Z0-9_]*=(\s*#.*)?$/,
      `linha ${i + 1} deve ser NOME= (sem valor): ${JSON.stringify(linha)}`,
    );
    const valor = l.slice(l.indexOf('=') + 1).split('#')[0].trim();
    assert.equal(valor, '', `linha ${i + 1} não pode ter valor`);
  }
  const conteudo = read('.env.example');
  for (const nome of ['PORT', 'DATA_DIR', 'PUBLIC_URL', 'DOMINIO', 'MASTER_TOKEN', 'VAPID_CONTACT', 'TRUST_PROXY']) {
    assert.match(conteudo, new RegExp(`^${nome}=`, 'm'), `deve documentar ${nome}`);
  }
  assert.doesNotMatch(conteudo, /:\/\//, '.env.example não pode conter URL/valor');
});

// ─────────────────────────── docker-compose ───────────────────────────
test('docker-compose sobe o app e o Caddy com dados em volume e sem segredo embutido', () => {
  assert.ok(exists('docker-compose.yml'), 'docker-compose.yml ausente');
  const yml = read('docker-compose.yml');
  assert.match(yml, /^\s{2}lume:/m, 'deve ter o serviço lume');
  assert.match(yml, /^\s{2}caddy:/m, 'deve ter o serviço caddy');
  assert.match(yml, /env_file:/, 'deve ler variáveis de env_file');
  assert.match(yml, /- "?80:80"?/, 'Caddy deve publicar a porta 80');
  assert.match(yml, /- "?443:443"?/, 'Caddy deve publicar a porta 443');
  assert.match(yml, /DATA_DIR:\s*\/data/, 'DATA_DIR do container deve ser /data');
  for (const ruim of [/MASTER_TOKEN:\s*\S+/, /EMAIL_API_KEY:\s*\S+/, /API_KEY:\s*\S+([^)]|$)/]) {
    assert.doesNotMatch(yml, ruim, 'nenhum segredo embutido no compose');
  }
});

test('Caddy recebe só DOMINIO, nunca o .env inteiro (B3)', () => {
  const yml = read('docker-compose.yml');
  // Só o serviço lume pode usar env_file; o Caddy recebe apenas o domínio.
  const envFiles = yml.match(/env_file:/g) || [];
  assert.equal(envFiles.length, 1, 'apenas o serviço lume deve usar env_file');
  assert.match(yml, /DOMINIO:\s*\$\{DOMINIO/, 'Caddy deve receber DOMINIO por interpolação');
  // O bloco do Caddy não pode referenciar segredos (ignorando comentários).
  const bloco = yml.slice(yml.indexOf('  caddy:'))
    .split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  for (const segredo of ['MASTER_TOKEN', 'EMAIL_API_KEY', 'API_KEY', 'SESSION_SECRET', 'BACKUP_']) {
    assert.doesNotMatch(bloco, new RegExp(segredo), `o serviço caddy não pode ver ${segredo}`);
  }
});

test('Caddyfile usa HTTPS automático para o domínio vindo do ambiente', () => {
  assert.ok(exists('Caddyfile'), 'Caddyfile ausente');
  const c = read('Caddyfile');
  assert.match(c, /\{\$DOMINIO\}/, 'deve usar {$DOMINIO} (substituição de ambiente do Caddy)');
  assert.match(c, /reverse_proxy\s+lume:3210/, 'deve encaminhar para o serviço lume:3210');
  assert.doesNotMatch(c, /https?:\/\//, 'não deve fixar URL/domínio literal');
});

test('log do Caddy não grava token (header e query) nem IP completo (B2)', () => {
  const c = read('Caddyfile');
  assert.match(c, /format\s+filter/, 'deve usar format filter no log');
  // Query string: parâmetros de token apagados.
  assert.match(c, /request>uri query\s*\{/, 'deve filtrar a query string');
  assert.match(c, /delete\s+token/, 'deve apagar o parâmetro token do log');
  // Cabeçalhos: os tokens trafegam em X-*-Token (após #7/#9/#12/#13/#15).
  for (const h of ['X-Host-Token', 'X-Master-Token', 'X-Guest-Token']) {
    assert.match(c, new RegExp(`request>headers>${h}\\s+delete`, 'i'), `deve apagar o cabeçalho ${h} do log`);
  }
  for (const h of ['Authorization', 'Cookie']) {
    assert.match(c, new RegExp(`request>headers>${h}\\s+delete`, 'i'), `deve apagar o cabeçalho ${h} do log`);
  }
  // IP: mascarado (ip_mask) ou apagado — nunca em claro (campo fica em request>).
  assert.match(c, /request>remote_ip\s+(ip_mask|hash|delete)\b/, 'deve mascarar/apagar remote_ip');
  assert.match(c, /request>client_ip\s+(ip_mask|hash|delete)\b/, 'deve mascarar/apagar client_ip');
});

test('scripts falham com mensagem (não silêncio) quando falta o valor de uma opção', () => {
  const casos = [
    ['scripts/restore.sh', '--backup'],
    ['scripts/restore.sh', '--data-dir'],
    ['scripts/deploy.sh', '--env-file'],
    ['scripts/deploy.sh', '--state-dir'],
  ];
  for (const [f, opt] of casos) {
    const r = comBash([f, opt], { env: { PATH: process.env.PATH, HOME: os.tmpdir() } });
    assert.notEqual(r.status, 0, `${f} ${opt}: opção sem valor deve falhar (sem silêncio)`);
    assert.ok((r.stderr + r.stdout).trim().length > 0, `${f} ${opt}: deve imprimir mensagem`);
  }
});

// ─────────────────────────── systemd ───────────────────────────
test('unidade systemd alternativa roda como usuário comum e com hardening', () => {
  const f = 'deploy/systemd/lume.service';
  assert.ok(exists(f), `${f} ausente`);
  const u = read(f);
  assert.match(u, /^User=(?!root$)\w+/m, 'deve rodar como usuário não-root');
  assert.match(u, /^ExecStart=.*node\s+server\.js/m, 'ExecStart deve iniciar o server.js');
  assert.match(u, /^EnvironmentFile=/m, 'deve carregar variáveis de um arquivo externo');
  assert.match(u, /^NoNewPrivileges=/m, 'deve ter NoNewPrivileges');
  assert.match(u, /^ProtectSystem=/m, 'deve proteger o sistema de arquivos');
});

// ─────────────────────────── scripts ───────────────────────────
const comBash = (args, opts = {}) =>
  spawnSync('bash', args, { cwd: ROOT, encoding: 'utf8', ...opts });

test('scripts/deploy.sh é executável, válido e é dry-run por padrão', () => {
  const f = 'scripts/deploy.sh';
  assert.ok(exists(f), `${f} ausente`);
  assert.ok(fs.statSync(p(f)).mode & 0o111, 'deve ser executável');
  assert.equal(comBash(['-n', f]).status, 0, 'sintaxe bash inválida');

  const r = comBash([f], {
    env: { PATH: process.env.PATH, DEPLOY_ENV_FILE: '/nao-existe', HOME: os.tmpdir() },
  });
  assert.equal(r.status, 0, `dry-run padrão deve sair 0:\n${r.stderr}`);
  assert.match(r.stdout, /DRY-RUN/i, 'deve avisar que é dry-run');
  assert.ok(!exists('.deploy'), 'dry-run não pode criar estado de deploy');

  const r2 = comBash([f], {
    env: { PATH: process.env.PATH, DEPLOY_ENV_FILE: '/nao-existe', HOME: os.tmpdir() },
  });
  assert.equal(r2.stdout, r.stdout, 'dry-run deve ser idempotente (mesma saída)');
});

test('scripts/deploy.sh recusa --apply sem DOMINIO/PUBLIC_URL antes de tocar em Docker', () => {
  const r = comBash(['scripts/deploy.sh', '--apply'], {
    env: { PATH: process.env.PATH, DEPLOY_ENV_FILE: '/nao-existe', HOME: os.tmpdir() },
  });
  assert.notEqual(r.status, 0, 'deve falhar sem as variáveis obrigatórias');
  assert.match(r.stderr + r.stdout, /DOMINIO/, 'deve citar a variável que falta');
  assert.ok(!exists('.deploy'), 'não pode criar estado quando falha na validação');
});

test('scripts/deploy.sh tem ajuda e não imprime segredos', () => {
  const r = comBash(['scripts/deploy.sh', '--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--apply/);
  assert.match(r.stdout, /--dry-run/);
  assert.match(read('scripts/deploy.sh'), /--rollback/, 'deve oferecer rollback');
});

test('scripts/restore.sh exige backup, é dry-run por padrão e não altera dados', () => {
  const f = 'scripts/restore.sh';
  assert.ok(exists(f), `${f} ausente`);
  assert.ok(fs.statSync(p(f)).mode & 0o111, 'deve ser executável');
  assert.equal(comBash(['-n', f]).status, 0, 'sintaxe bash inválida');

  const semArgs = comBash([f], { env: { PATH: process.env.PATH } });
  assert.notEqual(semArgs.status, 0, 'sem --backup deve falhar');
  assert.match(semArgs.stderr + semArgs.stdout, /--backup|uso/i);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-restore-'));
  const origem = path.join(tmp, 'origem');
  fs.mkdirSync(path.join(origem, 'photos'), { recursive: true });
  fs.writeFileSync(path.join(origem, 'db.json'), '{"events":{"novo":{}}}');
  fs.writeFileSync(path.join(origem, 'photos', 'a.jpg'), 'x');
  const tar = path.join(tmp, 'backup.tar.gz');
  execFileSync('tar', ['-czf', tar, '-C', origem, '.']);

  const destino = path.join(tmp, 'data');
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, 'db.json'), '{"events":{"antigo":{}}}');

  const r = comBash([f, '--backup', tar, '--data-dir', destino], { env: { PATH: process.env.PATH } });
  assert.equal(r.status, 0, `restore dry-run deve sair 0:\n${r.stderr}`);
  assert.match(r.stdout, /DRY-RUN/i);
  assert.equal(fs.readFileSync(path.join(destino, 'db.json'), 'utf8'), '{"events":{"antigo":{}}}', 'dry-run não pode alterar dados');
});

test('scripts/deploy.sh lê o .env sem fazer source (não vaza nem executa valores)', () => {
  const sh = read('scripts/deploy.sh');
  assert.doesNotMatch(sh, /^\s*(source|\.)\s+.*ENV_FILE/m, 'não pode dar source no .env');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-env-'));
  const envf = path.join(tmp, '.env');
  fs.writeFileSync(envf, [
    'DOMINIO=exemplo.test',
    'PUBLIC_URL=https://exemplo.test',
    'MASTER_TOKEN=valor-que-nao-pode-vazar',
    'EMAIL_API_KEY=outro-valor-secreto',
  ].join('\n'));
  const r = comBash(['scripts/deploy.sh'], {
    env: { PATH: process.env.PATH, DEPLOY_ENV_FILE: envf, HOME: tmp },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, /valor-que-nao-pode-vazar|outro-valor-secreto/, 'não pode imprimir valores do .env');
  assert.match(r.stdout, /https:\/\/exemplo\.test\/api\/config/, 'deve ler PUBLIC_URL do .env para o healthcheck');
});

test('scripts/deploy.sh faz backup antes de subir e preserva o rollback', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-state-'));
  const state = path.join(tmp, 'state');
  fs.mkdirSync(state);
  fs.writeFileSync(path.join(state, 'previous-tag'), 'aaa111\n');
  const env = {
    PATH: process.env.PATH, DEPLOY_ENV_FILE: '/nao-existe', HOME: tmp,
    DOMINIO: 'exemplo.test', PUBLIC_URL: 'https://exemplo.test',
  };

  const r = comBash(['scripts/deploy.sh', '--state-dir', state, '--current-tag', 'deadbee'], { env });
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  const iBackup = out.toLowerCase().indexOf('backup');
  const iUp = out.indexOf('up -d');
  assert.ok(iBackup !== -1, 'deve haver uma etapa de backup');
  assert.ok(iUp !== -1, 'deve haver up -d');
  assert.ok(iBackup < iUp, 'o backup deve vir antes do up -d');
  assert.match(out, /previous-tag[^\n]*deadbee/i, 'dry-run deve mostrar o rollback que registraria');
  assert.equal(fs.readFileSync(path.join(state, 'previous-tag'), 'utf8').trim(), 'aaa111', 'dry-run não pode alterar o state');

  const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const r2 = comBash(['scripts/deploy.sh', '--state-dir', state, '--current-tag', head], { env });
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(r2.stdout, /preserv/i, 'mesma versão deve preservar o previous-tag');
  assert.equal(fs.readFileSync(path.join(state, 'previous-tag'), 'utf8').trim(), 'aaa111', 'não pode sobrescrever o rollback');
});

test('scripts/restore.sh restaura SQLite e reaplica as exclusões do backup', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-sqlite-'));
  const origem = path.join(tmp, 'origem');
  fs.mkdirSync(path.join(origem, 'photos'), { recursive: true });
  fs.mkdirSync(path.join(origem, 'backups'), { recursive: true });
  fs.writeFileSync(path.join(origem, 'memo.db'), 'SQLITE-NOVO');
  fs.writeFileSync(path.join(origem, 'memo.db-wal'), 'wal');
  fs.writeFileSync(path.join(origem, 'memo.db-shm'), 'shm');
  fs.writeFileSync(path.join(origem, 'backups', 'antigo.tar.gz'), 'lixo');
  fs.writeFileSync(path.join(origem, 'photos', 'a.jpg'), 'x');
  const tar = path.join(tmp, 'backup.tar.gz');
  execFileSync('tar', ['-czf', tar, '-C', origem, '.']);

  const destino = path.join(tmp, 'data');
  fs.mkdirSync(path.join(destino, 'photos'), { recursive: true });
  fs.writeFileSync(path.join(destino, 'memo.db'), 'SQLITE-ANTIGO');
  fs.writeFileSync(path.join(destino, 'master.token'), 'token-do-host');
  fs.writeFileSync(path.join(destino, 'backups-marcador'), 'fica');

  // dry-run aceita backup sem db.json (só SQLite)
  const dry = comBash(['scripts/restore.sh', '--backup', tar, '--data-dir', destino], { env: { PATH: process.env.PATH } });
  assert.equal(dry.status, 0, `dry-run com SQLite deve sair 0:\n${dry.stderr}`);
  assert.equal(fs.readFileSync(path.join(destino, 'memo.db'), 'utf8'), 'SQLITE-ANTIGO', 'dry-run não altera');

  const r = comBash(['scripts/restore.sh', '--backup', tar, '--data-dir', destino, '--apply', '--yes', '--no-restart'], {
    env: { PATH: process.env.PATH },
  });
  assert.equal(r.status, 0, `apply deve sair 0:\n${r.stderr}`);
  assert.equal(fs.readFileSync(path.join(destino, 'memo.db'), 'utf8'), 'SQLITE-NOVO', 'deve restaurar o SQLite');
  assert.ok(!fs.existsSync(path.join(destino, 'memo.db-wal')), 'não pode restaurar -wal');
  assert.ok(!fs.existsSync(path.join(destino, 'memo.db-shm')), 'não pode restaurar -shm');
  assert.ok(!fs.existsSync(path.join(destino, 'backups', 'antigo.tar.gz')), 'não pode restaurar a pasta backups/');
  assert.equal(fs.readFileSync(path.join(destino, 'master.token'), 'utf8'), 'token-do-host', 'não pode apagar o master.token do host');
  assert.equal(fs.readFileSync(path.join(destino, 'photos', 'a.jpg'), 'utf8'), 'x', 'deve restaurar as fotos');
});

test('scripts/restore.sh trata backup cifrado (.gpg)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-gpg-'));
  const origem = path.join(tmp, 'origem');
  fs.mkdirSync(origem, { recursive: true });
  fs.writeFileSync(path.join(origem, 'memo.db'), 'SQLITE');
  const tar = path.join(tmp, 'backup.tar.gz');
  execFileSync('tar', ['-czf', tar, '-C', origem, '.']);

  let temGpg = true;
  try { execFileSync('gpg', ['--version'], { stdio: 'ignore' }); } catch { temGpg = false; }

  const gpgarq = tar + '.gpg';
  if (temGpg) {
    execFileSync('gpg', ['--batch', '--yes', '--passphrase', 'senha-de-teste', '--symmetric', '--cipher-algo', 'AES256', tar]);
  } else {
    fs.writeFileSync(gpgarq, 'nao-e-gpg-de-verdade');
  }

  const destino = path.join(tmp, 'data');
  fs.mkdirSync(destino, { recursive: true });

  // sem chave/senha: erro claro
  const semChave = comBash(['scripts/restore.sh', '--backup', gpgarq, '--data-dir', destino], { env: { PATH: process.env.PATH } });
  assert.notEqual(semChave.status, 0, 'sem senha/chave deve falhar');
  assert.match(semChave.stderr + semChave.stdout, /BACKUP_PASSPHRASE|BACKUP_GPG_KEY/, 'deve citar a variável que resolve');

  if (temGpg) {
    const ok = comBash(['scripts/restore.sh', '--backup', gpgarq, '--data-dir', destino], {
      env: { PATH: process.env.PATH, BACKUP_PASSPHRASE: 'senha-de-teste' },
    });
    assert.equal(ok.status, 0, `com senha deve sair 0:\n${ok.stderr}`);
    assert.match(ok.stdout, /DRY-RUN/i);
  }
});

// ─────────────────────────── docs ───────────────────────────
test('docs/deploy.md cobre passo a passo, go-live, rollback e custo vs teto de R$ 100', () => {
  const f = 'docs/deploy.md';
  assert.ok(exists(f), `${f} ausente`);
  const d = read(f);
  assert.match(d, /##\s*Passo a passo/i, 'deve ter passo a passo');
  assert.match(d, /checklist de go-live/i, 'deve ter checklist de go-live');
  assert.match(d, /[Rr]ollback/, 'deve ter rollback');
  assert.match(d, /R\$\s*100/, 'deve comparar com o teto de R$ 100');
  assert.match(d, /hadolint|docker build/i, 'deve registrar a validação de build');
});

test('docs/ACTIONS.md marca o que só uma pessoa pode fazer na publicação', () => {
  const f = 'docs/ACTIONS.md';
  assert.ok(exists(f), `${f} ausente`);
  const d = read(f);
  assert.match(d, /[Pp]ublica/, 'deve ter a seção de publicação');
  assert.match(d, /DNS|[Dd]om[ií]nio/, 'deve citar domínio/DNS');
  assert.match(d, /chave SSH|[Ss]SH/, 'deve citar chave SSH');
  assert.doesNotMatch(d, /(gho_|sk-|AKIA|BEGIN [A-Z ]*PRIVATE KEY)/, 'não pode conter segredo');
});

// ─────────────────────────── segredos ───────────────────────────
test('nenhum artefato de deploy embute token ou senha', () => {
  const arquivos = ['Dockerfile', 'docker-compose.yml', 'Caddyfile', '.env.example', 'scripts/deploy.sh', 'scripts/restore.sh'];
  for (const a of arquivos) {
    if (!exists(a)) continue;
    const c = read(a);
    assert.doesNotMatch(c, /(ghp_|gho_|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{20,})/, `${a} parece conter segredo`);
  }
});
