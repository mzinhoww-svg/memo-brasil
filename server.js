const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = process.env.PORT || 3210;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PHOTO_DIR = path.join(DATA_DIR, 'photos');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_GUESTS = 5000; // pessoas que entram com a câmera
const MAX_LISTA = 5000; // lista de convidados do casamento
const RSVP = ['pendente', 'confirmado', 'recusado'];

fs.mkdirSync(PHOTO_DIR, { recursive: true });
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : { events: {} };

// Eventos criados na primeira versão ganham os campos novos.
for (const ev of Object.values(db.events)) {
  Object.assign(ev, {
    dataEvento: ev.dataEvento || null, local: ev.local || '', endereco: ev.endereco || '',
    mensagem: ev.mensagem || '', cronograma: ev.cronograma || [], lista: ev.lista || [],
    equipe: ev.equipe || [], recados: ev.recados || [],
  });
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
const newId = (n = 6) => crypto.randomBytes(n).toString('base64url');
const revealed = (ev) => Date.now() >= new Date(ev.revealAt).getTime();
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
app.use(express.json({ limit: '1mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } });

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
  if (token && token === ev.hostToken) req.admin = { papel: 'casal', nome: 'Casal', dono: true };
  else {
    const m = token && ev.equipe.find((e) => e.token === token);
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
    agora: new Date().toISOString(), fotosPorConvidado: ev.fotosPorConvidado,
    momentos: ev.photos.length, pessoas: ev.guests.length,
    dataEvento: ev.dataEvento, local: ev.local, endereco: ev.endereco, mensagem: ev.mensagem,
    cronograma: ev.cronograma,
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
  const titulo = clean(req.body.titulo, 80);
  const revealAt = new Date(req.body.revealAt);
  const fotosPorConvidado = Math.min(Math.max(parseInt(req.body.fotosPorConvidado, 10) || 20, 1), 200);
  if (!titulo) return res.status(400).json({ erro: 'Informe o nome do evento.' });
  if (isNaN(revealAt)) return res.status(400).json({ erro: 'Informe quando as fotos serão reveladas.' });
  const dataEvento = req.body.dataEvento ? new Date(req.body.dataEvento) : null;
  const ev = {
    id: newId(5), hostToken: newId(16), titulo, revealAt: revealAt.toISOString(), fotosPorConvidado,
    dataEvento: dataEvento && !isNaN(dataEvento) ? dataEvento.toISOString() : null,
    local: clean(req.body.local, 80), endereco: clean(req.body.endereco, 160), mensagem: '',
    cronograma: [], lista: [], equipe: [], recados: [], guests: [], photos: [],
    createdAt: new Date().toISOString(),
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
    papel: req.admin.papel, nome: req.admin.nome, dono: !!req.admin.dono,
    linkConvite: `${base}/e/${ev.id}`,
    totalLista: ev.lista.length, rsvp,
    fotosPorPessoa: ev.guests.map((g) => ({ nome: g.nome, fotos: ev.photos.filter((p) => p.guestId === g.id).length })),
    recados: ev.recados.length,
    equipe: req.admin.dono
      ? ev.equipe.map((m) => ({ id: m.id, nome: m.nome, papel: m.papel, link: `${base}/painel/${ev.id}#t=${m.token}` }))
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
  if (b.fotosPorConvidado !== undefined)
    ev.fotosPorConvidado = Math.min(Math.max(parseInt(b.fotosPorConvidado, 10) || ev.fotosPorConvidado, 1), 200);
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
    if (ev.lista.length >= MAX_LISTA) return res.status(409).json({ erro: `Limite de ${MAX_LISTA} convidados na lista.` });
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
  const m = { id: newId(5), nome, papel, token: newId(16) };
  req.ev.equipe.push(m);
  save();
  res.status(201).json({ id: m.id, nome, papel, link: `${baseUrl(req)}/painel/${req.ev.id}#t=${m.token}` });
});
app.delete('/api/events/:id/equipe/:eid', getEvent, adminOnly, donoOnly, (req, res) => {
  req.ev.equipe = req.ev.equipe.filter((m) => m.id !== req.params.eid);
  save();
  res.json({ ok: true });
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
  fs.rmSync(path.join(PHOTO_DIR, req.ev.id, `${p.id}.${p.ext}`), { force: true });
  save();
  res.json({ ok: true });
});
app.delete('/api/events/:id/recados/:rid', getEvent, adminOnly, (req, res) => {
  req.ev.recados = req.ev.recados.filter((r) => r.id !== req.params.rid);
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
  if (ev.guests.length >= MAX_GUESTS) return res.status(409).json({ erro: 'Evento lotado.' });
  const item = ev.lista.find((l) => norm(l.nome) === norm(nome));
  const g = { id: newId(8), nome: item ? item.nome : nome, entrouEm: new Date().toISOString(), listaId: item?.id };
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
    if (ev.lista.length >= MAX_LISTA) return res.status(409).json({ erro: 'Lista cheia.' });
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
  const g = req.ev.guests.find((x) => x.id === req.body.guestId);
  if (!g) return res.status(403).json({ erro: 'Entre no evento primeiro.' });
  const texto = clean(req.body.texto, 400);
  if (!texto) return res.status(400).json({ erro: 'Escreva seu recado.' });
  const mine = req.ev.recados.filter((r) => r.guestId === g.id).length;
  if (mine >= 5) return res.status(409).json({ erro: 'Você já deixou 5 recados.' });
  const r = { id: newId(6), guestId: g.id, autor: g.nome, texto, criadoEm: new Date().toISOString() };
  req.ev.recados.push(r);
  save();
  res.status(201).json({ id: r.id });
});

// ───── Fotos
app.post('/api/events/:id/photos', getEvent, upload.single('foto'), (req, res) => {
  const ev = req.ev;
  if (revealed(ev)) return res.status(409).json({ erro: 'O evento já terminou. As fotos foram reveladas.' });
  const guest = ev.guests.find((g) => g.id === req.body.guestId);
  if (!guest) return res.status(403).json({ erro: 'Entre no evento antes de fotografar.' });
  if (!req.file || !/^image\/(jpeg|png|webp)$/.test(req.file.mimetype))
    return res.status(400).json({ erro: 'Envie uma imagem JPEG, PNG ou WebP.' });
  const usadas = ev.photos.filter((p) => p.guestId === guest.id).length;
  if (usadas >= ev.fotosPorConvidado) return res.status(409).json({ erro: `Você já usou suas ${ev.fotosPorConvidado} fotos.` });
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[req.file.mimetype];
  const id = newId(8);
  const dir = path.join(PHOTO_DIR, ev.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.${ext}`), req.file.buffer);
  ev.photos.push({ id, ext, guestId: guest.id, autor: guest.nome, criadaEm: new Date().toISOString() });
  save();
  res.status(201).json({ id, restantes: ev.fotosPorConvidado - usadas - 1 });
});

app.get('/api/events/:id/photos', getEvent, (req, res) => {
  const ev = req.ev;
  const open = revealed(ev);
  const guestId = req.query.guestId;
  const lista = ev.photos.map((p) =>
    open
      ? { id: p.id, autor: p.autor, criadaEm: p.criadaEm, minha: p.guestId === guestId, url: `/api/events/${ev.id}/photos/${p.id}/file` }
      : { id: p.id, bloqueada: true, minha: p.guestId === guestId }
  );
  res.json({ revelado: open, revealAt: ev.revealAt, agora: new Date().toISOString(), fotos: lista });
});

// O arquivo só sai depois da revelação — exceto para a organização (moderação).
app.get('/api/events/:id/photos/:pid/file', getEvent, (req, res) => {
  const token = req.get('x-host-token') || req.query.token;
  const org = token && (token === req.ev.hostToken || req.ev.equipe.some((m) => m.token === token));
  if (!revealed(req.ev) && !org) return res.status(403).json({ erro: 'Esta foto ainda não foi revelada.' });
  const p = req.ev.photos.find((x) => x.id === req.params.pid);
  if (!p) return res.status(404).end();
  res.sendFile(path.join(PHOTO_DIR, req.ev.id, `${p.id}.${p.ext}`));
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ erro: 'Foto muito grande (máx. 10 MB).' });
  console.error(err);
  res.status(500).json({ erro: 'Algo deu errado. Tente de novo.' });
});

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
app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Memo Brasil em http://localhost:${PORT}`);
    if (lanIp()) console.log(`Na mesma rede Wi-Fi (celular): http://${lanIp()}:${PORT}`);
  });
}
module.exports = app;
