const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PHOTO_DIR = path.join(DATA_DIR, 'photos');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

fs.mkdirSync(PHOTO_DIR, { recursive: true });
const db = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  : { events: {} };

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
const newId = (n = 6) => crypto.randomBytes(n).toString('base64url');
const revealed = (ev) => Date.now() >= new Date(ev.revealAt).getTime();
const clean = (s, max) => String(s ?? '').trim().slice(0, max);

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
app.use(express.json({ limit: '100kb' }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
});

function getEvent(req, res, next) {
  const ev = db.events[req.params.id];
  if (!ev) return res.status(404).json({ erro: 'Evento não encontrado.' });
  req.ev = ev;
  next();
}
function hostOnly(req, res, next) {
  const token = req.get('x-host-token') || req.query.token;
  if (!token || token !== req.ev.hostToken) return res.status(403).json({ erro: 'Acesso restrito ao organizador.' });
  next();
}
function publicInfo(ev) {
  return {
    id: ev.id,
    titulo: ev.titulo,
    revealAt: ev.revealAt,
    revelado: revealed(ev),
    agora: new Date().toISOString(),
    fotosPorConvidado: ev.fotosPorConvidado,
    momentos: ev.photos.length,
    pessoas: ev.guests.length,
  };
}

// Criar evento (organizador, em nome dos noivos)
app.post('/api/events', (req, res) => {
  const titulo = clean(req.body.titulo, 80);
  const revealAt = new Date(req.body.revealAt);
  const fotosPorConvidado = Math.min(Math.max(parseInt(req.body.fotosPorConvidado, 10) || 20, 1), 100);
  if (!titulo) return res.status(400).json({ erro: 'Informe o nome do evento.' });
  if (isNaN(revealAt)) return res.status(400).json({ erro: 'Informe quando as fotos serão reveladas.' });
  const ev = {
    id: newId(5),
    hostToken: newId(16),
    titulo,
    revealAt: revealAt.toISOString(),
    fotosPorConvidado,
    createdAt: new Date().toISOString(),
    guests: [],
    photos: [],
  };
  db.events[ev.id] = ev;
  save();
  res.status(201).json({ id: ev.id, hostToken: ev.hostToken });
});

app.get('/api/events/:id', getEvent, (req, res) => res.json(publicInfo(req.ev)));

// Painel do organizador
app.get('/api/events/:id/host', getEvent, hostOnly, (req, res) => {
  const ev = req.ev;
  const porConvidado = ev.guests.map((g) => ({
    nome: g.nome,
    fotos: ev.photos.filter((p) => p.guestId === g.id).length,
  }));
  res.json({ ...publicInfo(ev), convidados: porConvidado, linkConvite: `${baseUrl(req)}/e/${ev.id}` });
});

app.patch('/api/events/:id', getEvent, hostOnly, (req, res) => {
  const d = new Date(req.body.revealAt);
  if (isNaN(d)) return res.status(400).json({ erro: 'Data inválida.' });
  req.ev.revealAt = d.toISOString();
  save();
  res.json(publicInfo(req.ev));
});

app.get('/api/events/:id/qr.png', getEvent, async (req, res) => {
  const png = await QRCode.toBuffer(`${baseUrl(req)}/e/${req.ev.id}`, { width: 640, margin: 2 });
  res.type('png').send(png);
});

// Convidados
app.post('/api/events/:id/guests', getEvent, (req, res) => {
  const nome = clean(req.body.nome, 40);
  if (!nome) return res.status(400).json({ erro: 'Diga seu nome para entrar.' });
  if (req.ev.guests.length >= 2000) return res.status(409).json({ erro: 'Evento lotado.' });
  const g = { id: newId(8), nome, entrouEm: new Date().toISOString() };
  req.ev.guests.push(g);
  save();
  res.status(201).json({ guestId: g.id, nome: g.nome });
});

// Fotos
app.post('/api/events/:id/photos', getEvent, upload.single('foto'), (req, res) => {
  const ev = req.ev;
  if (revealed(ev)) return res.status(409).json({ erro: 'O evento já terminou. As fotos foram reveladas.' });
  const guest = ev.guests.find((g) => g.id === req.body.guestId);
  if (!guest) return res.status(403).json({ erro: 'Entre no evento antes de fotografar.' });
  if (!req.file || !/^image\/(jpeg|png|webp)$/.test(req.file.mimetype))
    return res.status(400).json({ erro: 'Envie uma imagem JPEG, PNG ou WebP.' });
  const usadas = ev.photos.filter((p) => p.guestId === guest.id).length;
  if (usadas >= ev.fotosPorConvidado)
    return res.status(409).json({ erro: `Você já usou suas ${ev.fotosPorConvidado} fotos.` });
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
      ? { id: p.id, autor: p.autor, criadaEm: p.criadaEm, url: `/api/events/${ev.id}/photos/${p.id}/file` }
      : { id: p.id, bloqueada: true, minha: p.guestId === guestId }
  );
  res.json({ revelado: open, revealAt: ev.revealAt, agora: new Date().toISOString(), fotos: lista });
});

// O arquivo só sai depois da revelação: o bloqueio é do servidor, não da tela.
app.get('/api/events/:id/photos/:pid/file', getEvent, (req, res) => {
  if (!revealed(req.ev)) return res.status(403).json({ erro: 'Esta foto ainda não foi revelada.' });
  const p = req.ev.photos.find((x) => x.id === req.params.pid);
  if (!p) return res.status(404).end();
  res.sendFile(path.join(PHOTO_DIR, req.ev.id, `${p.id}.${p.ext}`));
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ erro: 'Foto muito grande (máx. 10 MB).' });
  console.error(err);
  res.status(500).json({ erro: 'Algo deu errado. Tente de novo.' });
});

// Páginas
const page = (f) => (req, res) => res.sendFile(path.join(__dirname, 'public', f));
app.get('/e/:id', page('convite.html'));
app.get('/e/:id/camera', page('camera.html'));
app.get('/e/:id/album', page('album.html'));
app.get('/painel/:id', page('painel.html'));
app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Memo Brasil em http://localhost:${PORT}`);
    if (lanIp()) console.log(`Na mesma rede Wi-Fi (celular): http://${lanIp()}:${PORT}`);
  });
}
module.exports = app;
