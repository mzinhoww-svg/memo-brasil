// Testes dos comandos de LGPD: exportar-evento.js, apagar-evento.js e retencao.js.
// Rodam contra um DATA_DIR temporário criado no próprio teste; nunca tocam em data/ real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');
const { dadosExportaveis } = require('../src/lgpd/exportar');
const { configRetencao } = require('../src/lgpd/retencao');

const RAIZ = path.join(__dirname, '..');
const DIA = 86400000;
let DIR;

function evento(id, { criadoDias = 0, reveladoDias = null, futuroDias = 30 } = {}) {
  const agora = Date.now();
  return {
    id, hostToken: `tk-${id}`, titulo: `Evento ${id}`,
    revealAt: reveladoDias != null ? new Date(agora - reveladoDias * DIA).toISOString() : new Date(agora + futuroDias * DIA).toISOString(),
    createdAt: new Date(agora - criadoDias * DIA).toISOString(),
    fotosPorConvidado: 5, dataEvento: null, local: '', endereco: '', mensagem: '', contato: '',
    suspenso: false, limites: {}, config: { recadosAtivos: true, apenasLista: false, mostrarAutor: true },
    push: [], avisos: [], revealNotified: false, cronograma: [], lista: [], equipe: [], recados: [],
    guests: [{ id: 'g1', nome: 'Rafa', entrouEm: new Date().toISOString() }],
    photos: [{ id: 'p1', ext: 'jpg', guestId: 'g1', autor: 'Rafa', criadaEm: new Date().toISOString() }],
    denuncias: [], consentimentos: [{ guestId: 'g1', versao: 'v1', fotos: true, avisos: null, em: new Date().toISOString() }],
  };
}
function escreverDb(db) { fs.writeFileSync(path.join(DIR, 'db.json'), JSON.stringify(db)); }
function lerDb() { return JSON.parse(fs.readFileSync(path.join(DIR, 'db.json'), 'utf8')); }
const rodar = (script, args, env = {}) =>
  spawnSync(process.execPath, [path.join(RAIZ, 'scripts', script), ...args], { cwd: RAIZ, encoding: 'utf8', env: { ...process.env, DATA_DIR: DIR, ...env } });

test.beforeEach(() => {
  DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-lgpd-scr-'));
  for (const id of ['ev1', 'ev2']) {
    fs.mkdirSync(path.join(DIR, 'photos', id), { recursive: true });
    fs.writeFileSync(path.join(DIR, 'photos', id, 'p1.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]));
  }
  escreverDb({
    events: {
      ev1: evento('ev1', { criadoDias: 400, reveladoDias: 400 }), // vencido após a revelação
      ev2: evento('ev2', { criadoDias: 200, futuroDias: 30 }),    // nunca revelado e vencido
      ev3: evento('ev3', { criadoDias: 10, futuroDias: 30 }),     // fica
      ev4: evento('ev4', { criadoDias: 400, reveladoDias: 350 }), // fica (350 < 365)
    },
  });
});

test('exportar-evento gera zip com dados.json e fotos e não vaza tokens', () => {
  const saida = path.join(DIR, 'export', 'exp.zip');
  const r = rodar('exportar-evento.js', ['ev1', `--saida=${saida}`]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(saida));
  const buf = fs.readFileSync(saida);
  assert.equal(buf.slice(0, 2).toString(), 'PK');
  assert.ok(buf.includes(Buffer.from('dados.json')));
  assert.ok(buf.includes(Buffer.from('fotos/Rafa/001.jpg')));
  assert.ok(!buf.includes(Buffer.from('tk-ev1')), 'o hostToken não pode vazar no zip');
});

test('exportar-evento exige id existente', () => {
  const r = rodar('exportar-evento.js', ['inexistente', `--saida=${path.join(DIR, 'x.zip')}`]);
  assert.equal(r.status, 1);
  assert.ok(!fs.existsSync(path.join(DIR, 'x.zip')));
});

test('dadosExportaveis remove hostToken, token da equipe e inscrições push', () => {
  const ev = evento('evX');
  ev.equipe = [{ id: 'm1', nome: 'Carla', papel: 'cerimonial', token: 'segredo-da-equipe' }];
  ev.push = [{ id: 'q1', sub: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } } }];
  const dados = dadosExportaveis(ev, [{ id: 'p1', nome: 'fotos/Rafa/001.jpg' }]);
  const txt = JSON.stringify(dados);
  assert.ok(!txt.includes('tk-evX'));
  assert.ok(!txt.includes('segredo-da-equipe'));
  assert.ok(!txt.includes('push.example'));
  assert.ok(!/"push"/.test(txt));
  assert.equal(dados.photos[0].arquivo, 'fotos/Rafa/001.jpg');
});

test('apagar-evento nem roda sem --confirmar e exige o id certo', () => {
  let r = rodar('apagar-evento.js', ['ev1']);
  assert.equal(r.status, 2);
  r = rodar('apagar-evento.js', ['ev1', '--confirmar=ev2']);
  assert.equal(r.status, 2);
  assert.ok(lerDb().events.ev1, 'o evento não pode ser apagado');
  assert.ok(fs.existsSync(path.join(DIR, 'photos', 'ev1', 'p1.jpg')));
});

test('apagar-evento apaga em cascata (dados e arquivos) e audita sem PII', () => {
  const r = rodar('apagar-evento.js', ['ev1', '--confirmar=ev1']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(lerDb().events.ev1, undefined);
  assert.ok(lerDb().events.ev2, 'não pode tocar em outro evento');
  assert.ok(!fs.existsSync(path.join(DIR, 'photos', 'ev1')));
  const audit = fs.readFileSync(path.join(DIR, 'audit.log'), 'utf8');
  assert.ok(audit.includes('evento.excluido'));
  assert.ok(audit.includes('ev1'));
  assert.ok(!audit.includes('Rafa'), 'a auditoria não pode ter nome de convidado');
});

test('retencao.js é dry-run por padrão: lista os vencidos sem apagar', () => {
  const r = rodar('retencao.js', []);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('ev1'));
  assert.ok(r.stdout.includes('ev2'));
  assert.ok(!r.stdout.includes('ev3'));
  assert.ok(!r.stdout.includes('ev4'));
  assert.ok(r.stdout.includes('Dry-run'));
  assert.ok(lerDb().events.ev1 && lerDb().events.ev3);
  assert.ok(fs.existsSync(path.join(DIR, 'photos', 'ev1', 'p1.jpg')));
});

test('retencao.js --executar apaga só os vencidos e audita', () => {
  const r = rodar('retencao.js', ['--executar']);
  assert.equal(r.status, 0, r.stderr);
  const db = lerDb();
  assert.equal(db.events.ev1, undefined);
  assert.equal(db.events.ev2, undefined);
  assert.ok(db.events.ev3 && db.events.ev4);
  assert.ok(!fs.existsSync(path.join(DIR, 'photos', 'ev1')));
  const audit = fs.readFileSync(path.join(DIR, 'audit.log'), 'utf8');
  assert.ok(audit.includes('evento.expirado'));
  assert.ok(!audit.includes('Rafa'));
});

test('retencao.js respeita RETENCAO_DIAS_APOS_REVELACAO do ambiente', () => {
  const r = rodar('retencao.js', [], { RETENCAO_DIAS_APOS_REVELACAO: '500' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes('ev1'));
  assert.ok(!r.stdout.includes('ev4'));
  assert.ok(r.stdout.includes('ev2'));
});

test('configRetencao usa padrões 365/180 e aceita settings.json e ambiente', () => {
  assert.deepEqual(configRetencao(), { diasAposRevelacao: 365, diasSemRevelacao: 180 });
  assert.deepEqual(configRetencao({ settings: { retencaoDiasAposRevelacao: 730, retencaoDiasSemRevelacao: 90 } }),
    { diasAposRevelacao: 730, diasSemRevelacao: 90 });
  assert.equal(configRetencao({ settings: { retencaoDiasAposRevelacao: 730 }, env: { RETENCAO_DIAS_APOS_REVELACAO: '100' } }).diasAposRevelacao, 100);
});
