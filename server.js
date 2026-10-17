const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const webpush = require('web-push');
const { ZipArchive } = require('archiver');
const { createLogger } = require('./src/obs/logger');
const { createHealthHandler } = require('./src/obs/health');
const { limFotosEvento } = require('./src/obs/limites');
const { createSentry } = require('./src/obs/sentry');
const { tokenHash, verifyToken } = require(path.join(__dirname, 'src', 'store', 'sqlite'));
// Relógio injetável: em produção é sempre o relógio real; TEST_NOW/advance só
// valem com NODE_ENV=test. Todo "agora" da revelação passa por aqui.
const clock = require('./src/clock');
const { criarEmail, emailDesativado } = require('./src/email');
const { processarRevelacoes } = require('./src/reveal/job');
const { montarRetrospectiva } = require('./src/reveal/retrospectiva');

// E-mail transacional (Brevo via SMTP em produção). Console só em dev/teste:
// em produção o provedor de console é recusado (fail-closed).
let email;
try {
  email = criarEmail();
} catch (e) {
  email = emailDesativado(e);
  console.error(`[email] envio de e-mail desativado: ${e.message}`);
}

const PORT = process.env.PORT || 3210;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PHOTO_DIR = path.join(DATA_DIR, 'photos');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_HARD_PHOTO_BYTES = 25 * 1024 * 1024; // teto técnico; o limite configurável fica em settings
// Retenção do hash de IP nos logs (política de privacidade).
const LOG_RETENCAO_DIAS = Math.max(1, parseInt(process.env.LOG_RETENCAO_DIAS, 10) || 30);
const RSVP = ['pendente', 'confirmado', 'recusado'];

fs.mkdirSync(PHOTO_DIR, { recursive: true });
const store = require(path.join(__dirname, 'src', 'store'))(DATA_DIR);
const db = store.db;
// Variáveis da plataforma, editáveis pelo admin master.
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DEFAULTS = {
  criacaoAberta: true, manutencao: false, avisoGlobal: '', pushAtivo: true,
  maxFotosPorConvidado: 200, maxConvidadosPorEvento: 5000, maxListaPorEvento: 5000,
  maxFotosPorEvento: 20000, tamanhoMaxFotoMB: 10, retencaoDiasAposRevelacao: 365,
};
let settings = { ...DEFAULTS };
try { if (fs.existsSync(SETTINGS_FILE)) settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }; } catch {}
const saveSettings = () => fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
const limGuests = (ev) => ev.limites?.maxConvidados ?? settings.maxConvidadosPorEvento;
const limLista = (ev) => ev.limites?.maxLista ?? settings.maxListaPorEvento;
const limFotos = (ev) => limFotosEvento(ev, settings);
const CONFIG_PADRAO = { recadosAtivos: true, apenasLista: false, mostrarAutor: true };

// Chaves VAPID para notificações push (geradas uma vez).
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
let vapid;
try { vapid = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8')); } catch {
  vapid = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapid), { mode: 0o600 });
}
webpush.setVapidDetails(process.env.VAPID_CONTACT || 'mailto:contato@memobrasil.app', vapid.publicKey, vapid.privateKey);

// Auditoria: só inserção.
const AUDIT_FILE = path.join(DATA_DIR, 'audit.log');
function audit(req, acao, detalhe = {}) {
  const quem = req.admin ? `${req.admin.papel}:${req.admin.nome}` : 'anon';
  const linha = JSON.stringify({ t: clock.iso(), quem, evento: req.ev?.id || detalhe.evento || null, acao, ...detalhe });
  fs.appendFile(AUDIT_FILE, linha + '\n', () => {});
}
const revealedAtBoot = (ev) => clock.nowMs() >= new Date(ev.revealAt).getTime();

// Admin master: administra todos os casamentos (tenants). Token por ambiente ou gerado no primeiro uso.
const MASTER_FILE = path.join(DATA_DIR, 'master.token');
let MASTER_TOKEN = process.env.MASTER_TOKEN || '';
let masterGerado = false;
if (!MASTER_TOKEN) {
  if (fs.existsSync(MASTER_FILE)) MASTER_TOKEN = fs.readFileSync(MASTER_FILE, 'utf8').trim();
  else {
    MASTER_TOKEN = crypto.randomBytes(24).toString('base64url');
    fs.writeFileSync(MASTER_FILE, MASTER_TOKEN, { mode: 0o600 });
    masterGerado = true;
  }
}
function isMaster(token) {
  if (!token || !MASTER_TOKEN) return false;
  const a = Buffer.from(String(token)), b = Buffer.from(MASTER_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function save() {
  store.save();
}
const newId = (n = 6) => crypto.randomBytes(n).toString('base64url');
const revealed = (ev) => clock.nowMs() >= new Date(ev.revealAt).getTime();
const clean = (s, max) => String(s ?? '').trim().slice(0, max);
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return null;
}
function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const host = req.get('host') || `localhost:${PORT}`;
  if (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) && lanIp()) return `http://${lanIp()}:${PORT}`;
  return `${req.protocol}://${host}`;
}

const app = express();
// Observabilidade: log estruturado por requisição (sem PII) e healthcheck.
const logger = createLogger();
const sentry = createSentry({ version: require('./package.json').version });
app.use(logger.middleware);
app.get('/healthz', createHealthHandler({ dataDir: DATA_DIR }));
app.use(express.json({ limit: '1mb' }));
// Modo manutenção: só o admin master passa.
app.use('/api', (req, res, next) => {
  if (!settings.manutencao) return next();
  const t = req.get('x-master-token') || req.get('x-host-token') || req.query.token;
  if (isMaster(t) || req.path.startsWith('/config')) return next();
  res.status(503).json({ erro: settings.avisoGlobal || 'O Lume está em manutenção. Volte em instantes.' });
});
app.get('/api/config', (req, res) => res.json({
  criacaoAberta: settings.criacaoAberta, manutencao: settings.manutencao, avisoGlobal: settings.avisoGlobal,
  pushAtivo: settings.pushAtivo, vapidPublicKey: vapid.publicKey, tamanhoMaxFotoMB: settings.tamanhoMaxFotoMB,
}));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_HARD_PHOTO_BYTES, files: 1 } });

function getEvent(req, res, next) {
  const ev = db.events[req.params.id];
  if (!ev) return res.status(404).json({ erro: 'Evento não encontrado.' });
  req.ev = ev;
  next();
}
// Organização do casamento: casal (dono) ou cerimonial (equipe). O convidado nunca passa por aqui.
function adminOnly(req, res, next) {
  const token = req.get('x-host-token') || req.query.token;
  const ev = req.ev;
  if (isMaster(token)) req.admin = { papel: 'master', nome: 'Admin master', dono: true, master: true };
  else if (token && verifyToken(token, ev.hostTokenHash)) req.admin = { papel: 'casal', nome: 'Casal', dono: true };
  else {
    const m = token && ev.equipe.find((e) => verifyToken(token, e.tokenHash));
    if (m) req.admin = { papel: m.papel, nome: m.nome, id: m.id };
  }
  if (!req.admin) return res.status(403).json({ erro: 'Acesso restrito à organização do casamento.' });
  next();
}
const donoOnly = (req, res, next) =>
  req.admin.dono ? next() : res.status(403).json({ erro: 'Só o casal pode fazer isso.' });

function publicInfo(ev) {
  return {
    id: ev.id, titulo: ev.titulo, revealAt: ev.revealAt, revelado: revealed(ev),
    agora: clock.iso(), fotosPorConvidado: ev.fotosPorConvidado,
    momentos: ev.photos.length, pessoas: ev.guests.length,
    dataEvento: ev.dataEvento, local: ev.local, endereco: ev.endereco, mensagem: ev.mensagem,
    cronograma: ev.cronograma, suspenso: !!ev.suspenso, config: ev.config,
  };
}
function parseCronograma(arr) {
  if (!Array.isArray(arr)) return null;
  return arr.slice(0, 60).map((c) => ({
    hora: clean(c.hora, 8), titulo: clean(c.titulo, 80), descricao: clean(c.descricao, 200),
  })).filter((c) => c.titulo);
}

// ───── Criar evento (organização, em nome dos noivos)
app.post('/api/events', (req, res) => {
  if (!settings.criacaoAberta) return res.status(403).json({ erro: 'O cadastro de novos casamentos está fechado no momento.' });
  const titulo = clean(req.body.titulo, 80);
  const revealAt = new Date(req.body.revealAt);
  const fotosPorConvidado = Math.min(Math.max(parseInt(req.body.fotosPorConvidado, 10) || 20, 1), settings.maxFotosPorConvidado);
  if (!titulo) return res.status(400).json({ erro: 'Informe o nome do evento.' });
  if (isNaN(revealAt)) return res.status(400).json({ erro: 'Informe quando as fotos serão reveladas.' });
  const dataEvento = req.body.dataEvento ? new Date(req.body.dataEvento) : null;
  const hostToken = newId(16);
  const ev = {
    id: newId(5), hostToken, hostTokenHash: tokenHash(hostToken), titulo, revealAt: revealAt.toISOString(), fotosPorConvidado,
    dataEvento: dataEvento && !isNaN(dataEvento) ? dataEvento.toISOString() : null,
    local: clean(req.body.local, 80), endereco: clean(req.body.endereco, 160), mensagem: '',
    contato: clean(req.body.contato, 80), suspenso: false, limites: {}, config: { ...CONFIG_PADRAO },
    push: [], avisos: [], revealNotified: false, emailEnviado: false, contatoVerificado: false,
    cronograma: [], lista: [], equipe: [], recados: [], guests: [], photos: [],
    createdAt: clock.iso(),
  };
  db.events[ev.id] = ev;
  save();
  res.status(201).json({ id: ev.id, hostToken: ev.hostToken });
});

app.get('/api/events/:id', getEvent, (req, res) => res.json(publicInfo(req.ev)));

// ───── Organização
app.get('/api/events/:id/host', getEvent, adminOnly, (req, res) => {
  const ev = req.ev;
  const rsvp = { confirmado: 0, recusado: 0, pendente: 0, pessoasConfirmadas: 0 };
  for (const l of ev.lista) {
    rsvp[l.rsvp]++;
    if (l.rsvp === 'confirmado') rsvp.pessoasConfirmadas += 1 + (l.acompanhantes || 0);
  }
  const base = baseUrl(req);
  res.json({
    ...publicInfo(ev),
    papel: req.admin.papel, nome: req.admin.nome, dono: !!req.admin.dono, master: !!req.admin.master,
    contato: req.admin.master ? req.ev.contato : undefined,
    contatoVerificado: !!req.ev.contatoVerificado,
    linkConvite: `${base}/e/${ev.id}`,
    totalLista: ev.lista.length, rsvp, pushInscritos: ev.push.length,
    limitesEfetivos: { maxConvidados: limGuests(ev), maxLista: limLista(ev), maxFotos: limFotos(ev) },
    fotosPorPessoa: ev.guests.map((g) => ({ nome: g.nome, fotos: ev.photos.filter((p) => p.guestId === g.id).length })),
    recados: ev.recados.length,
    equipe: req.admin.dono
      ? ev.equipe.map((m) => ({
          id: m.id, nome: m.nome, papel: m.papel, linkEmitido: true,
          // O token em claro só existe na criação (logo após o POST). Depois de
          // um reinício o store carrega apenas o hash, então não há link para exibir.
          link: m.token ? `${base}/painel/${ev.id}#t=${m.token}` : null,
        }))
      : undefined,
  });
});

app.patch('/api/events/:id', getEvent, adminOnly, (req, res) => {
  const ev = req.ev, b = req.body;
  if (b.revealAt !== undefined) {
    const d = new Date(b.revealAt);
    if (isNaN(d)) return res.status(400).json({ erro: 'Data de revelação inválida.' });
    ev.revealAt = d.toISOString();
  }
  if (b.titulo !== undefined) ev.titulo = clean(b.titulo, 80) || ev.titulo;
  if (b.dataEvento !== undefined) {
    const d = b.dataEvento ? new Date(b.dataEvento) : null;
    ev.dataEvento = d && !isNaN(d) ? d.toISOString() : null;
  }
  if (b.local !== undefined) ev.local = clean(b.local, 80);
  if (b.endereco !== undefined) ev.endereco = clean(b.endereco, 160);
  if (b.mensagem !== undefined) ev.mensagem = clean(b.mensagem, 500);
  // Trocar o contato derruba a verificação: o e-mail de revelação só sai para
  // endereço verificado, então um endereço novo precisa ser confirmado de novo.
  if (b.contato !== undefined && clean(b.contato, 80) !== ev.contato) {
    ev.contato = clean(b.contato, 80);
    ev.contatoVerificado = false;
  }
  if (b.fotosPorConvidado !== undefined)
    ev.fotosPorConvidado = Math.min(Math.max(parseInt(b.fotosPorConvidado, 10) || ev.fotosPorConvidado, 1), settings.maxFotosPorConvidado);
  if (b.config && typeof b.config === 'object') {
    for (const k of Object.keys(CONFIG_PADRAO)) if (typeof b.config[k] === 'boolean') ev.config[k] = b.config[k];
    audit(req, 'config.alterada', { config: ev.config });
  }
  if (b.cronograma !== undefined) {
    const c = parseCronograma(b.cronograma);
    if (!c) return res.status(400).json({ erro: 'Programação inválida.' });
    ev.cronograma = c;
  }
  save();
  res.json(publicInfo(ev));
});

app.get('/api/events/:id/qr.png', getEvent, async (req, res) => {
  const png = await QRCode.toBuffer(`${baseUrl(req)}/e/${req.ev.id}`, { width: 800, margin: 2 });
  res.type('png').send(png);
});

// Lista de convidados do casamento (RSVP) — separada de quem usa a câmera.
app.get('/api/events/:id/lista', getEvent, adminOnly, (req, res) => {
  const ev = req.ev;
  const naCamera = new Set(ev.guests.map((g) => g.listaId).filter(Boolean));
  res.json({ itens: ev.lista.map((l) => ({ ...l, naCamera: naCamera.has(l.id) })) });
});
app.post('/api/events/:id/lista', getEvent, adminOnly, (req, res) => {
  const ev = req.ev;
  // Aceita lista colada (uma pessoa por linha: "Nome; grupo; acompanhantes") ou itens em JSON.
  let itens = req.body.itens;
  if (!itens && typeof req.body.texto === 'string') {
    itens = req.body.texto.split(/\r?\n/).map((linha) => {
      const [nome, grupo, ac] = linha.split(/[;\t]/).map((s) => s.trim());
      return { nome, grupo, acompanhantes: ac };
    });
  }
  if (!Array.isArray(itens)) return res.status(400).json({ erro: 'Envie a lista de convidados.' });
  const existentes = new Set(ev.lista.map((l) => norm(l.nome)));
  let adicionados = 0, repetidos = 0;
  for (const it of itens) {
    const nome = clean(it.nome, 60);
    if (!nome) continue;
    if (existentes.has(norm(nome))) { repetidos++; continue; }
    if (ev.lista.length >= limLista(ev)) return res.status(409).json({ erro: `Limite de ${limLista(ev)} convidados na lista.` });
    ev.lista.push({
      id: newId(6), nome, grupo: clean(it.grupo, 40),
      acompanhantes: Math.min(Math.max(parseInt(it.acompanhantes, 10) || 0, 0), 10),
      rsvp: 'pendente', origem: 'organizacao',
    });
    existentes.add(norm(nome));
    adicionados++;
  }
  save();
  res.status(201).json({ adicionados, repetidos, total: ev.lista.length });
});
app.patch('/api/events/:id/lista/:lid', getEvent, adminOnly, (req, res) => {
  const l = req.ev.lista.find((x) => x.id === req.params.lid);
  if (!l) return res.status(404).json({ erro: 'Convidado não encontrado.' });
  const b = req.body;
  if (b.rsvp !== undefined) { if (!RSVP.includes(b.rsvp)) return res.status(400).json({ erro: 'Status inválido.' }); l.rsvp = b.rsvp; }
  if (b.nome !== undefined) l.nome = clean(b.nome, 60) || l.nome;
  if (b.grupo !== undefined) l.grupo = clean(b.grupo, 40);
  if (b.acompanhantes !== undefined) l.acompanhantes = Math.min(Math.max(parseInt(b.acompanhantes, 10) || 0, 0), 10);
  save();
  res.json(l);
});
app.delete('/api/events/:id/lista/:lid', getEvent, adminOnly, (req, res) => {
  const i = req.ev.lista.findIndex((x) => x.id === req.params.lid);
  if (i < 0) return res.status(404).json({ erro: 'Convidado não encontrado.' });
  req.ev.lista.splice(i, 1);
  req.ev.guests.forEach((g) => { if (g.listaId === req.params.lid) delete g.listaId; });
  save();
  res.json({ ok: true });
});

// Equipe (casal convida cerimonial ou outro membro do casal)
app.post('/api/events/:id/equipe', getEvent, adminOnly, donoOnly, (req, res) => {
  const nome = clean(req.body.nome, 40);
  const papel = req.body.papel === 'casal' ? 'casal' : 'cerimonial';
  if (!nome) return res.status(400).json({ erro: 'Informe o nome.' });
  if (req.ev.equipe.length >= 20) return res.status(409).json({ erro: 'Equipe cheia.' });
  const token = newId(16);
  const m = { id: newId(5), nome, papel, token, tokenHash: tokenHash(token) };
  req.ev.equipe.push(m);
  audit(req, 'equipe.convidada', { membro: m.id, papel });
  save();
  res.status(201).json({ id: m.id, nome, papel, link: `${baseUrl(req)}/painel/${req.ev.id}#t=${m.token}` });
});
app.delete('/api/events/:id/equipe/:eid', getEvent, adminOnly, donoOnly, (req, res) => {
  req.ev.equipe = req.ev.equipe.filter((m) => m.id !== req.params.eid);
  audit(req, 'equipe.removida', { membro: req.params.eid });
  save();
  res.json({ ok: true });
});
// Rotaciona o link de um membro da equipe (o token em claro é irrecuperável).
app.post('/api/events/:id/equipe/:eid/rotacionar-link', getEvent, adminOnly, donoOnly, (req, res) => {
  const m = req.ev.equipe.find((x) => x.id === req.params.eid);
  if (!m) return res.status(404).json({ erro: 'Membro não encontrado.' });
  const token = newId(16);
  m.token = token;
  m.tokenHash = tokenHash(token);
  audit(req, 'equipe.link.rotacionado', { membro: m.id });
  save();
  res.json({ id: m.id, link: `${baseUrl(req)}/painel/${req.ev.id}#t=${token}` });
});

// Moderação (organização vê as fotos antes da revelação só aqui, e de propósito)
app.get('/api/events/:id/moderacao', getEvent, adminOnly, (req, res) => {
  const ev = req.ev;
  res.json({
    fotos: ev.photos.map((p) => ({
      id: p.id, autor: p.autor, criadaEm: p.criadaEm,
      url: `/api/events/${ev.id}/photos/${p.id}/file`,
    })),
    recados: ev.recados,
  });
});
app.delete('/api/events/:id/photos/:pid', getEvent, adminOnly, (req, res) => {
  const i = req.ev.photos.findIndex((p) => p.id === req.params.pid);
  if (i < 0) return res.status(404).json({ erro: 'Foto não encontrada.' });
  const [p] = req.ev.photos.splice(i, 1);
  audit(req, 'foto.apagada', { foto: p.id });
  fs.rmSync(path.join(PHOTO_DIR, req.ev.id, `${p.id}.${p.ext}`), { force: true });
  save();
  res.json({ ok: true });
});
app.delete('/api/events/:id/recados/:rid', getEvent, adminOnly, (req, res) => {
  req.ev.recados = req.ev.recados.filter((r) => r.id !== req.params.rid);
  audit(req, 'recado.apagado', { recado: req.params.rid });
  save();
  res.json({ ok: true });
});

// ───── Convidado
app.get('/api/events/:id/buscar', getEvent, (req, res) => {
  const q = norm(req.query.q || '');
  if (q.length < 3) return res.json({ nomes: [] });
  const nomes = req.ev.lista.filter((l) => norm(l.nome).includes(q)).slice(0, 6).map((l) => l.nome);
  res.json({ nomes });
});

app.post('/api/events/:id/guests', getEvent, (req, res) => {
  const ev = req.ev;
  const nome = clean(req.body.nome, 40);
  if (!nome) return res.status(400).json({ erro: 'Diga seu nome para entrar.' });
  if (ev.suspenso) return res.status(403).json({ erro: 'Este evento está temporariamente indisponível.' });
  if (ev.guests.length >= limGuests(ev)) return res.status(409).json({ erro: 'Evento lotado.' });
  if (ev.config.apenasLista && !ev.lista.some((l) => norm(l.nome) === norm(nome)))
    return res.status(403).json({ erro: 'Este evento é só para convidados da lista. Use o nome exatamente como os noivos cadastraram.' });
  const item = ev.lista.find((l) => norm(l.nome) === norm(nome));
  const g = { id: newId(8), nome: item ? item.nome : nome, entrouEm: clock.iso(), listaId: item?.id };
  ev.guests.push(g);
  save();
  res.status(201).json({ guestId: g.id, nome: g.nome, naLista: !!item, rsvp: item?.rsvp || null });
});

app.get('/api/events/:id/guests/:gid', getEvent, (req, res) => {
  const g = req.ev.guests.find((x) => x.id === req.params.gid);
  if (!g) return res.status(404).json({ erro: 'Convidado não encontrado.' });
  const item = g.listaId && req.ev.lista.find((l) => l.id === g.listaId);
  const usadas = req.ev.photos.filter((p) => p.guestId === g.id).length;
  res.json({
    nome: g.nome, rsvp: item?.rsvp || null, acompanhantes: item?.acompanhantes || 0,
    fotosUsadas: usadas, fotosRestantes: Math.max(0, req.ev.fotosPorConvidado - usadas),
  });
});

app.post('/api/events/:id/rsvp', getEvent, (req, res) => {
  const ev = req.ev;
  const g = ev.guests.find((x) => x.id === req.body.guestId);
  if (!g) return res.status(403).json({ erro: 'Entre no evento primeiro.' });
  if (!['confirmado', 'recusado'].includes(req.body.status)) return res.status(400).json({ erro: 'Resposta inválida.' });
  let item = g.listaId && ev.lista.find((l) => l.id === g.listaId);
  if (!item) {
    if (ev.lista.length >= limLista(ev)) return res.status(409).json({ erro: 'Lista cheia.' });
    item = { id: newId(6), nome: g.nome, grupo: '', acompanhantes: 0, rsvp: 'pendente', origem: 'convidado' };
    ev.lista.push(item);
    g.listaId = item.id;
  }
  item.rsvp = req.body.status;
  item.acompanhantes = Math.min(Math.max(parseInt(req.body.acompanhantes, 10) || 0, 0), 10);
  save();
  res.json({ rsvp: item.rsvp, acompanhantes: item.acompanhantes });
});

app.get('/api/events/:id/recados', getEvent, (req, res) => {
  res.json({ recados: req.ev.recados.slice(-200).reverse().map((r) => ({ id: r.id, autor: r.autor, texto: r.texto, criadoEm: r.criadoEm })) });
});
app.post('/api/events/:id/recados', getEvent, (req, res) => {
  if (!req.ev.config.recadosAtivos) return res.status(403).json({ erro: 'Os recados estão desativados neste evento.' });
  const g = req.ev.guests.find((x) => x.id === req.body.guestId);
  if (!g) return res.status(403).json({ erro: 'Entre no evento primeiro.' });
  const texto = clean(req.body.texto, 400);
  if (!texto) return res.status(400).json({ erro: 'Escreva seu recado.' });
  const mine = req.ev.recados.filter((r) => r.guestId === g.id).length;
  if (mine >= 5) return res.status(409).json({ erro: 'Você já deixou 5 recados.' });
  const r = { id: newId(6), guestId: g.id, autor: g.nome, texto, criadoEm: clock.iso() };
  req.ev.recados.push(r);
  save();
  res.status(201).json({ id: r.id });
});

// ───── Fotos
app.post('/api/events/:id/photos', getEvent, upload.single('foto'), (req, res) => {
  const ev = req.ev;
  if (ev.suspenso) return res.status(403).json({ erro: 'Este evento está temporariamente indisponível.' });
  if (revealed(ev)) return res.status(409).json({ erro: 'O evento já terminou. As fotos foram reveladas.' });
  const guest = ev.guests.find((g) => g.id === req.body.guestId);
  if (!guest) return res.status(403).json({ erro: 'Entre no evento antes de fotografar.' });
  if (req.file && req.file.size > settings.tamanhoMaxFotoMB * 1024 * 1024)
    return res.status(413).json({ erro: `Foto muito grande (máx. ${settings.tamanhoMaxFotoMB} MB).` });
  if (ev.photos.length >= limFotos(ev)) return res.status(413).json({ erro: 'Este evento atingiu o teto de fotos. Não é possível enviar mais fotos.' });
  if (!req.file || !/^image\/(jpeg|png|webp)$/.test(req.file.mimetype))
    return res.status(400).json({ erro: 'Envie uma imagem JPEG, PNG ou WebP.' });
  const usadas = ev.photos.filter((p) => p.guestId === guest.id).length;
  if (usadas >= ev.fotosPorConvidado) return res.status(409).json({ erro: `Você já usou suas ${ev.fotosPorConvidado} fotos.` });
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[req.file.mimetype];
  const id = newId(8);
  const dir = path.join(PHOTO_DIR, ev.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.${ext}`), req.file.buffer);
  ev.photos.push({ id, ext, guestId: guest.id, autor: guest.nome, criadaEm: clock.iso() });
  save();
  res.status(201).json({ id, restantes: ev.fotosPorConvidado - usadas - 1 });
});

app.get('/api/events/:id/photos', getEvent, (req, res) => {
  const ev = req.ev;
  const open = revealed(ev);
  const guestId = req.query.guestId;
  const lista = ev.photos.map((p) =>
    open
      ? { id: p.id, autor: ev.config.mostrarAutor ? p.autor : '', criadaEm: p.criadaEm, minha: p.guestId === guestId, url: `/api/events/${ev.id}/photos/${p.id}/file` }
      : { id: p.id, bloqueada: true, minha: p.guestId === guestId }
  );
  res.json({ revelado: open, revealAt: ev.revealAt, agora: clock.iso(), fotos: lista });
});

// Retrospectiva do casamento: só abre depois da revelação e só olha o próprio evento.
app.get('/api/events/:id/retrospectiva', getEvent, (req, res) => {
  if (!revealed(req.ev)) return res.status(403).json({ erro: 'A retrospectiva abre quando o álbum for revelado.' });
  res.json(montarRetrospectiva(req.ev));
});

// O arquivo só sai depois da revelação — exceto para a organização (moderação).
app.get('/api/events/:id/photos/:pid/file', getEvent, (req, res) => {
  const token = req.get('x-host-token') || req.query.token;
  const org = isMaster(token) || (token && (verifyToken(token, req.ev.hostTokenHash) || req.ev.equipe.some((m) => verifyToken(token, m.tokenHash))));
  if (!revealed(req.ev) && !org) return res.status(403).json({ erro: 'Esta foto ainda não foi revelada.' });
  const p = req.ev.photos.find((x) => x.id === req.params.pid);
  if (!p) return res.status(404).end();
  res.sendFile(path.join(PHOTO_DIR, req.ev.id, `${p.id}.${p.ext}`));
});

app.use((err, req, res, next) => {
  // Corpo JSON malformado: responde 400, padroniza a mensagem e NUNCA loga/ecoa o corpo.
  if (err.type === 'entity.parse.failed') {
    sentry.captureException(err); // mensagem filtrada em src/obs/sentry.js (sem corpo)
    return res.status(400).json({ erro: 'Corpo da requisição inválido.' });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Conteúdo grande demais.' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ erro: `Foto muito grande (máx. ${settings.tamanhoMaxFotoMB} MB).` });
  sentry.captureException(err); // no-op se SENTRY_DSN não estiver definido
  console.error(err);
  res.status(500).json({ erro: 'Algo deu errado. Tente de novo.' });
});

// ───── Admin master (todos os casamentos)
function masterOnly(req, res, next) {
  if (!isMaster(req.get('x-master-token') || req.get('x-host-token') || req.query.token))
    return res.status(403).json({ erro: 'Acesso restrito ao administrador do Lume.' });
  req.admin = { papel: 'master', nome: 'Admin master', master: true, dono: true };
  next();
}
const resumoEvento = (ev) => ({
  id: ev.id, titulo: ev.titulo, contato: ev.contato || '', criadoEm: ev.createdAt,
  dataEvento: ev.dataEvento, revealAt: ev.revealAt, revelado: revealed(ev), suspenso: !!ev.suspenso,
  fotos: ev.photos.length, camera: ev.guests.length, lista: ev.lista.length, recados: ev.recados.length,
  confirmados: ev.lista.filter((l) => l.rsvp === 'confirmado').length, equipe: ev.equipe.length,
  push: ev.push.length, avisos: ev.avisos.length, limites: ev.limites, config: ev.config,
  // Estado do aviso de revelação: o operador usa isso para liberar um reenvio manual.
  email: {
    enviado: !!ev.emailEnviado, enviadoEm: ev.emailEnviadoEm || null, incerto: !!ev.emailIncerto,
    tentativas: Number(ev.emailTentativas) || 0, erro: ev.emailErro || null, contatoVerificado: !!ev.contatoVerificado,
  },
  limitesEfetivos: { maxConvidados: limGuests(ev), maxLista: limLista(ev), maxFotos: limFotos(ev) },
  bytes: dirSize(path.join(PHOTO_DIR, ev.id)),
});
function dirSize(d) {
  try { return fs.readdirSync(d).reduce((t, f) => t + fs.statSync(path.join(d, f)).size, 0); } catch { return 0; }
}
app.get('/api/master/ping', masterOnly, (req, res) => res.json({ ok: true }));
app.get('/api/master/events', masterOnly, (req, res) => {
  const eventos = Object.values(db.events).map(resumoEvento).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const tot = eventos.reduce((t, e) => ({ eventos: t.eventos + 1, fotos: t.fotos + e.fotos, camera: t.camera + e.camera, lista: t.lista + e.lista }), { eventos: 0, fotos: 0, camera: 0, lista: 0 });
  res.json({ totais: tot, eventos });
});
app.patch('/api/master/events/:id', masterOnly, getEvent, (req, res) => {
  const b = req.body;
  if (b.suspenso !== undefined) { req.ev.suspenso = !!b.suspenso; audit(req, b.suspenso ? 'evento.suspenso' : 'evento.reativado'); }
  if (b.limites && typeof b.limites === 'object') {
    for (const k of ['maxConvidados', 'maxLista', 'maxFotos']) {
      if (b.limites[k] === null || b.limites[k] === '') delete req.ev.limites[k];
      else if (b.limites[k] !== undefined) req.ev.limites[k] = Math.min(Math.max(parseInt(b.limites[k], 10) || 1, 1), 100000);
    }
    audit(req, 'limites.alterados', { limites: req.ev.limites });
  }
  if (b.config && typeof b.config === 'object') {
    for (const k of Object.keys(CONFIG_PADRAO)) if (typeof b.config[k] === 'boolean') req.ev.config[k] = b.config[k];
    audit(req, 'config.alterada', { config: req.ev.config });
  }
  // O operador confirma (ou revoga) o endereço que pode receber o e-mail de revelação.
  if (b.contatoVerificado !== undefined) {
    req.ev.contatoVerificado = !!b.contatoVerificado;
    audit(req, 'contato.verificacao', { contatoVerificado: req.ev.contatoVerificado });
  }
  // Reenvio manual do aviso de revelação: libera um ciclo novo quando o envio ficou
  // incerto (timeout) ou quando o endereço só foi confirmado depois das tentativas.
  if (b.reenviarRevelacao) {
    req.ev.emailIncerto = false;
    req.ev.emailTentativas = 0;
    req.ev.emailErro = null;
    req.ev.emailEnviado = false;
    audit(req, 'revelacao.reenvio-liberado', { contatoVerificado: !!req.ev.contatoVerificado });
  }
  if (b.revealAt) { const d = new Date(b.revealAt); if (!isNaN(d)) { req.ev.revealAt = d.toISOString(); req.ev.revealNotified = revealed(req.ev); audit(req, 'revelacao.alterada', { revealAt: req.ev.revealAt }); } }
  save();
  res.json(resumoEvento(req.ev));
});
app.delete('/api/master/events/:id', masterOnly, getEvent, (req, res) => {
  if (req.body?.confirmar !== req.ev.id) return res.status(400).json({ erro: 'Confirme enviando o id do evento.' });
  audit(req, 'evento.excluido', { evento: req.ev.id });
  store.deleteEvent(req.ev.id);
  res.json({ ok: true });
});
// Fotos mais recentes de todos os casamentos, antes de qualquer revelação.
app.get('/api/master/photos', masterOnly, (req, res) => {
  const lim = Math.min(parseInt(req.query.limit, 10) || 60, 300);
  const todas = [];
  for (const ev of Object.values(db.events))
    for (const p of ev.photos) todas.push({ id: p.id, eventoId: ev.id, evento: ev.titulo, autor: p.autor, criadaEm: p.criadaEm, url: `/api/events/${ev.id}/photos/${p.id}/file` });
  todas.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  res.json({ fotos: todas.slice(0, lim), total: todas.length });
});

// ───── PWA e notificações push
const subscriptionOk = (s) => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys && s.keys.p256dh && s.keys.auth;
app.post('/api/events/:id/push/subscribe', getEvent, (req, res) => {
  if (!settings.pushAtivo) return res.status(403).json({ erro: 'Notificações desativadas na plataforma.' });
  const g = req.ev.guests.find((x) => x.id === req.body.guestId);
  if (!g) return res.status(403).json({ erro: 'Entre no evento primeiro.' });
  const sub = req.body.subscription;
  if (!subscriptionOk(sub)) return res.status(400).json({ erro: 'Inscrição inválida.' });
  if (req.ev.push.length >= 6000) return res.status(409).json({ erro: 'Limite de notificações atingido.' });
  const i = req.ev.push.findIndex((p) => p.sub.endpoint === sub.endpoint);
  const reg = { id: newId(6), guestId: g.id, sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, criadoEm: clock.iso() };
  if (i >= 0) req.ev.push[i] = { ...reg, id: req.ev.push[i].id }; else req.ev.push.push(reg);
  save();
  res.status(201).json({ ok: true });
});
app.post('/api/events/:id/push/unsubscribe', getEvent, (req, res) => {
  req.ev.push = req.ev.push.filter((p) => p.sub.endpoint !== req.body.endpoint);
  save();
  res.json({ ok: true });
});
async function enviarPush(ev, { titulo, corpo, url }) {
  const payload = JSON.stringify({ titulo, corpo, url: url || `/e/${ev.id}/inicio` });
  let entregues = 0, falhas = 0;
  const vivos = [];
  await Promise.all(ev.push.map(async (p) => {
    try { await webpush.sendNotification(p.sub, payload, { TTL: 86400 }); entregues++; vivos.push(p); }
    catch (e) { falhas++; if (![404, 410].includes(e.statusCode)) vivos.push(p); }
  }));
  ev.push = vivos;
  return { alvos: entregues + falhas, entregues, falhas };
}
app.get('/api/events/:id/avisos', getEvent, (req, res) => {
  res.json({ avisos: ev_avisos(req.ev) });
});
const ev_avisos = (ev) => ev.avisos.slice(-20).reverse().map((a) => ({ id: a.id, titulo: a.titulo, corpo: a.corpo, enviadoEm: a.enviadoEm }));
app.post('/api/events/:id/avisos', getEvent, adminOnly, async (req, res) => {
  const ev = req.ev;
  const titulo = clean(req.body.titulo, 60), corpo = clean(req.body.corpo, 200);
  if (!titulo || !corpo) return res.status(400).json({ erro: 'Escreva o título e a mensagem do aviso.' });
  const recentes = ev.avisos.filter((a) => clock.nowMs() - new Date(a.enviadoEm).getTime() < 3600e3).length;
  if (recentes >= 5 && !req.admin.master) return res.status(429).json({ erro: 'Limite de 5 avisos por hora. Tente mais tarde.' });
  const aviso = { id: newId(5), titulo, corpo, enviadoEm: clock.iso(), por: req.admin.nome };
  const r = settings.pushAtivo ? await enviarPush(ev, { titulo, corpo }) : { alvos: 0, entregues: 0, falhas: 0 };
  ev.avisos.push({ ...aviso, ...r });
  audit(req, 'aviso.enviado', { titulo, ...r });
  save();
  res.status(201).json({ ...r });
});

// Revelação automática (relógio do servidor): e-mail à organização + push a quem instalou o app.
// O job tem trava (um ciclo por vez) e timeout por envio; grava o estado no evento
// (revealNotified/emailEnviado), então repetir o ciclo ou reiniciar não duplica.
const urlPublica = () => (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
// Endereços liberados manualmente pelo operador (lista separada por vírgula) enquanto
// a confirmação por link mágico (#9) não chega; o resto depende de contatoVerificado.
const destinosVerificados = () =>
  String(process.env.EMAIL_VERIFICADOS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const processarAgora = () =>
  processarRevelacoes({
    eventos: db.events,
    agora: clock.now,
    email,
    baseUrl: urlPublica(),
    pushEnviar: (ev, payload) =>
      settings.pushAtivo && !ev.suspenso ? enviarPush(ev, payload) : Promise.resolve({ alvos: 0, entregues: 0, falhas: 0 }),
    persistir: save,
    novoId: newId,
    log: (m) => console.error(m),
    timeoutMs: Number(process.env.EMAIL_TIMEOUT_MS) || undefined,
    verificados: destinosVerificados(),
  }).catch((e) => console.error(`[revelacao] falhou: ${e.message}`));

setInterval(processarAgora, 30000).unref();
app.processarRevelacoes = processarAgora; // gancho de teste (o ciclo normal roda a cada 30s)
app.emailParaTestes = email;


app.get('/e/:id/manifest.webmanifest', getEvent, (req, res) => {
  const ev = req.ev;
  res.type('application/manifest+json').json({
    name: ev.titulo, short_name: ev.titulo.slice(0, 12), lang: 'pt-BR', id: `/e/${ev.id}/`,
    start_url: `/e/${ev.id}/inicio`, scope: `/e/${ev.id}/`, display: 'standalone',
    background_color: '#14110E', theme_color: '#14110E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
});

// ───── Exportações da organização
app.get('/api/events/:id/lista.csv', getEvent, adminOnly, (req, res) => {
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
  const linhas = [['Nome', 'Grupo', 'Acompanhantes', 'Resposta'].map(cel).join(',')];
  req.ev.lista.forEach((l) => linhas.push([l.nome, l.grupo, l.acompanhantes, l.rsvp].map(cel).join(',')));
  audit(req, 'lista.exportada', { total: req.ev.lista.length });
  res.type('text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="convidados.csv"').send('﻿' + linhas.join('\r\n'));
});
app.get('/api/events/:id/fotos.zip', getEvent, adminOnly, (req, res) => {
  const ev = req.ev;
  if (!revealed(ev) && !req.admin.master) return res.status(409).json({ erro: 'O álbum só pode ser baixado depois da revelação.' });
  audit(req, 'fotos.baixadas', { total: ev.photos.length });
  res.type('application/zip').set('Content-Disposition', `attachment; filename="album-${ev.id}.zip"`);
  const z = new ZipArchive({ store: true });
  z.on('error', () => res.end());
  z.pipe(res);
  const n = {};
  for (const p of ev.photos) {
    const dono = (ev.guests.find((g) => g.id === p.guestId)?.nome || p.autor || 'convidado').replace(/[\\/:*?"<>|]/g, '_');
    n[dono] = (n[dono] || 0) + 1;
    z.file(path.join(PHOTO_DIR, ev.id, `${p.id}.${p.ext}`), { name: `${dono}/${String(n[dono]).padStart(3, '0')}.${p.ext}` });
  }
  z.finalize();
});

// ───── Master: variáveis da plataforma, auditoria e políticas
app.get('/api/master/settings', masterOnly, (req, res) => res.json({ settings, padroes: DEFAULTS }));
app.put('/api/master/settings', masterOnly, (req, res) => {
  const b = req.body || {};
  const mudou = {};
  for (const [k, def] of Object.entries(DEFAULTS)) {
    if (b[k] === undefined) continue;
    let v = b[k];
    if (typeof def === 'boolean') v = !!v;
    else if (typeof def === 'number') { v = parseInt(v, 10); if (!Number.isFinite(v) || v < 1) continue; v = Math.min(v, 1e6); }
    else v = clean(v, 200);
    if (settings[k] !== v) { mudou[k] = { de: settings[k], para: v }; settings[k] = v; }
  }
  saveSettings();
  audit(req, 'plataforma.alterada', { mudou });
  res.json({ settings });
});
app.get('/api/master/audit', masterOnly, (req, res) => {
  const lim = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  let linhas = [];
  try { linhas = fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n').filter(Boolean).slice(-lim).reverse().map((l) => JSON.parse(l)); } catch {}
  res.json({ registros: linhas });
});
app.post('/api/master/events/:id/rotacionar-link', masterOnly, getEvent, (req, res) => {
  const hostToken = newId(16);
  req.ev.hostToken = hostToken;
  req.ev.hostTokenHash = tokenHash(hostToken);
  audit(req, 'link.casal.rotacionado');
  save();
  res.json({ link: `${baseUrl(req)}/painel/${req.ev.id}#t=${hostToken}` });
});
app.post('/api/master/avisos', masterOnly, async (req, res) => {
  const titulo = clean(req.body.titulo, 60), corpo = clean(req.body.corpo, 200);
  if (!titulo || !corpo) return res.status(400).json({ erro: 'Escreva título e mensagem.' });
  let alvos = 0, entregues = 0;
  for (const ev of Object.values(db.events)) {
    if (ev.suspenso || !ev.push.length) continue;
    const r = await enviarPush(ev, { titulo, corpo });
    alvos += r.alvos; entregues += r.entregues;
  }
  save();
  audit(req, 'aviso.global', { titulo, alvos, entregues });
  res.json({ alvos, entregues });
});
// Quem pode o quê. Hoje a regra vive no servidor; ao migrar para Postgres, vira RLS de verdade.
app.get('/api/master/politicas', masterOnly, (req, res) => res.json({
  isolamento: 'Cada casamento (tenant) tem dados, fotos e links próprios. Nenhuma rota devolve dados de um casamento com o token de outro.',
  papeis: [
    { papel: 'Convidado', acessa: 'Só o próprio casamento, pelo QR Code. Vê as fotos depois da revelação e as próprias já enviadas contam como "minhas".', nao: 'Não vê lista de convidados, e-mails nem fotos antes da revelação.' },
    { papel: 'Cerimonial', acessa: 'Painel do próprio casamento: lista, programação, avisos, moderação, exportações.', nao: 'Não altera equipe nem outros casamentos.' },
    { papel: 'Casal', acessa: 'Tudo do próprio casamento, inclusive equipe e configurações.', nao: 'Não vê outros casamentos nem variáveis da plataforma.' },
    { papel: 'Admin master', acessa: 'Todos os casamentos, fotos antes da revelação, limites, suspensão, exclusão, variáveis da plataforma, auditoria.', nao: 'Toda ação sensível fica registrada na auditoria.' },
  ],
  rls: 'Ainda não há banco relacional: o isolamento é imposto pelo servidor (middleware). Ao migrar para Postgres/Supabase, estas regras viram políticas RLS por tenant_id.',
  operadorExterior: 'O operador da plataforma fica no exterior: dados pessoais (nome, e-mail da organização, recados e fotos) podem ser transferidos para fora do Brasil (LGPD, arts. 33 a 36) para hospedagem, envio de e-mail transacional e suporte, com cláusulas contratuais e acesso restrito a quem precisa.',
  emailRevelacao: 'O e-mail de revelação vai somente para endereço verificado da organização (contatoVerificado ou lista EMAIL_VERIFICADOS do operador). Endereço não verificado não recebe nada.',
  logs: 'O servidor registra uma linha JSON por requisição sem dado pessoal (sem e-mail, nome, token nem texto de recado). O IP nunca é guardado em claro: só um hash curto e não reversível (com sal por processo), usado apenas para segurança e rate limit.',
  retencaoLogs: `O hash de IP dos logs é retido por até ${LOG_RETENCAO_DIAS} dias (LOG_RETENCAO_DIAS) e depois descartado; por si só não permite reidentificar a pessoa.`,
}));

// ───── Páginas
const page = (f) => (req, res) => res.sendFile(path.join(__dirname, 'public', f));
app.get('/e/:id', page('convite.html'));
app.get('/e/:id/inicio', page('inicio.html'));
app.get('/e/:id/camera', page('camera.html'));
app.get('/e/:id/album', page('album.html'));
app.get('/e/:id/programacao', page('programacao.html'));
app.get('/e/:id/recados', page('recados.html'));
app.get('/e/:id/presenca', page('presenca.html'));
app.get('/painel/:id', page('painel.html'));
app.get('/master', page('master.html'));
app.get('/sw.js', (req, res) => res.set('Service-Worker-Allowed', '/').type('application/javascript').sendFile(path.join(__dirname, 'public', 'sw.js')));
app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  sentry.installProcessHooks(); // só com SENTRY_DSN; caso contrário, no-op
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lume em http://localhost:${PORT}`);
    console.log(masterGerado ? `Token do admin master gerado em ${MASTER_FILE}` : process.env.MASTER_TOKEN ? 'Admin master: token vindo de MASTER_TOKEN' : `Admin master: token em ${MASTER_FILE}`);
    console.log(`Admin master: http://localhost:${PORT}/master`);
    if (lanIp()) console.log(`Na mesma rede Wi-Fi (celular): http://${lanIp()}:${PORT}`);
  });
}
module.exports = app;
