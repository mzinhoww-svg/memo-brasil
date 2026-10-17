// Testes dos comandos de LGPD e das regras de retenção/denúncia, sobre o Store/SQLite.
// DATA_DIR é temporário; nada aqui toca em data/ real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');
const createStore = require('../src/store');
const { dadosExportaveis } = require('../src/lgpd/exportar');
const { configRetencao, motivoExpiracao } = require('../src/lgpd/retencao');
const { registrarDenuncia, MAX_DENUNCIAS_POR_CONVIDADO } = require('../src/lgpd/denuncia');
const { registrarExclusao } = require('../src/lgpd/auditoria');

const RAIZ = path.join(__dirname, '..');
const DIA = 86400000;
let DIR;

function evento(id, { criadoDias = 0, reveladoDias = null, futuroDias = 30, revealNotified = false, contato = '' } = {}) {
  const agora = Date.now();
  return {
    id, hostToken: `tk-${id}`, titulo: `Evento ${id}`,
    revealAt: reveladoDias != null ? new Date(agora - reveladoDias * DIA).toISOString() : new Date(agora + futuroDias * DIA).toISOString(),
    createdAt: new Date(agora - criadoDias * DIA).toISOString(),
    fotosPorConvidado: 5, dataEvento: null, local: '', endereco: '', mensagem: '', contato,
    suspenso: false, limites: {}, config: { recadosAtivos: true, apenasLista: false, mostrarAutor: true },
    push: [], avisos: [], revealNotified, cronograma: [], lista: [], equipe: [], recados: [],
    guests: [{ id: `${id}-g1`, nome: 'Rafa', entrouEm: new Date().toISOString(), tokenHash: 'hash-que-nao-pode-vazar' }],
    photos: [{ id: `${id}-p1`, ext: 'jpg', guestId: `${id}-g1`, autor: 'Rafa', criadaEm: new Date().toISOString(), oculta: false }],
    denuncias: [], consentimentos: [{ id: `${id}-c1`, guestId: `${id}-g1`, versao: 'consentimento-convidado v0.1', fotos: true, avisos: false, em: new Date().toISOString() }],
    retencaoAvisoEm: null,
  };
}

function montar(opcoes = {}) {
  DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-lgpd-scr-'));
  for (const id of ['ev1', 'ev2']) {
    fs.mkdirSync(path.join(DIR, 'photos', id), { recursive: true });
    fs.writeFileSync(path.join(DIR, 'photos', id, `${id}-p1.jpg`), Buffer.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]));
  }
  const store = createStore(DIR);
  store.db.events.ev1 = evento('ev1', { criadoDias: 400, reveladoDias: 400, revealNotified: true, contato: 'noivos@example.com' });
  store.db.events.ev2 = evento('ev2', { criadoDias: 400, reveladoDias: 200, revealNotified: false });
  store.db.events.ev3 = evento('ev3', { criadoDias: 400, futuroDias: 400, revealNotified: false }); // nunca apagar antes de acontecer
  store.db.events.ev4 = evento('ev4', { criadoDias: 400, reveladoDias: 350, revealNotified: true });
  store.db.events.ev5 = evento('ev5', { criadoDias: 400, reveladoDias: 340, revealNotified: true, contato: 'noivos5@example.com' }); // aviso em 25 dias
  for (const id of ['ev3', 'ev4', 'ev5']) fs.mkdirSync(path.join(DIR, 'photos', id), { recursive: true });
  if (opcoes.semFotos) { /* usado quando o teste quer só o banco */ }
  store.save();
  store.close();
}

function lerDb() {
  const store = createStore(DIR);
  try { return JSON.parse(JSON.stringify(store.db)); } finally { store.close(); }
}
const rodar = (script, args, env = {}) =>
  spawnSync(process.execPath, [path.join(RAIZ, 'scripts', script), ...args], { cwd: RAIZ, encoding: 'utf8', env: { ...process.env, DATA_DIR: DIR, ...env } });

test.beforeEach(() => montar());

test('exportar-evento lê o SQLite, gera zip 0600 e não vaza tokens', () => {
  const saida = path.join(DIR, 'export', 'exp.zip');
  const r = rodar('exportar-evento.js', ['ev1', `--saida=${saida}`]);
  assert.equal(r.status, 0, r.stderr);
  const buf = fs.readFileSync(saida);
  assert.equal(buf.slice(0, 2).toString(), 'PK');
  assert.ok(buf.includes(Buffer.from('dados.json')));
  assert.ok(buf.includes(Buffer.from('fotos/Rafa/001.jpg')));
  assert.ok(!buf.includes(Buffer.from('tk-ev1')), 'o hostToken não pode vazar');
  assert.ok(!buf.includes(Buffer.from('hash-que-nao-pode-vazar')), 'o tokenHash não pode vazar');
  assert.equal(fs.statSync(saida).mode & 0o777, 0o600);
  assert.ok(r.stdout.includes('dados pessoais'));
});

test('exportar-evento exige id existente', () => {
  const r = rodar('exportar-evento.js', ['inexistente', `--saida=${path.join(DIR, 'x.zip')}`]);
  assert.equal(r.status, 1);
  assert.ok(!fs.existsSync(path.join(DIR, 'x.zip')));
});

test('dadosExportaveis remove hostTokenHash, tokenHash e guestTokenHash', () => {
  const ev = evento('evX');
  ev.equipe = [{ id: 'm1', nome: 'Carla', papel: 'cerimonial', tokenHash: 'hash-equipe' }];
  ev.guests[0].guestTokenHash = 'hash-convidado';
  ev.push = [{ id: 'q1', sub: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } } }];
  const txt = JSON.stringify(dadosExportaveis(ev, [{ id: 'p1', nome: 'fotos/Rafa/001.jpg' }]));
  for (const segredo of ['tk-evX', 'hash-equipe', 'hash-convidado', 'push.example', '"push"']) assert.ok(!txt.includes(segredo), segredo);
  assert.ok(txt.includes('consentimento-convidado'));
});

test('apagar-evento nem roda sem --confirmar e exige o id certo', () => {
  assert.equal(rodar('apagar-evento.js', ['ev1']).status, 2);
  assert.equal(rodar('apagar-evento.js', ['ev1', '--confirmar=ev2']).status, 2);
  assert.ok(lerDb().events.ev1);
  assert.ok(fs.existsSync(path.join(DIR, 'photos', 'ev1', 'ev1-p1.jpg')));
});

test('apagar-evento se recusa a rodar com o servidor ativo (lock)', () => {
  fs.writeFileSync(path.join(DIR, 'server.lock'), JSON.stringify({ pid: process.pid }));
  const r = rodar('apagar-evento.js', ['ev1', '--confirmar=ev1']);
  assert.equal(r.status, 3);
  assert.ok(r.stderr.includes('servidor está ativo'));
  assert.ok(lerDb().events.ev1);
});

test('apagar-evento apaga do SQLite e dos arquivos, audita e deixa o túmulo', () => {
  const r = rodar('apagar-evento.js', ['ev1', '--confirmar=ev1']);
  assert.equal(r.status, 0, r.stderr);
  const db = lerDb();
  assert.equal(db.events.ev1, undefined);
  assert.ok(db.events.ev2, 'não pode tocar em outro evento');
  assert.ok(!fs.existsSync(path.join(DIR, 'photos', 'ev1')));
  const audit = fs.readFileSync(path.join(DIR, 'audit.log'), 'utf8');
  assert.ok(audit.includes('evento.excluido'));
  assert.ok(!audit.includes('Rafa'), 'auditoria sem PII');
  assert.ok(fs.readFileSync(path.join(DIR, 'excluidos.log'), 'utf8').includes('ev1'));
});

test('retencao.js é dry-run por padrão e não apaga nada', () => {
  const r = rodar('retencao.js', []);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('evento=ev1'));
  assert.ok(r.stdout.includes('evento=ev2'));
  assert.ok(r.stdout.includes('evento=ev4')); // aviso em 15 dias
  assert.ok(r.stdout.includes('evento=ev5')); // aviso em 25 dias
  assert.ok(!r.stdout.includes('evento=ev3'), 'evento futuro não pode ser listado');
  assert.ok(r.stdout.includes('Dry-run'));
  const db = lerDb();
  assert.ok(db.events.ev1 && db.events.ev2 && db.events.ev3 && db.events.ev5);
});

test('retencao.js --executar apaga só os vencidos e avisa 30 dias antes', () => {
  const r = rodar('retencao.js', ['--executar']);
  assert.equal(r.status, 0, r.stderr);
  const db = lerDb();
  assert.equal(db.events.ev1, undefined);
  assert.equal(db.events.ev2, undefined);
  assert.ok(db.events.ev3, 'evento com revealAt no futuro nunca expira');
  assert.ok(db.events.ev4, '350 dias < 365');
  assert.ok(db.events.ev5, 'ainda não venceu');
  assert.ok(db.events.ev5.retencaoAvisoEm, 'o aviso ao casal deve ficar registrado');
  const outbox = fs.readFileSync(path.join(DIR, 'outbox', 'retencao-ev5.json'), 'utf8');
  assert.ok(outbox.includes('noivos5@example.com'));
  const audit = fs.readFileSync(path.join(DIR, 'audit.log'), 'utf8');
  assert.ok(audit.includes('retencao.aviso'));
  assert.ok(audit.includes('evento.expirado'));
  assert.ok(!audit.includes('noivos5@example.com'), 'auditoria sem e-mail do casal');
  assert.ok(!audit.includes('Rafa'));
  assert.ok(fs.readFileSync(path.join(DIR, 'excluidos.log'), 'utf8').includes('ev1'));
  assert.ok(!fs.existsSync(path.join(DIR, 'photos', 'ev2')));
});

test('retencao.js se recusa a rodar com o servidor ativo', () => {
  fs.writeFileSync(path.join(DIR, 'server.lock'), JSON.stringify({ pid: process.pid }));
  const r = rodar('retencao.js', ['--executar']);
  assert.equal(r.status, 3);
  assert.ok(lerDb().events.ev1);
});

test('retencao.js respeita RETENCAO_DIAS_APOS_REVELACAO do ambiente', () => {
  const r = rodar('retencao.js', [], { RETENCAO_DIAS_APOS_REVELACAO: '500' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes('evento=ev1'));
  assert.ok(!r.stdout.includes('evento=ev4'));
  assert.ok(r.stdout.includes('evento=ev2'));
});

test('configRetencao usa padrões 365/180 e aceita settings.json e ambiente', () => {
  assert.deepEqual(configRetencao(), { diasAposRevelacao: 365, diasSemRevelacao: 180 });
  assert.deepEqual(configRetencao({ settings: { retencaoDiasAposRevelacao: 730, retencaoDiasSemRevelacao: 90 } }),
    { diasAposRevelacao: 730, diasSemRevelacao: 90 });
  assert.equal(configRetencao({ settings: { retencaoDiasAposRevelacao: 730 }, env: { RETENCAO_DIAS_APOS_REVELACAO: '100' } }).diasAposRevelacao, 100);
});

test('retenção: revealAt no futuro nunca expira, mesmo com createdAt antigo (B1)', () => {
  const cfg = configRetencao();
  const agora = Date.now();
  const futuro = { revealAt: new Date(agora + 400 * DIA).toISOString(), createdAt: new Date(agora - 400 * DIA).toISOString(), revealNotified: false };
  assert.equal(motivoExpiracao(futuro, agora, cfg), null);
  const passadoSemRevelar = { revealAt: new Date(agora - 200 * DIA).toISOString(), createdAt: new Date(agora - 400 * DIA).toISOString(), revealNotified: false };
  assert.equal(motivoExpiracao(passadoSemRevelar, agora, cfg), 'sem-revelacao');
  const revelado = { revealAt: new Date(agora - 400 * DIA).toISOString(), revealNotified: true };
  assert.equal(motivoExpiracao(revelado, agora, cfg), 'pos-revelacao');
  const recente = { revealAt: new Date(agora - 100 * DIA).toISOString(), revealNotified: true };
  assert.equal(motivoExpiracao(recente, agora, cfg), null);
});

test('denúncia limita por convidado (antiabuso)', () => {
  const photos = Array.from({ length: MAX_DENUNCIAS_POR_CONVIDADO + 2 }, (_, i) => ({ id: `f${i}` }));
  const ev = { photos, denuncias: [] };
  const guest = { id: 'g1' };
  for (let i = 0; i < MAX_DENUNCIAS_POR_CONVIDADO; i++) assert.ok(registrarDenuncia(ev, { fotoId: `f${i}`, guest }).denuncia);
  assert.equal(registrarDenuncia(ev, { fotoId: 'f999', guest }).status, 404);
  assert.equal(registrarDenuncia(ev, { fotoId: `f${MAX_DENUNCIAS_POR_CONVIDADO}`, guest }).status, 429);
});

test('túmulo de exclusão é append-only e sem PII', () => {
  registrarExclusao(DIR, { id: 'evX', motivo: 'teste' });
  registrarExclusao(DIR, { id: 'evY', motivo: 'teste' });
  const linhas = fs.readFileSync(path.join(DIR, 'excluidos.log'), 'utf8').trim().split('\n');
  assert.equal(linhas.length, 2);
  assert.ok(linhas.every((l) => !l.includes('Rafa')));
});
