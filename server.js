const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const webpush = require('web-push');
const { ZipArchive } = require('archiver');
const { tokenHash, verifyToken } = require(path.join(__dirname, 'src', 'store', 'sqlite'));

const PORT = process.env.PORT || 3210;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PHOTO_DIR = path.join(DATA_DIR, 'photos');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_HARD_PHOTO_BYTES = 25 * 1024 * 1024; // teto técnico; o limite configurável fica em settings
const RSVP = ['pendente', 'confirmado', 'recusado'];

fs.mkdirSync(PHOTO_DIR, { recursive: true });
const store = require(path.join(__dirname, 'src', 'store'))(DATA_DIR);
const db = store.db;

// ───── Autenticação (magic link, sessão por cookie, master com senha+TOTP)
const SESSION_COOKIE = 'memo_sid';
const MASTER_COOKIE = 'memo_m';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias (rolante)
const SESSION_ABSOLUTE_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias teto
const MASTER_SESSION_TTL_MS = 30 * 60 * 1000; // 30 min ocioso
const MASTER_SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000; // 8 h
const MAGIC_TTL_MS = 15 * 60 * 1000;
const isProd = !!process.env.PUBLIC_URL && /^https:\/\//i.test(process.env.PUBLIC_URL);

function parseCookies(req) {
  const out = {};
  const raw = req.get && req.get('cookie');
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

function normEmail(s) {
  return String(s || '').trim().toLowerCase();
}

function emailHashCurto(s) { return crypto.createHash('sha256').update(normEmail(s)).digest('hex').slice(0, 16); }

function hashToken(raw) { return crypto.createHash('sha256').update(String(raw)).digest('hex'); }

async function scryptHash(plain) {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(String(plain), salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  return `scrypt$131072$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
async function scryptVerify(plain, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 6) return false;
  const N = parseInt(parts[1], 10), r = parseInt(parts[2], 10), p = parseInt(parts[3], 10);
  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  let actual;
  try { actual = await scryptAsync(String(plain), salt, expected.length, { N, r, p, maxmem: 256 * 1024 * 1024 }); } catch { return false; }
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

// base32 (RFC 4648)
function base32Encode(buf) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += '=';
  return out;
}
function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const s = String(str).replace(/=+$/g, '').toUpperCase().replace(/\s/g, '');
  let bits = 0, value = 0, out = Buffer.alloc(0);
  const bytes = [];
  for (const c of s) {
    const idx = alphabet.indexOf(c);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// TOTP RFC 6238
function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}
function totpNow(secretBuf) { return hotp(secretBuf, Math.floor(Date.now() / 30000)); }
function totpVerify(secretBuf, code, lastStep) {
  const step = Math.floor(Date.now() / 30000);
  const clean = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return { ok: false, step: null };
  for (let w = -1; w <= 1; w++) {
    const s = step + w;
    if (s <= (lastStep || 0)) continue; // anti-replay
    if (hotp(secretBuf, s) === clean) return { ok: true, step: s };
  }
  return { ok: false, step: null };
}

function totpSecretNew() { return base32Encode(crypto.randomBytes(20)); }
function otpauthUrl(secret, conta, emissor = 'Memo Brasil') {
  return `otpauth://totp/${encodeURIComponent(emissor)}:${encodeURIComponent(conta)}?secret=${secret}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=6&period=30`;
}

// Recuperação: hashes scrypt de strings aleatórias
async function genRecoveryCodes(n = 10) {
  const codes = [];
  const hashes = [];
  for (let i = 0; i < n; i++) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
    codes.push(code);
    hashes.push(await scryptHash(code));
  }
  return { codes, hashes };
}

// Rate limiter simples em memória
const rl = new Map();
function rateLimit(key, max, windowMs) {
  pruneRateLimit(rl, windowMs * 2);
  const now = Date.now();
  const entry = rl.get(key);
  if (!entry || now > entry.resetAt) {
    rl.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetAt: now + windowMs };
  }
  if (entry.count >= max) return { ok: false, remaining: 0, resetAt: entry.resetAt };
  entry.count++;
  return { ok: true, remaining: max - entry.count, resetAt: entry.resetAt };
}
function rlKey(req, suffix) {
  const ip = (req.ip || req.connection?.remoteAddress || 'unknown');
  return `${suffix}:${ip}`;
}

function clientIp(req) { return req.ip || req.connection?.remoteAddress || ''; }
function ipHash(req) { return crypto.createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 16); }
function pruneRateLimit(map, maxAgeMs) {
  const now = Date.now();
  for (const [k, v] of map.entries()) { if (v.resetAt + maxAgeMs < now) map.delete(k); }
}

// Sessões
function criarSessaoOrganizador(organizadorId, req) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const idHash = hashToken(raw);
  const now = new Date().toISOString();
  const expiraAbs = new Date(Date.now() + SESSION_ABSOLUTE_MS).toISOString();
  const expiraIdle = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  store.run(`INSERT INTO sessoes (id_hash, organizador_id, criada_em, ultimo_uso_em, expira_em, expira_absoluta_em, ua_resumo, revogada) VALUES (?,?,?,?,?,?,?,0)`,
    idHash, organizadorId, now, now, expiraIdle, expiraAbs, String(req.get('user-agent') || '').slice(0, 120));
  return raw;
}
function getSessaoOrganizador(req) {
  const cookies = parseCookies(req);
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return null;
  const idHash = hashToken(raw);
  const row = store.get(`SELECT * FROM sessoes WHERE id_hash = ?`, idHash);
  if (!row || row.revogada) return null;
  const now = Date.now();
  if (now >= new Date(row.expira_em).getTime() || now >= new Date(row.expira_absoluta_em).getTime()) return null;
  // rolante
  const novoExpiraIdle = new Date(Math.min(new Date(row.expira_absoluta_em).getTime(), now + SESSION_TTL_MS)).toISOString();
  store.run(`UPDATE sessoes SET ultimo_uso_em = ?, expira_em = ? WHERE id_hash = ?`, new Date().toISOString(), novoExpiraIdle, idHash);
  return row;
}
function organizadorDaSessao(req) {
  const s = getSessaoOrganizador(req);
  if (!s) return null;
  return store.get(`SELECT * FROM organizadores WHERE id = ?`, s.organizador_id);
}
function revogarSessao(req) {
  const cookies = parseCookies(req);
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return;
  store.run(`UPDATE sessoes SET revogada = 1 WHERE id_hash = ?`, hashToken(raw));
}

function criarSessaoMaster(masterId, req) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const idHash = hashToken(raw);
  const now = new Date().toISOString();
  const expiraIdle = new Date(Date.now() + MASTER_SESSION_TTL_MS).toISOString();
  const expiraAbs = new Date(Date.now() + MASTER_SESSION_ABSOLUTE_MS).toISOString();
  store.run(`INSERT INTO master_sessoes (id_hash, master_id, criada_em, ultimo_uso_em, expira_em, expira_absoluta_em, ua_resumo, revogada) VALUES (?,?,?,?,?,?,?,0)`,
    idHash, masterId, now, now, expiraIdle, expiraAbs, String(req.get('user-agent') || '').slice(0, 120));
  return raw;
}
function getMasterSessao(req) {
  const cookies = parseCookies(req);
  const raw = cookies[MASTER_COOKIE];
  if (!raw) return null;
  const idHash = hashToken(raw);
  const row = store.get(`SELECT * FROM master_sessoes WHERE id_hash = ?`, idHash);
  if (!row || row.revogada) return null;
  const now = Date.now();
  if (now >= new Date(row.expira_em).getTime() || now >= new Date(row.expira_absoluta_em).getTime()) return null;
  const novoIdle = new Date(Math.min(new Date(row.expira_absoluta_em).getTime(), now + MASTER_SESSION_TTL_MS)).toISOString();
  store.run(`UPDATE master_sessoes SET ultimo_uso_em = ?, expira_em = ? WHERE id_hash = ?`, new Date().toISOString(), novoIdle, idHash);
  return row;
}
function masterDaSessao(req) {
  const s = getMasterSessao(req);
  if (!s) return null;
  return store.get(`SELECT * FROM master_accounts WHERE id = ? AND ativo = 1`, s.master_id);
}

function setCookie(res, name, value, maxAgeMs, strict) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'HttpOnly', 'Path=/', `Max-Age=${Math.floor(maxAgeMs / 1000)}`, 'SameSite=' + (strict ? 'Strict' : 'Lax')];
  if (isProd) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
function clearCookie(res, name) {
  res.append('Set-Cookie', `${name}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function auditDb(req, atorTipo, atorId, eventoId, acao, alvo, detalhe, resultado) {
  try {
    const prev = store.get(`SELECT hash_atual FROM auditoria ORDER BY id DESC LIMIT 1`);
    const prevHash = prev ? prev.hash_atual : '';
    const corpo = JSON.stringify({ t: new Date().toISOString(), atorTipo, atorId, eventoId, acao, alvo, detalhe, resultado, prevHash });
    const hashAtual = crypto.createHash('sha256').update(corpo).digest('hex');
    store.run(`INSERT INTO auditoria (quando, ator_tipo, ator_id, evento_id, acao, alvo, detalhe, ip_hash, resultado, hash_anterior, hash_atual) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      new Date().toISOString(), atorTipo, atorId || null, eventoId || null, acao, alvo || null,
      JSON.stringify(detalhe || {}), ipHash(req), resultado || 'ok', prevHash, hashAtual);
  } catch (e) { console.error('audit db fail', e.message); }
}

// Audit unificado: arquivo legível + banco encadeado (só inserção).
const AUDIT_FILE = path.join(DATA_DIR, 'audit.log');
function audit(req, acao, detalhe = {}) {
  const quem = req.admin ? `${req.admin.papel}:${req.admin.nome}` : 'anon';
  const linha = JSON.stringify({ t: new Date().toISOString(), quem, evento: req.ev?.id || detalhe.evento || null, acao, ...detalhe });
  fs.appendFile(AUDIT_FILE, linha + '\n', () => {});
  const org = organizadorDaSessao(req);
  const m = masterDaSessao(req);
  let atorTipo = 'anon', atorId = null;
  if (req.admin?.master || m) { atorTipo = 'master'; atorId = m?.id || req.admin?.id || null; }
  else if (req.admin?.papel) { atorTipo = req.admin.papel; atorId = req.admin.id || null; }
  else if (org) { atorTipo = 'organizador'; atorId = org.id; }
  const eventoId = req.ev?.id || detalhe.evento || null;
  auditDb(req, atorTipo, atorId, eventoId, acao, detalhe.alvo || null, detalhe, detalhe.resultado || 'ok');
}

// Rate limit criação de eventos
const rlCriacao = new Map();
function rateLimitCriacao(req) {
  pruneRateLimit(rlCriacao, 30 * 60 * 1000);
  const ip = clientIp(req);
  const now = Date.now();
  const janela = 15 * 60 * 1000;
  let e = rlCriacao.get(ip);
  if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + janela }; rlCriacao.set(ip, e); }
  const maxIp = 20;
  if (e.count >= maxIp) return { ok: false, retry: e.resetAt };
  e.count++;
  return { ok: true };
}
const rlLogin = new Map();
function rateLimitLogin(key, max, windowMs) {
  pruneRateLimit(rlLogin, windowMs * 2);
  const now = Date.now();
  let e = rlLogin.get(key);
  if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + windowMs }; rlLogin.set(key, e); }
  if (e.count >= max) return { ok: false, retry: e.resetAt };
  e.count++;
  return { ok: true };
}

// Bootstrap master se ambiente configurar
// Segredo cifrado em repouso (opcional, se MASTER_TOTP_KEY)
function cipherSecret(s) {
  if (!process.env.MASTER_TOTP_KEY) return s;
  const key = crypto.createHash('sha256').update(process.env.MASTER_TOTP_KEY).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = cipher.update(String(s), 'utf8', 'base64') + cipher.final('base64');
  const tag = cipher.getAuthTag();
  return `enc$${iv.toString('base64')}$${tag.toString('base64')}$${enc}`;
}
function decipherSecret(s) {
  if (typeof s !== 'string' || !s.startsWith('enc$')) return s;
  if (!process.env.MASTER_TOTP_KEY) return s;
  const parts = s.split('$');
  if (parts.length !== 4) return s;
  const key = crypto.createHash('sha256').update(process.env.MASTER_TOTP_KEY).digest();
  try {
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(parts[3], 'base64', 'utf8') + decipher.final('utf8');
  } catch { return s; }
}

async function ensureMasterBootstrap() {
  const email = process.env.MASTER_BOOTSTRAP_EMAIL || process.env.MASTER_EMAIL;
  const nome = process.env.MASTER_BOOTSTRAP_NOME || process.env.MASTER_NOME || 'Admin master';
  const senha = process.env.MASTER_BOOTSTRAP_SENHA || process.env.MASTER_PASSWORD || process.env.MASTER_PASSWORD_BOOTSTRAP;
  if (!email || !senha) return;
  const erro = validarSenhaForte(senha);
  if (erro) { console.error('Bootstrap master:', erro); process.exit(1); }
  const norm = normEmail(email);
  let m = store.get(`SELECT id FROM master_accounts WHERE email_norm = ?`, norm);
  if (m) return;
  const secret = process.env.MASTER_BOOTSTRAP_TOTP_SECRET || process.env.MASTER_TOTP_SECRET || totpSecretNew();
  const { hashes } = await genRecoveryCodes(10);
  const id = newId(8);
  store.run(`INSERT INTO master_accounts (id,email,email_norm,nome,senha_hash,totp_secret,totp_ultimo_passo,recuperacao_hashes,ativo,criado_em,falhas) VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
    id, email, norm, nome, await scryptHash(senha), cipherSecret(secret), 0, JSON.stringify(hashes), 1, new Date().toISOString());
  console.log(`Master bootstrap criado: ${email}`);
  if (isProd) return;
  if (!process.env.MASTER_BOOTSTRAP_TOTP_SECRET && !process.env.MASTER_TOTP_SECRET) {
    console.log(`TOTP secret (guarde): ${secret}`);
    console.log(`otpauth: ${otpauthUrl(secret, email)}`);
  }
}

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
const limFotos = (ev) => ev.limites?.maxFotos ?? settings.maxFotosPorEvento;
const CONFIG_PADRAO = { recadosAtivos: true, apenasLista: false, mostrarAutor: true };

// Chaves VAPID para notificações push (geradas uma vez).
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
let vapid;
try { vapid = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8')); } catch {
  vapid = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapid), { mode: 0o600 });
}
webpush.setVapidDetails(process.env.VAPID_CONTACT || 'mailto:contato@memobrasil.app', vapid.publicKey, vapid.privateKey);

const revealedAtBoot = (ev) => Date.now() >= new Date(ev.revealAt).getTime();
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

// ───── Token master estático (legado) ─────
// Vale só enquanto não existir conta master, ou pela válvula de emergência
// (MASTER_EMERGENCY/MASTER_TOKEN_COMPAT) — que nunca vale com PUBLIC_URL https e
// fica registrada na auditoria a cada uso. Nunca aceito por query string.
function masterCount() { return (store.get(`SELECT COUNT(*) AS c FROM master_accounts`).c || 0); }
function emergenciaAtiva() {
  if (isProd) return false; // PUBLIC_URL https: a válvula fica desligada
  return process.env.MASTER_EMERGENCY === '1' || process.env.MASTER_TOKEN_COMPAT === '1';
}
// Retorna 'bootstrap' (sem conta master), 'emergencia' (válvula) ou null (recusado).
function aceitaTokenEstatico(token) {
  if (!isMaster(token)) return null;
  if (masterCount() === 0) return 'bootstrap';
  if (emergenciaAtiva()) return 'emergencia';
  return null;
}

function save() {
  store.save();
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

const util = require('util');
const scryptAsync = util.promisify(crypto.scrypt);

const app = express();
// TRUST_PROXY: número de saltos de proxy confiáveis (padrão 0 — sem proxy na frente).
// Com 0, req.ip é o socket e um X-Forwarded-For forjado pelo cliente é ignorado.
const TRUST_PROXY_RAW = process.env.TRUST_PROXY;
const TRUST_PROXY = TRUST_PROXY_RAW === undefined || TRUST_PROXY_RAW === ''
  ? 0
  : (/^\d+$/.test(TRUST_PROXY_RAW) ? parseInt(TRUST_PROXY_RAW, 10) : TRUST_PROXY_RAW);
app.set('trust proxy', TRUST_PROXY);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
// Modo manutenção: só o admin master passa.
app.use('/api', (req, res, next) => {
  if (!settings.manutencao) return next();
  const t = req.get('x-master-token') || req.get('x-host-token');
  if (req.path.startsWith('/config') || masterDaSessao(req) || aceitaTokenEstatico(t)) return next();
  res.status(503).json({ erro: settings.avisoGlobal || 'O Memo está em manutenção. Volte em instantes.' });
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
  // Sessão master.
  const ms = masterDaSessao(req);
  if (ms) {
    const m = store.get(`SELECT * FROM master_accounts WHERE id = ? AND ativo = 1`, ms.master_id);
    if (m) { req.admin = { papel: 'master', nome: m.nome, dono: true, master: true, id: m.id }; return next(); }
  }
  // Sessão do organizador com vínculo ao evento.
  const org = organizadorDaSessao(req);
  if (org) {
    const membro = store.get(`SELECT * FROM organizador_membros WHERE organizador_id = ? AND evento_id = ?`, org.id, ev.id);
    if (membro) {
      req.admin = { papel: membro.papel, nome: org.email, dono: membro.papel === 'casal', id: org.id, organizadorId: org.id, master: false };
      return next();
    }
  }
  // Tokens legados do evento (hostToken / equipe) só valem por hash — nunca em texto puro.
  if (token && verifyToken(token, ev.hostTokenHash)) {
    req.admin = { papel: 'casal', nome: 'Casal', dono: true };
  } else if (token) {
    const m = ev.equipe.find((e) => verifyToken(token, e.tokenHash));
    if (m) req.admin = { papel: m.papel, nome: m.nome, id: m.id };
  }
  // Transição: token master estático só vale sem conta master ou com a válvula de emergência.
  const modoEstatico = aceitaTokenEstatico(req.get('x-master-token') || req.get('x-host-token'));
  if (!req.admin && modoEstatico) {
    if (modoEstatico === 'emergencia') auditDb(req, 'master', null, ev.id, 'master.token_emergencia', 'adminOnly', {}, 'ok');
    req.admin = { papel: 'master', nome: 'Admin master (legado)', dono: true, master: true };
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
    cronograma: ev.cronograma, suspenso: !!ev.suspenso, config: ev.config,
  };
}
function parseCronograma(arr) {
  if (!Array.isArray(arr)) return null;
  return arr.slice(0, 60).map((c) => ({
    hora: clean(c.hora, 8), titulo: clean(c.titulo, 80), descricao: clean(c.descricao, 200),
  })).filter((c) => c.titulo);
}

// ───── Ficha pública do evento (jornada do convidado)
// Sem token, sem lista e sem fotos bloqueadas: só o que as telas do convidado usam.
app.get('/api/events/:id', getEvent, (req, res) => res.json(publicInfo(req.ev)));

// ───── Criar evento (organização, em nome dos noivos)
app.post('/api/events', (req, res) => {
  // Rate limit por IP na criação (camada anti-spam). Configurável via variável se necessário.
  const rl = rateLimitCriacao(req);
  if (!rl.ok) {
    res.set('Retry-After', Math.ceil((rl.retry - Date.now()) / 1000));
    return res.status(429).json({ erro: 'Muitas criações de evento em pouco tempo. Tente mais tarde.' });
  }
  // por conta: se sessão de organizador presente, limita 3/dia
  const org = organizadorDaSessao(req);
  if (org) {
    const k = `criacao:org:${org.id}`;
    const r2 = rateLimit(k, 3, 24 * 60 * 60 * 1000);
    if (!r2.ok) {
      res.set('Retry-After', Math.ceil((r2.resetAt - Date.now()) / 1000));
      return res.status(429).json({ erro: 'Você já criou eventos demais hoje. Tente amanhã.' });
    }
  }
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
    push: [], avisos: [], revealNotified: false,
    cronograma: [], lista: [], equipe: [], recados: [], guests: [], photos: [],
    createdAt: new Date().toISOString(),
  };
  db.events[ev.id] = ev;
  save();
  // Vincula o evento à conta do organizador autenticado (se houver).
  if (org) {
    const membroId = newId(6);
    const existe = store.get(`SELECT id FROM organizador_membros WHERE organizador_id = ? AND evento_id = ?`, org.id, ev.id);
    if (!existe) store.run(`INSERT INTO organizador_membros (id, organizador_id, evento_id, papel, criado_em) VALUES (?,?,?,?,?)`, membroId, org.id, ev.id, 'casal', new Date().toISOString());
  }
  res.status(201).json({ id: ev.id, hostToken: ev.hostToken });
});

// ───── Autenticação organizador (magic link + sessão cookie)
function magicLinkEnviar(email, tokenRaw, baseUrlStr) {
  if (isProd) return; // nunca imprime link em produção
  const link = `${baseUrlStr}/api/auth/entrar?t=${encodeURIComponent(tokenRaw)}`;
  const provider = process.env.EMAIL_PROVIDER || 'console';
  if (provider === 'console' || !process.env.EMAIL_API_KEY) {
    console.log(`[email:dev] magic link para ${emailHashCurto(email)}: ${link}`);
    try { fs.appendFileSync(path.join(DATA_DIR, 'auth.log'), `${new Date().toISOString()} ${emailHashCurto(email)} ${link}\n`); } catch {}
    return;
  }
}
function magicTokenNovo(emailNorm, tipo, orgId, eventId, papel, expiraMs) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const hash = hashToken(raw);
  store.run(`INSERT INTO magic_tokens (token_hash, email_norm, organizador_id, evento_id, papel, tipo, criado_em, expira_em, usado_em) VALUES (?,?,?,?,?,?,?,?,NULL)`,
    hash, emailNorm, orgId || null, eventId || null, papel || null, tipo, new Date().toISOString(),
    new Date(Date.now() + (expiraMs || MAGIC_TTL_MS)).toISOString());
  return raw;
}
function consumirMagicToken(raw) {
  if (!raw) return null;
  const h = hashToken(raw);
  const row = store.get(`SELECT * FROM magic_tokens WHERE token_hash = ?`, h);
  if (!row) return null;
  if (row.cancelado) return null;
  if (row.usado_em) return { reusado: true, row };
  if (Date.now() >= new Date(row.expira_em).getTime()) return { expirado: true, row };
  const agora = new Date().toISOString();
  const result = store.run(`UPDATE magic_tokens SET usado_em = ? WHERE token_hash = ? AND usado_em IS NULL`, agora, h);
  if (!result.changes) return { reusado: true, row };
  return { ok: true, row };
}

async function handleLinkRequest(req, res) {
  // Só POST JSON; rota pública nunca aceita eventoId/papel (evita escalada).
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const rlim = rateLimit(rlKey(req, 'magiclink'), 10, 60 * 60 * 1000);
  if (!rlim.ok) {
    res.set('Retry-After', Math.ceil((rlim.resetAt - Date.now()) / 1000));
    return res.status(429).json({ erro: 'Muitas solicitações. Tente mais tarde.' });
  }
  const email = normEmail(req.body?.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(202).json({ ok: true, mensagem: 'Se o e-mail for válido, enviamos um link de acesso.' });
  }
  const emailN = normEmail(email);
  // rate limit por e-mail (silencioso)
  const rl2 = rateLimit(`magiclink:email:${emailN}`, 5, 60 * 60 * 1000);
  if (!rl2.ok) {
    return res.status(202).json({ ok: true, mensagem: 'Se o e-mail for válido, enviamos um link de acesso.' });
  }
  // Não cria organizador nem vínculo aqui; isso só ocorre no consumo.
  const tokenRaw = magicTokenNovo(emailN, 'login', null, null, null, MAGIC_TTL_MS);
  magicLinkEnviar(email, tokenRaw, baseUrl(req));
  return res.status(202).json({ ok: true, mensagem: 'Se o e-mail for válido, enviamos um link de acesso.' });
}
app.post('/api/auth/link', handleLinkRequest);

const htmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Página intermediária com botão (POST) para evitar pré-fetch por scanner.
app.get('/api/auth/entrar', (req, res) => {
  const t = req.query.t || '';
  res.set('Referrer-Policy', 'no-referrer').type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Entrar — Memo Brasil</title>
  <style>body{font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#f7f5f2;color:#1a1a1a}form{background:#fff;padding:2rem;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center;max-width:360px}button{margin-top:1rem;padding:.8rem 1.6rem;border:0;border-radius:10px;background:#1a1a1a;color:#fff;font-size:1rem;cursor:pointer}</style>
  </head><body><form method="POST" action="/api/auth/entrar"><input type="hidden" name="token" value="${htmlEsc(t)}">
  <h1>Entrar no Memo</h1><p>Clique para confirmar seu acesso.</p><button type="submit">Entrar</button></form></body></html>`);
});
async function handleEntrarConsumo(req, res) {
  const token = req.body?.token || req.body?.t || req.query?.token || req.query?.t;
  const r = consumirMagicToken(token);
  if (!r) return res.status(400).json({ erro: 'Link inválido.' });
  if (r.reusado) return res.status(410).json({ erro: 'Este link já foi usado.' });
  if (r.expirado) return res.status(410).json({ erro: 'Este link expirou. Peça um novo.' });
  const row = r.row;
  let org = row.organizador_id ? store.get(`SELECT * FROM organizadores WHERE id = ?`, row.organizador_id) : null;
  if (!org) {
    const emailN = row.email_norm;
    let existing = store.get(`SELECT * FROM organizadores WHERE email_norm = ?`, emailN);
    if (!existing) {
      const id = newId(8);
      store.run(`INSERT INTO organizadores (id,email,email_norm,criado_em,consentimento_em,consentimento_versao) VALUES (?,?,?,?,?,?)`,
        id, row.email_norm, emailN, new Date().toISOString(), new Date().toISOString(), '1');
      existing = store.get(`SELECT * FROM organizadores WHERE id = ?`, id);
    }
    org = existing;
    store.run(`UPDATE magic_tokens SET organizador_id = ? WHERE token_hash = ?`, org.id, hashToken(token));
  }
  // vínculo pré-aprovado ao evento
  if (row.evento_id && row.papel) {
    const existe = store.get(`SELECT id FROM organizador_membros WHERE organizador_id = ? AND evento_id = ?`, org.id, row.evento_id);
    if (!existe) store.run(`INSERT INTO organizador_membros (id, organizador_id, evento_id, papel, criado_em) VALUES (?,?,?,?,?)`,
      newId(6), org.id, row.evento_id, row.papel === 'casal' ? 'casal' : 'cerimonial', new Date().toISOString());
  }
  const rawSession = criarSessaoOrganizador(org.id, req);
  setCookie(res, SESSION_COOKIE, rawSession, SESSION_TTL_MS, false);
  return res.json({ ok: true, organizador: { id: org.id, email: org.email } });
}
app.post('/api/auth/entrar', (req, res) => handleEntrarConsumo(req, res));

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
    linkConvite: `${base}/e/${ev.id}`,
    totalLista: ev.lista.length, rsvp, pushInscritos: ev.push.length,
    limitesEfetivos: { maxConvidados: limGuests(ev), maxLista: limLista(ev), maxFotos: limFotos(ev) },
    fotosPorPessoa: ev.guests.map((g) => ({ nome: g.nome, fotos: ev.photos.filter((p) => p.guestId === g.id).length })),
    recados: ev.recados.length,
    equipe: req.admin.dono
      // O token bruto só existe na criação (guardamos apenas o hash); o painel
      // mostra o link na hora de gerar e não consegue recuperá-lo depois.
      ? ev.equipe.map((m) => ({ id: m.id, nome: m.nome, papel: m.papel, link: null }))
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
  res.status(201).json({ id: m.id, nome, papel, link: `${baseUrl(req)}/painel/${req.ev.id}#t=${token}` });
});
app.delete('/api/events/:id/equipe/:eid', getEvent, adminOnly, donoOnly, (req, res) => {
  req.ev.equipe = req.ev.equipe.filter((m) => m.id !== req.params.eid);
  audit(req, 'equipe.removida', { membro: req.params.eid });
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
  const r = { id: newId(6), guestId: g.id, autor: g.nome, texto, criadoEm: new Date().toISOString() };
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
  if (ev.photos.length >= limFotos(ev)) return res.status(409).json({ erro: 'Este evento atingiu o limite de fotos.' });
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
      ? { id: p.id, autor: ev.config.mostrarAutor ? p.autor : '', criadaEm: p.criadaEm, minha: p.guestId === guestId, url: `/api/events/${ev.id}/photos/${p.id}/file` }
      : { id: p.id, bloqueada: true, minha: p.guestId === guestId }
  );
  res.json({ revelado: open, revealAt: ev.revealAt, agora: new Date().toISOString(), fotos: lista });
});

// O arquivo só sai depois da revelação — exceto para a organização (moderação).
app.get('/api/events/:id/photos/:pid/file', getEvent, (req, res) => {
  const token = req.get('x-host-token') || req.query.token;
  const ev = req.ev;
  // Master por sessão; token estático só sem conta master (ou válvula, nunca em https e
  // nunca pela query string).
  const modoEstatico = aceitaTokenEstatico(req.get('x-master-token') || req.get('x-host-token'));
  if (modoEstatico === 'emergencia') auditDb(req, 'master', null, ev.id, 'master.token_emergencia', 'photo.file', {}, 'ok');
  const master = !!masterDaSessao(req) || !!modoEstatico;
  // Sessão de organizador com vínculo ao evento, ou tokens legados (por hash).
  let org = false;
  const o = organizadorDaSessao(req);
  if (o) org = !!store.get(`SELECT id FROM organizador_membros WHERE organizador_id = ? AND evento_id = ?`, o.id, ev.id);
  if (!org && token) org = verifyToken(token, ev.hostTokenHash) || ev.equipe.some((m) => verifyToken(token, m.tokenHash));
  if (!revealed(ev) && !master && !org) return res.status(403).json({ erro: 'Esta foto ainda não foi revelada.' });
  const p = ev.photos.find((x) => x.id === req.params.pid);
  if (!p) return res.status(404).end();
  res.sendFile(path.join(PHOTO_DIR, ev.id, `${p.id}.${p.ext}`));
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ erro: `Foto muito grande (máx. ${settings.tamanhoMaxFotoMB} MB).` });
  console.error(err);
  res.status(500).json({ erro: 'Algo deu errado. Tente de novo.' });
});

// ───── Admin master (todos os casamentos)
function masterOnly(req, res, next) {
  const token = req.get('x-master-token') || req.get('x-host-token');
  const ms = getMasterSessao(req);
  if (ms) {
    const m = store.get(`SELECT * FROM master_accounts WHERE id = ? AND ativo = 1`, ms.master_id);
    if (m) {
      req.admin = { papel: 'master', nome: m.nome, master: true, dono: true, id: m.id, masterId: m.id };
      return next();
    }
  }
  const modoEstatico = aceitaTokenEstatico(token);
  if (modoEstatico) {
    if (modoEstatico === 'emergencia') auditDb(req, 'master', null, null, 'master.token_emergencia', 'masterOnly', { rota: req.path }, 'ok');
    req.admin = { papel: 'master', nome: 'Admin master (legado)', master: true, dono: true, id: null };
    return next();
  }
  return res.status(403).json({ erro: 'Acesso restrito ao administrador do Memo.' });
}
const resumoEvento = (ev) => ({
  id: ev.id, titulo: ev.titulo, contato: ev.contato || '', criadoEm: ev.createdAt,
  dataEvento: ev.dataEvento, revealAt: ev.revealAt, revelado: revealed(ev), suspenso: !!ev.suspenso,
  fotos: ev.photos.length, camera: ev.guests.length, lista: ev.lista.length, recados: ev.recados.length,
  confirmados: ev.lista.filter((l) => l.rsvp === 'confirmado').length, equipe: ev.equipe.length,
  push: ev.push.length, avisos: ev.avisos.length, limites: ev.limites, config: ev.config,
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
  const reg = { id: newId(6), guestId: g.id, sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, criadoEm: new Date().toISOString() };
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
  const recentes = ev.avisos.filter((a) => Date.now() - new Date(a.enviadoEm).getTime() < 3600e3).length;
  if (recentes >= 5 && !req.admin.master) return res.status(429).json({ erro: 'Limite de 5 avisos por hora. Tente mais tarde.' });
  const aviso = { id: newId(5), titulo, corpo, enviadoEm: new Date().toISOString(), por: req.admin.nome };
  const r = settings.pushAtivo ? await enviarPush(ev, { titulo, corpo }) : { alvos: 0, entregues: 0, falhas: 0 };
  ev.avisos.push({ ...aviso, ...r });
  audit(req, 'aviso.enviado', { titulo, ...r });
  save();
  res.status(201).json({ ...r });
});

// Revelação automática: avisa quem instalou o app quando o álbum abre.
setInterval(async () => {
  for (const ev of Object.values(db.events)) {
    if (ev.revealNotified || !revealed(ev)) continue;
    ev.revealNotified = true;
    const r = settings.pushAtivo && !ev.suspenso ? await enviarPush(ev, { titulo: 'As fotos foram reveladas! 🎉', corpo: `Veja o álbum de ${ev.titulo}.`, url: `/e/${ev.id}/album` }) : { alvos: 0, entregues: 0, falhas: 0 };
    ev.avisos.push({ id: newId(5), titulo: 'As fotos foram reveladas! 🎉', corpo: `O álbum de ${ev.titulo} está aberto.`, enviadoEm: new Date().toISOString(), por: 'Sistema', ...r });
    save();
  }
}, 30000).unref();

app.get('/e/:id/manifest.webmanifest', getEvent, (req, res) => {
  const ev = req.ev;
  res.type('application/manifest+json').json({
    name: ev.titulo, short_name: ev.titulo.slice(0, 12), lang: 'pt-BR', id: `/e/${ev.id}/`,
    start_url: `/e/${ev.id}/inicio`, scope: `/e/${ev.id}/`, display: 'standalone',
    background_color: '#0e0d0c', theme_color: '#0e0d0c',
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

// ───── Autenticação organizador: logout e info
function handleSair(req, res) {
  revogarSessao(req);
  clearCookie(res, SESSION_COOKIE);
  res.json({ ok: true });
}
app.post('/api/auth/sair', handleSair);
app.get('/api/auth/me', (req, res) => {
  const org = organizadorDaSessao(req);
  if (!org) return res.status(401).json({ erro: 'Não autenticado.' });
  res.json({ organizador: { id: org.id, email: org.email } });
});

// ───── Autenticação master: login, sessão, logout
const COMMON_PASSWORDS = new Set(['123456789012', 'passwordpassword', 'qwertyuiopasdf', 'senha1234567', 'administrador12']);
function validarSenhaForte(s) {
  const p = String(s || '');
  if (p.length < 12) return 'A senha precisa ter pelo menos 12 caracteres.';
  if (COMMON_PASSWORDS.has(p.toLowerCase())) return 'Senha muito comum. Escolha outra.';
  return null;
}
async function handleMasterLogin(req, res) {
  const key = `masterlogin:${clientIp(req)}`;
  const rl = rateLimitLogin(key, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    res.set('Retry-After', Math.ceil((rl.resetAt - Date.now()) / 1000));
    return res.status(429).json({ erro: 'Muitas tentativas. Tente mais tarde.' });
  }
  const email = normEmail(req.body?.email);
  const senha = req.body?.senha || req.body?.password;
  const code = req.body?.totp || req.body?.code || req.body?.otp || req.body?.twoFactor;
  const recovery = req.body?.recoveryCode || req.body?.recovery;
  if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  const m = store.get(`SELECT * FROM master_accounts WHERE email_norm = ?`, email);
  if (!m || !m.ativo) {
    return res.status(401).json({ erro: 'Credenciais inválidas.' });
  }
  if (!await scryptVerify(senha, m.senha_hash)) {
    store.run(`UPDATE master_accounts SET falhas = falhas + 1 WHERE id = ?`, m.id);
    auditDb(req, 'master', m.id, null, 'login.falha', m.id, { motivo: 'senha' }, 'falha');
    return res.status(401).json({ erro: 'Credenciais inválidas.' });
  }
  const secret = base32Decode(decipherSecret(m.totp_secret));
  let totpOk = false;
  let newLastStep = m.totp_ultimo_passo;
  if (!code && recovery) {
    let hashes = [];
    try { hashes = JSON.parse(m.recuperacao_hashes || '[]'); } catch {}
    for (let i = 0; i < hashes.length; i++) {
      if (await scryptVerify(recovery, hashes[i])) {
        totpOk = true;
        hashes.splice(i, 1);
        store.run(`UPDATE master_accounts SET recuperacao_hashes = ?, totp_ultimo_passo = ? WHERE id = ?`, JSON.stringify(hashes), m.totp_ultimo_passo, m.id);
        break;
      }
    }
  } else {
    const v = totpVerify(secret, code, m.totp_ultimo_passo || 0);
    if (v.ok) { totpOk = true; newLastStep = v.step; }
  }
  if (!totpOk) {
    store.run(`UPDATE master_accounts SET falhas = falhas + 1 WHERE id = ?`, m.id);
    auditDb(req, 'master', m.id, null, 'login.falha', m.id, { motivo: 'totp' }, 'falha');
    return res.status(401).json({ erro: 'Código 2FA inválido.' });
  }
  store.run(`UPDATE master_accounts SET falhas = 0, totp_ultimo_passo = ? WHERE id = ?`, newLastStep, m.id);
  const raw = criarSessaoMaster(m.id, req);
  setCookie(res, MASTER_COOKIE, raw, MASTER_SESSION_TTL_MS, true);
  auditDb(req, 'master', m.id, null, 'login.ok', m.id, {}, 'ok');
  res.json({ ok: true, master: { id: m.id, email: m.email, nome: m.nome } });
}
app.post('/api/master/login', handleMasterLogin);

function handleMasterLogout(req, res) {
  const cookies = parseCookies(req);
  const raw = cookies[MASTER_COOKIE];
  if (raw) store.run(`UPDATE master_sessoes SET revogada = 1 WHERE id_hash = ?`, hashToken(raw));
  clearCookie(res, MASTER_COOKIE);
  res.json({ ok: true });
}
app.post('/api/master/sair', handleMasterLogout);

app.get('/api/master/me', (req, res) => {
  const m = masterDaSessao(req);
  if (!m) return res.status(401).json({ erro: 'Não autenticado.' });
  res.json({ master: { id: m.id, email: m.email, nome: m.nome } });
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

async function criarMasterConta({ email, nome, senha, totpSecret } = {}) {
  const erro = validarSenhaForte(senha);
  if (erro) throw new Error(erro);
  const emailN = normEmail(email);
  if (!emailN || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailN)) throw new Error('e-mail inválido');
  const existente = store.get(`SELECT id FROM master_accounts WHERE email_norm = ?`, emailN);
  if (existente) throw new Error('já existe master com esse e-mail');
  const secret = totpSecret || totpSecretNew();
  const secretArmazenado = cipherSecret(secret);
  const { codes, hashes } = await genRecoveryCodes(10);
  const id = newId(8);
  store.run(`INSERT INTO master_accounts (id,email,email_norm,nome,senha_hash,totp_secret,totp_ultimo_passo,recuperacao_hashes,ativo,criado_em,falhas) VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
    id, email, emailN, nome || 'Admin master', await scryptHash(senha), secretArmazenado, 0, JSON.stringify(hashes), 1, new Date().toISOString());
  return { id, email, nome: nome || 'Admin master', totpSecret: secret, recoveryCodes: codes, otpauth: otpauthUrl(secret, email) };
}
app.criarMaster = criarMasterConta;
module.exports.criarMaster = criarMasterConta;

if (require.main === module) {
  (async () => {
    // Fail-closed: produção sem domínio https não sobe (cookie Secure, link mágico e 2FA
    // dependem de PUBLIC_URL https; sem ela o servidor se comportaria como dev).
    if (process.env.NODE_ENV === 'production' && !isProd) {
      console.error('Produção (NODE_ENV=production) exige PUBLIC_URL começando com https:// (fail-closed).');
      process.exit(1);
    }
    if (isProd) {
      if (!process.env.MASTER_TOTP_KEY) { console.error('Produção exige MASTER_TOTP_KEY'); process.exit(1); }
      if (!process.env.EMAIL_PROVIDER || !process.env.EMAIL_API_KEY) { console.error('Produção exige provedor de e-mail configurado'); process.exit(1); }
    }
    await ensureMasterBootstrap();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Memo Brasil em http://localhost:${PORT}`);
      console.log(masterGerado ? `Token do admin master gerado em ${MASTER_FILE}` : process.env.MASTER_TOKEN ? 'Admin master: token vindo de MASTER_TOKEN' : `Admin master: token em ${MASTER_FILE}`);
      console.log(`Admin master: http://localhost:${PORT}/master`);
      if (lanIp()) console.log(`Na mesma rede Wi-Fi (celular): http://${lanIp()}:${PORT}`);
    });
  })();
}
app.store = store;
module.exports = app;
module.exports.store = store;
module.exports.criarMaster = criarMasterConta;
module.exports.isProd = isProd;
module.exports.emergenciaAtiva = emergenciaAtiva;
module.exports.aceitaTokenEstatico = aceitaTokenEstatico;
module.exports.clearRateLimits = () => { rl.clear(); rlCriacao.clear(); rlLogin.clear(); };
