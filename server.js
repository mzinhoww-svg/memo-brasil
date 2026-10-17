const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const webpush = require('web-push');
const { ZipArchive } = require('archiver');
const imagem = require('./src/image');
const { createLogger } = require('./src/obs/logger');
const { createHealthHandler } = require('./src/obs/health');
const { limFotosEvento } = require('./src/obs/limites');
const { createSentry } = require('./src/obs/sentry');
const { tokenHash, verifyToken } = require('./src/store/sqlite');
const clock = require('./src/clock');
const { registrarConsentimento, validarConsentimento } = require('./src/lgpd/consentimento');
const { registrarDenuncia, resolverDenunciasDaFoto } = require('./src/lgpd/denuncia');
const { configRetencao, expiraEmMs } = require('./src/lgpd/retencao');
const { registrarExclusao } = require('./src/lgpd/auditoria');
const { enfileirarAviso } = require('./src/lgpd/outbox');
const { novoToken, autentica, sessaoDe, MENSAGENS } = require('./src/guest');
const { semSegredos } = require('./src/seguranca');
const { criarLimite } = require('./src/limite');
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
const MAX_HARD_PHOTO_BYTES = 25 * 1024 * 1024; // teto técnico; o limite configurável fica em settings
// Retenção do hash de IP nos logs (política de privacidade).
const LOG_RETENCAO_DIAS = Math.max(1, parseInt(process.env.LOG_RETENCAO_DIAS, 10) || 30);

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
  const linha = JSON.stringify({ t: clock.iso(), quem, evento: req.ev?.id || detalhe.evento || null, acao, ...detalhe });
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
  retencaoDiasSemRevelacao: 180,
};
let settings = { ...DEFAULTS };
try { if (fs.existsSync(SETTINGS_FILE)) settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }; } catch {}
const saveSettings = () => fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
const limGuests = (ev) => ev.limites?.maxConvidados ?? settings.maxConvidadosPorEvento;
const limLista = (ev) => ev.limites?.maxLista ?? settings.maxListaPorEvento;
const limFotos = (ev) => limFotosEvento(ev, settings);
const CONFIG_PADRAO = { recadosAtivos: true, apenasLista: false, mostrarAutor: true, recadosMural: false };

// Chaves VAPID para notificações push (geradas uma vez).
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
let vapid;
try { vapid = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8')); } catch {
  vapid = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapid), { mode: 0o600 });
}
webpush.setVapidDetails(process.env.VAPID_CONTACT || 'mailto:contato@memobrasil.app', vapid.publicKey, vapid.privateKey);

// `audit()`/`auditDb()` são definidos acima (arquivo + banco encadeado).
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

// ───── Token master estático (legado) ─────
// Vale só enquanto não existir conta master, ou pela válvula de emergência
// (MASTER_EMERGENCY/MASTER_TOKEN_COMPAT) — que nunca vale com PUBLIC_URL https e
// fica registrada na auditoria a cada uso. Nunca aceito por query string.
function masterCount() { return (store.get(`SELECT COUNT(*) AS c FROM master_accounts`).c || 0); }
function emergenciaAtiva() {
  if (isProd) return false; // PUBLIC_URL https: a válvula fica desligada
  return process.env.MASTER_EMERGENCY === '1' || process.env.MASTER_TOKEN_COMPAT === '1';
}
// Retorna 'bootstrap' (sem conta master, só fora de https), 'emergencia' (válvula)
// ou null (recusado). Em https a credencial legada nunca vale, nem na primeira
// subida: o primeiro master entra por MASTER_BOOTSTRAP_* ou scripts/master-criar.js.
function aceitaTokenEstatico(token) {
  if (!isMaster(token)) return null;
  if (isProd) return null;
  if (masterCount() === 0) return 'bootstrap';
  if (emergenciaAtiva()) return 'emergencia';
  return null;
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
// Observabilidade: log estruturado por requisição (sem PII) e healthcheck.
const logger = createLogger();
const sentry = createSentry({ version: require('./package.json').version });
app.use(logger.middleware);
app.get('/healthz', createHealthHandler({ dataDir: DATA_DIR }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
// C3: nenhum hash de token (host, equipe ou convidado) pode sair numa resposta.
app.use(semSegredos);
// Modo manutenção: só o admin master passa.
app.use('/api', (req, res, next) => {
  if (!settings.manutencao) return next();
  const t = req.get('x-master-token') || req.get('x-host-token');
  if (req.path.startsWith('/config') || masterDaSessao(req) || aceitaTokenEstatico(t)) return next();
  res.status(503).json({ erro: settings.avisoGlobal || 'O Lume está em manutenção. Volte em instantes.' });
});
app.get('/api/config', (req, res) => res.json({
  criacaoAberta: settings.criacaoAberta, manutencao: settings.manutencao, avisoGlobal: settings.avisoGlobal,
  pushAtivo: settings.pushAtivo, vapidPublicKey: vapid.publicKey, tamanhoMaxFotoMB: settings.tamanhoMaxFotoMB,
}));

// ───── CSRF: quem age por cookie de sessão precisa provar a origem
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);
function hostPublico(req) {
  if (process.env.PUBLIC_URL) { try { return new URL(process.env.PUBLIC_URL).host; } catch {} }
  return req.get('host') || '';
}
function temCookieDeSessao(req) {
  const c = parseCookies(req);
  return !!(c[SESSION_COOKIE] || c[MASTER_COOKIE]);
}
// Métodos que mudam estado exigem Origin do próprio domínio quando há cookie de
// sessão. Quem usa token em cabeçalho (convidado, painel por link, API) não é
// afetado, e GET continua livre para leitura.
function guardaOrigem(req, res, next) {
  if (METODOS_SEGUROS.has(req.method) || !temCookieDeSessao(req)) return next();
  const origin = req.get('origin');
  if (!origin) return res.status(403).json({ erro: 'Ação com sessão exige o cabeçalho Origin.' });
  let host;
  try { host = new URL(origin).host; } catch { return res.status(403).json({ erro: 'Origem inválida.' }); }
  if (host !== hostPublico(req)) return res.status(403).json({ erro: 'A origem da requisição não confere com o domínio do Lume.' });
  next();
}
app.use('/api', guardaOrigem);

// Upload de foto: o limite real vem da configuração do evento e é aplicado em
// tempo de requisição — assim o multer corta o corpo assim que passa do
// tamanho permitido, em vez de bufferizar até o teto técnico.
const uploadFoto = (req, res, next) => {
  const limite = Math.min(Math.max(settings.tamanhoMaxFotoMB, 1) * imagem.MB, MAX_HARD_PHOTO_BYTES);
  multer({ storage: multer.memoryStorage(), limits: { fileSize: limite, files: 1, fields: 4, parts: 8, fieldSize: 1024 } })
    .single('foto')(req, res, next);
};

function getEvent(req, res, next) {
  const ev = db.events[req.params.id];
  if (!ev) return res.status(404).json({ erro: 'Evento não encontrado.' });
  req.ev = ev;
  next();
}
// Identifica a organização do evento: sessão master/organizador ou tokens legados
// (host/equipe) por hash. Credencial só por cabeçalho, nunca na URL. Devolve o
// admin ou null. É a única porta de entrada da organização — adminOnly e a
// leitura de recados usam a mesma regra.
function adminDaRequisicao(req) {
  const ev = req.ev;
  const token = req.get('x-host-token');
  // Sessão master (masterDaSessao devolve a própria conta ativa; não há segunda consulta).
  const ms = masterDaSessao(req);
  if (ms) return { papel: 'master', nome: ms.nome, dono: true, master: true, id: ms.id };
  // Sessão do organizador com vínculo ao evento.
  const org = organizadorDaSessao(req);
  if (org) {
    const membro = store.get(`SELECT * FROM organizador_membros WHERE organizador_id = ? AND evento_id = ?`, org.id, ev.id);
    if (membro) return { papel: membro.papel, nome: org.email, dono: membro.papel === 'casal', id: org.id, organizadorId: org.id, master: false };
  }
  // Tokens legados do evento (hostToken / equipe) só valem por hash — nunca em texto puro.
  if (token && verifyToken(token, ev.hostTokenHash)) return { papel: 'casal', nome: 'Casal', dono: true };
  if (token) {
    const m = ev.equipe.find((e) => verifyToken(token, e.tokenHash));
    if (m) return { papel: m.papel, nome: m.nome, id: m.id };
  }
  // Transição: token master estático só vale sem conta master ou com a válvula de emergência.
  const modoEstatico = aceitaTokenEstatico(req.get('x-master-token') || req.get('x-host-token'));
  if (modoEstatico) return { papel: 'master', nome: 'Admin master (legado)', dono: true, master: true, modoEstatico };
  return null;
}

// Organização do casamento: casal (dono) ou cerimonial (equipe). O convidado nunca passa por aqui.
function adminOnly(req, res, next) {
  const admin = adminDaRequisicao(req);
  if (!admin) return res.status(403).json({ erro: 'Acesso restrito à organização do casamento.' });
  req.admin = admin;
  if (admin.modoEstatico === 'emergencia') auditDb(req, 'master', null, req.ev.id, 'master.token_emergencia', 'adminOnly', {}, 'ok');
  next();
}
const donoOnly = (req, res, next) =>
  req.admin.dono ? next() : res.status(403).json({ erro: 'Só o casal pode fazer isso.' });

// Organização/master da requisição, sem responder 403 (mesma regra do adminOnly):
// usada nas leituras que precisam saber se quem pede é a organização (fotos e recados).
function ehOrg(req) { return !!adminDaRequisicao(req); }

// Decisão 004: recado privado ao casal por padrão; mural só quando ligado e marcado.
function recadosVisiveis(ev, opts) {
  const mostrarAutor = ev.config.mostrarAutor;
  return ev.recados
    .filter((r) => opts.organizacao || r.guestId === opts.guestId || (r.visibilidade === 'mural' && ev.config.recadosMural))
    .slice(-200).reverse()
    .map((r) => {
      const meu = r.guestId === opts.guestId;
      const mural = r.visibilidade === 'mural';
      const mostraAutor = opts.organizacao || meu || (mural && mostrarAutor);
      return { id: r.id, texto: r.texto, criadoEm: r.criadoEm, meu, visibilidade: mural ? 'mural' : 'casal', autor: mostraAutor ? r.autor : '' };
    });
}

// Reserva de cota: o check e o incremento acontecem sem nenhum `await` no meio,
// então dois uploads do mesmo convidado nunca passam juntos. A reserva é
// liberada quando a resposta termina, com sucesso ou erro.
const reservasFoto = new Map(); // evId -> { total, porConvidado: Map }
function reservarFoto(ev, guest) {
  const r = reservasFoto.get(ev.id) || { total: 0, porConvidado: new Map() };
  reservasFoto.set(ev.id, r);
  const usadas = ev.photos.filter((p) => p.guestId === guest.id).length;
  const naFila = r.porConvidado.get(guest.id) || 0;
  if (usadas + naFila >= ev.fotosPorConvidado) return 'cota';
  if (ev.photos.length + r.total >= limFotos(ev)) return 'evento';
  r.total += 1;
  r.porConvidado.set(guest.id, naFila + 1);
  return null;
}
function liberarFoto(ev, guest) {
  const r = reservasFoto.get(ev.id);
  if (!r) return;
  r.total = Math.max(0, r.total - 1);
  const n = (r.porConvidado.get(guest.id) || 0) - 1;
  if (n > 0) r.porConvidado.set(guest.id, n); else r.porConvidado.delete(guest.id);
  if (r.total === 0 && r.porConvidado.size === 0) reservasFoto.delete(ev.id);
}

// Limite das tentativas inválidas nos uploads (rota pública). A chave inclui
// sempre o IP (req.ip, com `trust proxy` configurado na main), mas o evento e o
// convidado delimitam o balde: o salão costuma estar todo no mesmo NAT e um
// aparelho errando não pode derrubar os demais. Só as FALHAS contam — token
// ausente/errado, imagem inválida ou envio acima do teto. Configurável por env
// para os testes; o padrão é 20 falhas por 10 minutos, por chave.
const limiteGuest = criarLimite({
  max: parseInt(process.env.GUEST_MAX_TENTATIVAS, 10) > 0 ? parseInt(process.env.GUEST_MAX_TENTATIVAS, 10) : 20,
  janelaMs: parseInt(process.env.GUEST_JANELA_MS, 10) > 0 ? parseInt(process.env.GUEST_JANELA_MS, 10) : 10 * 60 * 1000,
});

// Conta uma tentativa inválida no balde (IP, evento, convidado) do pedido e
// devolve true quando o teto da janela foi atingido (aí a resposta é 429).
function anotarFalha(req) {
  if (!req.limiteChave) return false;
  limiteGuest.falhou(req.limiteChave);
  return limiteGuest.atingiu(req.limiteChave);
}

// Autentica o convidado antes de entregar o corpo ao multer quando a credencial
// vem por cabeçalho (x-guest-id + x-guest-token), o caminho preferido: nada é
// lido do corpo até a credencial ser validada. Quando o id não vem no cabeçalho,
// a rota aceita o `guestId` do formulário (contrato do #13 herdado da main) e a
// checagem acontece em guestAuthCorpo, logo após o multer — o token continua
// exclusivamente no cabeçalho x-guest-token, nunca na URL/query.
//
// A autenticação é O(1) (busca pelo id e um único hash, via autentica()) e roda
// ANTES do limite: uma credencial válida nunca é barrada por engano. O balde do
// par (IP, evento, convidado) só é zerado quando a foto entra de fato (sucesso),
// de modo que tentativas inválidas — token errado, imagem inválida ou envio
// grande demais — se acumulam até o teto da janela.
function autorizarConvidado(req, res, guestId) {
  const ev = req.ev;
  const token = req.get('x-guest-token');
  const ip = req.ip || req.socket?.remoteAddress || 'desconhecido';
  const chave = `${ip}:${ev.id}:${guestId || 'sem-id'}`;
  req.limiteChave = chave;
  const guest = guestId && token ? autentica(ev, guestId, token) : null;
  if (!guest) {
    limiteGuest.falhou(chave);
    if (limiteGuest.atingiu(chave)) {
      res.status(429).json({ erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' });
      return null;
    }
    res.status(403).json({ erro: MENSAGENS.semToken });
    return null;
  }
  const usadas = ev.photos.filter((p) => p.guestId === guest.id).length;
  if (usadas >= ev.fotosPorConvidado) {
    res.status(409).json({ erro: `Você já usou suas ${ev.fotosPorConvidado} fotos.` });
    return null;
  }
  if (ev.photos.length >= limFotos(ev)) {
    res.status(413).json({ erro: 'Este evento atingiu o teto de fotos. Não é possível enviar mais fotos.' });
    return null;
  }
  const motivo = reservarFoto(ev, guest);
  if (motivo === 'cota') {
    res.status(409).json({ erro: `Você já usou suas ${ev.fotosPorConvidado} fotos.` });
    return null;
  }
  if (motivo === 'evento') {
    res.status(413).json({ erro: 'Este evento atingiu o teto de fotos. Não é possível enviar mais fotos.' });
    return null;
  }
  // A reserva é liberada quando a resposta termina, com sucesso ou erro.
  let liberado = false;
  const liberar = () => { if (!liberado) { liberado = true; liberarFoto(ev, guest); } };
  res.on('finish', liberar);
  res.on('close', liberar);
  req.guest = guest;
  return guest;
}

// guestAuth roda ANTES do multer: valida o evento e, quando o id vem no cabeçalho
// x-guest-id, autentica sem ler o corpo.
function guestAuth(req, res, next) {
  const ev = req.ev;
  if (ev.suspenso) return res.status(403).json({ erro: MENSAGENS.eventoIndisponivel });
  if (revealed(ev)) return res.status(409).json({ erro: MENSAGENS.eventoEncerrado });
  const guestId = req.get('x-guest-id');
  if (!guestId) return next(); // sem cabeçalho: resolve em guestAuthCorpo, com o id do corpo
  if (!autorizarConvidado(req, res, guestId)) return;
  next();
}

// Fallback pós-multer: id no formulário (guestId) e token no cabeçalho. Sai na
// primeira linha quando guestAuth já autenticou.
function guestAuthCorpo(req, res, next) {
  if (req.guest) return next();
  if (!autorizarConvidado(req, res, req.body && req.body.guestId)) return;
  next();
}

function publicInfo(ev) {
  return {
    id: ev.id, titulo: ev.titulo, revealAt: ev.revealAt, revelado: revealed(ev),
    agora: clock.iso(), fotosPorConvidado: ev.fotosPorConvidado,
    momentos: ev.photos.filter((p) => !p.oculta).length, pessoas: ev.guests.length,
    dataEvento: ev.dataEvento, local: ev.local, endereco: ev.endereco, mensagem: ev.mensagem,
    cronograma: ev.cronograma, suspenso: !!ev.suspenso,
    // `recadosMural` é o nome do campo; `muralRecados` fica como apelido da decisão 004.
    config: { ...ev.config, recadosMural: !!ev.config.recadosMural, muralRecados: !!ev.config.recadosMural },
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
    push: [], avisos: [], revealNotified: false, emailEnviado: false, contatoVerificado: false,
    denuncias: [], consentimentos: [],
    cronograma: [], lista: [], equipe: [], recados: [], guests: [], photos: [],
    createdAt: clock.iso(),
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
const modoDesenvolvimento = () => !process.env.NODE_ENV || ['development', 'test'].includes(process.env.NODE_ENV);
const emailReal = () => email.nome === 'smtp' || email.nome === 'resend';
// Console só conta como entrega em dev/teste (ou com autorização explícita de
// ensaio). Em produção/staging sem provedor real: 503 é melhor que prometer envio.
const linkEntregavel = () =>
  email.nome !== 'desativado' && (emailReal() || modoDesenvolvimento() || process.env.EMAIL_CONSOLE_PERMITIDO === 'sim');

// Em dev/teste o link também vai para DATA_DIR/auth.log, para quem desenvolve e
// para os testes. Em produção nunca: log é dado pessoal e o link é segredo.
function registrarLinkDev(destino, link) {
  if (isProd || !modoDesenvolvimento()) return;
  console.log(`[email:dev] magic link para ${emailHashCurto(destino)}: ${link}`);
  try { fs.appendFileSync(path.join(DATA_DIR, 'auth.log'), `${new Date().toISOString()} ${emailHashCurto(destino)} ${link}\n`); } catch {}
}

async function magicLinkEnviar(destino, tokenRaw, baseUrlStr) {
  const link = `${baseUrlStr}/api/auth/entrar?t=${encodeURIComponent(tokenRaw)}`;
  registrarLinkDev(destino, link);
  const texto = `Para entrar no Lume e cuidar do seu casamento, abra este link:\n${link}\n\nO link vale 15 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail.`;
  try {
    return await email.enviar({ para: destino, assunto: 'Seu link de acesso ao Lume', texto });
  } catch (e) {
    console.error(`[email] falha ao enviar o link de acesso: ${e.message}`);
    return { ok: false };
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
  // Sem provedor de e-mail ativo não há como entregar: 503 é melhor que um 202
  // "enviamos um link" que nunca chega.
  if (!linkEntregavel()) {
    return res.status(503).json({ erro: 'O envio de link por e-mail está indisponível no momento. Tente mais tarde.' });
  }
  const rlim = rateLimit(rlKey(req, 'magiclink'), 10, 60 * 60 * 1000);
  if (!rlim.ok) {
    res.set('Retry-After', Math.ceil((rlim.resetAt - Date.now()) / 1000));
    return res.status(429).json({ erro: 'Muitas solicitações. Tente mais tarde.' });
  }
  const destino = normEmail(req.body?.email);
  if (!destino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
    return res.status(202).json({ ok: true, mensagem: 'Se o e-mail for válido, enviamos um link de acesso.' });
  }
  const emailN = normEmail(destino);
  // rate limit por e-mail (silencioso)
  const rl2 = rateLimit(`magiclink:email:${emailN}`, 5, 60 * 60 * 1000);
  if (!rl2.ok) {
    return res.status(202).json({ ok: true, mensagem: 'Se o e-mail for válido, enviamos um link de acesso.' });
  }
  // Não cria organizador nem vínculo aqui; isso só ocorre no consumo.
  const tokenRaw = magicTokenNovo(emailN, 'login', null, null, null, MAGIC_TTL_MS);
  await magicLinkEnviar(destino, tokenRaw, baseUrl(req));
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
  const base = baseUrl(req);
  const visiveis = ev.photos.filter((p) => !p.oculta);
  const expira = expiraEmMs(ev, configRetencao({ settings }));
  res.json({
    ...publicInfo(ev),
    papel: req.admin.papel, nome: req.admin.nome, dono: !!req.admin.dono, master: !!req.admin.master,
    contato: req.admin.master ? req.ev.contato : undefined,
    contatoVerificado: !!req.ev.contatoVerificado,
    linkConvite: `${base}/e/${ev.id}`,
    totalLista: ev.lista.length, pushInscritos: ev.push.length,
    limitesEfetivos: { maxConvidados: limGuests(ev), maxLista: limLista(ev), maxFotos: limFotos(ev) },
    fotosPorPessoa: ev.guests.map((g) => ({ nome: g.nome, fotos: visiveis.filter((p) => p.guestId === g.id).length })),
    retencao: expira ? { apagaEm: new Date(expira).toISOString(), diasRestantes: Math.ceil((expira - clock.nowMs()) / 86400000), avisoEm: ev.retencaoAvisoEm || null } : null,
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
    // `muralRecados` (decisão 004) e `recadosMural` (item 7) são o mesmo campo.
    const cc = { ...b.config };
    if (cc.recadosMural !== undefined && cc.muralRecados === undefined) cc.muralRecados = cc.recadosMural;
    if (cc.muralRecados !== undefined && cc.recadosMural === undefined) cc.recadosMural = cc.muralRecados;
    for (const k of Object.keys(CONFIG_PADRAO)) if (typeof cc[k] === 'boolean') ev.config[k] = cc[k];
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

// Lista de convidados do casamento — separada de quem usa a câmera.
app.get('/api/events/:id/lista', getEvent, adminOnly, (req, res) => {
  const ev = req.ev;
  const naCamera = new Set(ev.guests.map((g) => g.listaId).filter(Boolean));
  res.json({ itens: ev.lista.map((l) => ({ ...l, naCamera: naCamera.has(l.id) })) });
});
app.post('/api/events/:id/lista', getEvent, adminOnly, (req, res) => {
  const ev = req.ev;
  // Aceita lista colada (uma pessoa por linha: "Nome; grupo") ou itens em JSON.
  let itens = req.body.itens;
  if (!itens && typeof req.body.texto === 'string') {
    itens = req.body.texto.split(/\r?\n/).map((linha) => {
      const [nome, grupo] = linha.split(/[;\t]/).map((s) => s.trim());
      return { nome, grupo };
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
    ev.lista.push({ id: newId(6), nome, grupo: clean(it.grupo, 40), origem: 'organizacao' });
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
  if (b.nome !== undefined) l.nome = clean(b.nome, 60) || l.nome;
  if (b.grupo !== undefined) l.grupo = clean(b.grupo, 40);
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
  const abertas = (id) => (ev.denuncias || []).filter((d) => d.fotoId === id && d.status === 'aberta').length;
  res.json({
    fotos: ev.photos.map((p) => ({
      id: p.id, autor: p.autor, criadaEm: p.criadaEm, oculta: !!p.oculta, denuncias: abertas(p.id),
      url: `/api/events/${ev.id}/photos/${p.id}/file`,
    })),
    recados: ev.recados,
    denunciasAbertas: (ev.denuncias || []).filter((d) => d.status === 'aberta').length,
  });
});
// Ocultar/mostrar: a foto oculta some do álbum e do ZIP dos convidados, mas a organização continua vendo.
app.patch('/api/events/:id/photos/:pid', getEvent, adminOnly, (req, res) => {
  const p = req.ev.photos.find((x) => x.id === req.params.pid);
  if (!p) return res.status(404).json({ erro: 'Foto não encontrada.' });
  if (typeof req.body?.oculta !== 'boolean') return res.status(400).json({ erro: 'Informe se a foto fica oculta.' });
  p.oculta = req.body.oculta;
  if (p.oculta) resolverDenunciasDaFoto(req.ev, p.id);
  audit(req, p.oculta ? 'foto.ocultada' : 'foto.exibida', { foto: p.id });
  save();
  res.json({ id: p.id, oculta: p.oculta });
});
app.delete('/api/events/:id/photos/:pid', getEvent, adminOnly, (req, res) => {
  const i = req.ev.photos.findIndex((p) => p.id === req.params.pid);
  if (i < 0) return res.status(404).json({ erro: 'Foto não encontrada.' });
  const [p] = req.ev.photos.splice(i, 1);
  resolverDenunciasDaFoto(req.ev, p.id, 'foto-apagada');
  audit(req, 'foto.apagada', { foto: p.id });
  fs.rmSync(path.join(PHOTO_DIR, req.ev.id, `${p.id}.${p.ext}`), { force: true });
  save();
  res.json({ ok: true });
});
// A organização vê as denúncias e decide ocultar ou apagar a foto; tudo fica auditado.
app.get('/api/events/:id/denuncias', getEvent, adminOnly, (req, res) => {
  const ev = req.ev;
  res.json({
    denuncias: (ev.denuncias || []).slice().reverse().map((d) => {
      const f = ev.photos.find((p) => p.id === d.fotoId);
      return {
        id: d.id, fotoId: d.fotoId, motivo: d.motivo, criadoEm: d.criadoEm, status: d.status,
        resolvidaEm: d.resolvidaEm || null, autor: f ? f.autor : null, fotoOculta: f ? !!f.oculta : null,
        url: `/api/events/${ev.id}/photos/${d.fotoId}/file`,
      };
    }),
  });
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
  if (ev.config.apenasLista && !ev.lista.some((l) => norm(l.nome) === norm(nome)))
    return res.status(403).json({ erro: 'Este evento é só para convidados da lista. Use o nome exatamente como os noivos cadastraram.' });
  const consent = validarConsentimento(req.body.consentimento);
  if (!consent.ok) return res.status(400).json({ erro: consent.erro });
  const item = ev.lista.find((l) => norm(l.nome) === norm(nome));
  // C2: convidado criado antes do token (sem tokenHash) reivindica a própria sessão
  // na primeira entrada, para não perder a cota de fotos. A reivindicação vale uma vez.
  // O token tem 32 bytes e o banco guarda só o hash (src/guest.js).
  const { token, hash } = novoToken();
  const orfao = ev.guests.find((x) => !x.tokenHash && norm(x.nome) === norm(nome));
  if (orfao) {
    orfao.tokenHash = hash;
    const c = registrarConsentimento(ev, orfao, consent.valor);
    save();
    const li = orfao.listaId && ev.lista.find((l) => l.id === orfao.listaId);
    return res.status(201).json({
      guestId: orfao.id, guestToken: token, nome: orfao.nome, naLista: !!li, reivindicado: true,
      consentimento: { versao: c.versao, em: c.em },
    });
  }
  if (ev.guests.length >= limGuests(ev)) return res.status(409).json({ erro: 'Evento lotado.' });
  const g = { id: newId(8), nome: item ? item.nome : nome, entrouEm: clock.iso(), listaId: item?.id, tokenHash: hash };
  ev.guests.push(g);
  const consentimento = registrarConsentimento(ev, g, consent.valor);
  save();
  res.status(201).json({
    guestId: g.id, guestToken: token, nome: g.nome, naLista: !!item,
    consentimento: { versao: consentimento.versao, em: consentimento.em },
  });
});

// Saldo do convidado: exige o token no cabeçalho x-guest-token.
app.get('/api/events/:id/guests/:gid', getEvent, (req, res) => {
  const g = autentica(req.ev, req.params.gid, req.get('x-guest-token'));
  if (!g) return res.status(403).json({ erro: MENSAGENS.semToken });
  res.json(sessaoDe(req.ev, g));
});

// Reentrada no mesmo aparelho: valida a sessão salva (id + token) e devolve o saldo.
app.post('/api/events/:id/sessao', getEvent, (req, res) => {
  const g = autentica(req.ev, req.body.guestId, req.get('x-guest-token'));
  if (!g) return res.status(403).json({ erro: MENSAGENS.sessaoInvalida });
  res.json(sessaoDe(req.ev, g));
});

app.get('/api/events/:id/recados', getEvent, (req, res) => {
  const ev = req.ev;
  // C4: sem credencial não lê. A organização (mesma identificação do adminOnly,
  // sessão + hash) vê todos; o convidado vê os seus + o mural.
  const admin = adminDaRequisicao(req);
  if (admin) { req.admin = admin; return res.json({ recados: recadosVisiveis(ev, { organizacao: true }), organizacao: true }); }
  const g = autentica(ev, req.query.guestId, req.get('x-guest-token'));
  if (!g) return res.status(403).json({ erro: MENSAGENS.recadoSemCredencial });
  res.json({ recados: recadosVisiveis(ev, { guestId: g.id }) });
});
app.post('/api/events/:id/recados', getEvent, (req, res) => {
  if (!req.ev.config.recadosAtivos) return res.status(403).json({ erro: 'Os recados estão desativados neste evento.' });
  const g = autentica(req.ev, req.body.guestId, req.get('x-guest-token'));
  if (!g) return res.status(403).json({ erro: MENSAGENS.semToken });
  const texto = clean(req.body.texto, 400);
  if (!texto) return res.status(400).json({ erro: 'Escreva seu recado.' });
  const mine = req.ev.recados.filter((r) => r.guestId === g.id).length;
  if (mine >= 5) return res.status(409).json({ erro: 'Você já deixou 5 recados.' });
  // Mural só se o casal ligou e o convidado marcou; por padrão é privado ao casal.
  const mural = !!req.ev.config.recadosMural && req.body.mural === true;
  const r = { id: newId(6), guestId: g.id, autor: g.nome, texto, visibilidade: mural ? 'mural' : 'casal', criadoEm: clock.iso() };
  req.ev.recados.push(r);
  save();
  res.status(201).json({ id: r.id, visibilidade: r.visibilidade, aviso: mural ? MENSAGENS.recadoMural : MENSAGENS.recadoSoNoivos });
});

// ───── Fotos
// A ordem importa: identificamos o evento, autenticamos o convidado (guestAuth,
// antes do multer quando o id vem no cabeçalho x-guest-id; senão guestAuthCorpo
// usa o `guestId` do formulário) e só então lemos o corpo. A autoria e a cota
// saem sempre do convidado autenticado, nunca do guestId não conferido.
app.post('/api/events/:id/photos', getEvent, guestAuth, uploadFoto, guestAuthCorpo, (req, res, next) => {
  const ev = req.ev;
  const guest = req.guest;
  if (!req.file || !req.file.buffer || !req.file.buffer.length) {
    if (anotarFalha(req)) return res.status(429).json({ erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' });
    return res.status(400).json({ erro: 'Envie uma foto.' });
  }
  let img;
  try { img = imagem.preparar(req.file.buffer); }
  catch (e) {
    if (e instanceof imagem.ErroImagem) {
      // Conteúdo/tipo inválido também alimenta o limite: varredura de formatos
      // não vira porta aberta.
      if (anotarFalha(req)) return res.status(429).json({ erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' });
      return res.status(e.status).json({ erro: e.message });
    }
    return next(e);
  }
  // O nome do arquivo é sempre gerado pelo servidor; o nome enviado pelo
  // cliente é descartado (evita path traversal, XSS em nome e colisão).
  const id = newId(8);
  const dir = path.join(PHOTO_DIR, ev.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.${img.ext}`), img.buffer);
  ev.photos.push({ id, ext: img.ext, guestId: guest.id, autor: guest.nome, criadaEm: clock.iso() });
  save();
  // Upload que entrou de fato zera o balde de tentativas inválidas da chave.
  if (req.limiteChave) limiteGuest.limpou(req.limiteChave);
  const usadas = ev.photos.filter((p) => p.guestId === guest.id).length;
  res.status(201).json({ id, restantes: Math.max(0, ev.fotosPorConvidado - usadas) });
});

app.get('/api/events/:id/photos', getEvent, (req, res) => {
  const ev = req.ev;
  const open = revealed(ev);
  const org = ehOrg(req);
  const guestId = req.query.guestId;
  // Foto oculta não aparece para o convidado (nem antes nem depois da revelação); a organização continua vendo.
  const visiveis = org ? ev.photos : ev.photos.filter((p) => !p.oculta);
  const lista = visiveis.map((p) =>
    open
      ? { id: p.id, autor: ev.config.mostrarAutor ? p.autor : '', criadaEm: p.criadaEm, minha: p.guestId === guestId, oculta: !!p.oculta, url: `/api/events/${ev.id}/photos/${p.id}/file` }
      : { id: p.id, bloqueada: true, minha: p.guestId === guestId }
  );
  res.json({ revelado: open, revealAt: ev.revealAt, agora: clock.iso(), fotos: lista });
});

// Retrospectiva do casamento: só abre depois da revelação e só olha o próprio evento.
app.get('/api/events/:id/retrospectiva', getEvent, (req, res) => {
  if (!revealed(req.ev)) return res.status(403).json({ erro: 'A retrospectiva abre quando o álbum for revelado.' });
  res.json(montarRetrospectiva(req.ev));
});

// O arquivo só sai depois da revelação — exceto para a organização (moderação) — e nunca se estiver oculto.
app.get('/api/events/:id/photos/:pid/file', getEvent, (req, res) => {
  // A credencial nunca vem na URL (fica em log, histórico e Referer): só por cabeçalho.
  const token = req.get('x-host-token');
  const ev = req.ev;
  // Master por sessão; token estático só sem conta master (ou válvula, nunca em https).
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
  // Foto oculta some para o convidado; a organização e o master continuam vendo.
  if (p.oculta && !master && !org) return res.status(404).json({ erro: 'Esta foto está indisponível.' });
  res.sendFile(path.join(PHOTO_DIR, ev.id, `${p.id}.${p.ext}`));
});

// Convidado autenticado denuncia uma foto. A organização é avisada e modera.
app.post('/api/events/:id/fotos/:pid/denunciar', getEvent, (req, res) => {
  const guest = autentica(req.ev, req.body?.guestId, req.get('x-guest-token'));
  if (!guest) return res.status(403).json({ erro: 'Entre no evento antes de denunciar.' });
  const r = registrarDenuncia(req.ev, { fotoId: req.params.pid, guest, motivo: req.body?.motivo });
  if (r.erro) return res.status(r.status).json({ erro: r.erro });
  if (!r.repetida) {
    audit(req, 'foto.denunciada', { foto: req.params.pid, denunciante: 'convidado' });
    save();
    // Aviso ao casal em fila de e-mail (sem copiar a imagem nem o motivo).
    try {
      enfileirarAviso(DATA_DIR, `denuncia-${r.denuncia.id}.json`, {
        para: req.ev.contato || '',
        assunto: 'Uma foto foi denunciada no seu álbum',
        texto: `A foto ${r.denuncia.fotoId} foi denunciada. Revise no painel, em Fotos e recados, e responda em até 48 horas.`,
        criadoEm: clock.iso(),
      });
    } catch {}
  }
  res.status(r.repetida ? 200 : 201).json({ id: r.denuncia.id, repetida: !!r.repetida });
});

app.use((err, req, res, next) => {
  // Corpo JSON malformado: responde 400, padroniza a mensagem e NUNCA loga/ecoa o corpo.
  if (err.type === 'entity.parse.failed') {
    sentry.captureException(err); // mensagem filtrada em src/obs/sentry.js (sem corpo)
    return res.status(400).json({ erro: 'Corpo da requisição inválido.' });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Conteúdo grande demais.' });
  if (err.code === 'LIMIT_FILE_SIZE') {
    if (anotarFalha(req)) return res.status(429).json({ erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' });
    return res.status(413).json({ erro: `Foto muito grande (máx. ${settings.tamanhoMaxFotoMB} MB).` });
  }
  if (err.code && err.code.startsWith('LIMIT_')) {
    if (anotarFalha(req)) return res.status(429).json({ erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' });
    return res.status(400).json({ erro: 'Envio inválido.' });
  }
  sentry.captureException(err); // no-op se SENTRY_DSN não estiver definido
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
  return res.status(403).json({ erro: 'Acesso restrito ao administrador do Lume.' });
}
const resumoEvento = (ev) => ({
  id: ev.id, titulo: ev.titulo, contato: ev.contato || '', criadoEm: ev.createdAt,
  dataEvento: ev.dataEvento, revealAt: ev.revealAt, revelado: revealed(ev), suspenso: !!ev.suspenso,
  fotos: ev.photos.filter((p) => !p.oculta).length, camera: ev.guests.length, lista: ev.lista.length, recados: ev.recados.length,
  equipe: ev.equipe.length,
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
  registrarExclusao(DATA_DIR, { id: req.ev.id, motivo: 'master', em: clock.iso() });
  res.json({ ok: true });
});
// Fotos mais recentes de todos os casamentos, antes de qualquer revelação.
app.get('/api/master/photos', masterOnly, (req, res) => {
  const lim = Math.min(parseInt(req.query.limit, 10) || 60, 300);
  const todas = [];
  for (const ev of Object.values(db.events))
    for (const p of ev.photos) todas.push({ id: p.id, eventoId: ev.id, evento: ev.titulo, autor: p.autor, criadaEm: p.criadaEm, oculta: !!p.oculta, url: `/api/events/${ev.id}/photos/${p.id}/file` });
  todas.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  res.json({ fotos: todas.slice(0, lim), total: todas.length });
});

// ───── PWA e notificações push
const subscriptionOk = (s) => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys && s.keys.p256dh && s.keys.auth;
app.post('/api/events/:id/push/subscribe', getEvent, (req, res) => {
  if (!settings.pushAtivo) return res.status(403).json({ erro: 'Notificações desativadas na plataforma.' });
  const g = autentica(req.ev, req.body.guestId, req.get('x-guest-token'));
  if (!g) return res.status(403).json({ erro: MENSAGENS.semToken });
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
  const linhas = [['Nome', 'Grupo'].map(cel).join(',')];
  req.ev.lista.forEach((l) => linhas.push([l.nome, l.grupo].map(cel).join(',')));
  audit(req, 'lista.exportada', { total: req.ev.lista.length });
  res.type('text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="convidados.csv"').send('﻿' + linhas.join('\r\n'));
});
app.get('/api/events/:id/fotos.zip', getEvent, adminOnly, (req, res) => {
  const ev = req.ev;
  if (!revealed(ev) && !req.admin.master) return res.status(409).json({ erro: 'O álbum só pode ser baixado depois da revelação.' });
  const visiveis = ev.photos.filter((p) => !p.oculta);
  audit(req, 'fotos.baixadas', { total: visiveis.length });
  res.type('application/zip').set('Content-Disposition', `attachment; filename="album-${ev.id}.zip"`);
  const z = new ZipArchive({ store: true });
  z.on('error', () => res.end());
  z.pipe(res);
  const n = {};
  for (const p of ev.photos) {
    if (p.oculta) continue; // foto oculta não entra no álbum: o convidado não a vê
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
  if (!code && recovery) {
    // Código de recuperação: de uso único. O consumo é atômico (compare-and-swap na
    // própria lista de hashes lida), senão dois logins simultâneos usam o mesmo código.
    let hashes = [];
    try { hashes = JSON.parse(m.recuperacao_hashes || '[]'); } catch {}
    const lido = String(m.recuperacao_hashes || '[]');
    for (let i = 0; i < hashes.length; i++) {
      if (await scryptVerify(recovery, hashes[i])) {
        const restantes = hashes.slice();
        restantes.splice(i, 1);
        const r = store.run(
          `UPDATE master_accounts SET recuperacao_hashes = ?, falhas = 0 WHERE id = ? AND recuperacao_hashes = ?`,
          JSON.stringify(restantes), m.id, lido);
        if (r.changes === 1) totpOk = true;
        break;
      }
    }
  } else {
    const v = totpVerify(secret, code, m.totp_ultimo_passo || 0);
    if (v.ok) {
      // Compare-and-swap do passo: só um login consome o mesmo código TOTP.
      const r = store.run(
        `UPDATE master_accounts SET totp_ultimo_passo = ?, falhas = 0 WHERE id = ? AND totp_ultimo_passo < ?`,
        v.step, m.id, v.step);
      if (r.changes === 1) totpOk = true;
    }
  }
  if (!totpOk) {
    store.run(`UPDATE master_accounts SET falhas = falhas + 1 WHERE id = ?`, m.id);
    auditDb(req, 'master', m.id, null, 'login.falha', m.id, { motivo: 'totp' }, 'falha');
    return res.status(401).json({ erro: 'Código 2FA inválido.' });
  }
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
app.get('/painel/:id', page('painel.html'));
app.get('/master', page('master.html'));
app.get('/sw.js', (req, res) => res.set('Service-Worker-Allowed', '/').type('application/javascript').sendFile(path.join(__dirname, 'public', 'sw.js')));
app.get('/embutido.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'src', 'embutido.js')));
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
    // LGPD: com o servidor ativo, os scripts de CLI (retenção, exportar, apagar)
    // recusam rodar — o lock do DATA_DIR é escrito aqui e removido ao encerrar.
    const { escreverLock, removerLock } = require('./src/lgpd/servidor');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    escreverLock(DATA_DIR);
    const encerrar = () => { removerLock(DATA_DIR); process.exit(0); };
    process.once('SIGINT', encerrar);
    process.once('SIGTERM', encerrar);
    process.once('exit', () => removerLock(DATA_DIR));
    sentry.installProcessHooks(); // só com SENTRY_DSN; caso contrário, no-op
    // Fail-closed: produção sem domínio https não sobe (cookie Secure, link mágico e 2FA
    // dependem de PUBLIC_URL https; sem ela o servidor se comportaria como dev).
    if (process.env.NODE_ENV === 'production' && !isProd) {
      console.error('Produção (NODE_ENV=production) exige PUBLIC_URL começando com https:// (fail-closed).');
      process.exit(1);
    }
    if (isProd) {
      if (!process.env.MASTER_TOTP_KEY) { console.error('Produção exige MASTER_TOTP_KEY'); process.exit(1); }
      // Em https o console não entrega nada: exija provedor real (o módulo do #16
      // explica qual variável falta) e só abra exceção para ensaio de deploy.
      if (email.nome === 'desativado') { console.error(`Produção exige provedor de e-mail configurado (${email.desativadoPor})`); process.exit(1); }
      if (!emailReal() && process.env.EMAIL_CONSOLE_PERMITIDO !== 'sim') {
        console.error('Produção exige provedor de e-mail real (EMAIL_PROVIDER=smtp ou resend); o console só vale em dev/teste.');
        process.exit(1);
      }
    }
    await ensureMasterBootstrap();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Lume em http://localhost:${PORT}`);
      console.log('Admin master (login por sessão): http://localhost:' + PORT + '/master');
      if (!isProd) console.log(masterGerado ? `Token estático de desenvolvimento em ${MASTER_FILE} (em https ele não vale)` : process.env.MASTER_TOKEN ? 'Token estático de desenvolvimento vindo de MASTER_TOKEN (em https ele não vale)' : `Token estático de desenvolvimento em ${MASTER_FILE} (em https ele não vale)`);
      if (lanIp()) console.log(`Na mesma rede Wi-Fi (celular): http://${lanIp()}:${PORT}`);
    });
  })();
}
app.store = store;
module.exports = app;
// Exposto para testes de integração (o Store é a fonte da verdade em memória).
module.exports.store = store;
module.exports.criarMaster = criarMasterConta;
module.exports.isProd = isProd;
module.exports.emergenciaAtiva = emergenciaAtiva;
module.exports.aceitaTokenEstatico = aceitaTokenEstatico;
module.exports.clearRateLimits = () => { rl.clear(); rlCriacao.clear(); rlLogin.clear(); };
