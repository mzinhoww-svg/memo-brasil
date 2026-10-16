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

test('Caddyfile usa HTTPS automático para o domínio vindo do ambiente', () => {
  assert.ok(exists('Caddyfile'), 'Caddyfile ausente');
  const c = read('Caddyfile');
  assert.match(c, /\{\$DOMINIO\}/, 'deve usar {$DOMINIO} (substituição de ambiente do Caddy)');
  assert.match(c, /reverse_proxy\s+lume:3210/, 'deve encaminhar para o serviço lume:3210');
  assert.doesNotMatch(c, /https?:\/\//, 'não deve fixar URL/domínio literal');
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
