'use strict';
// Rate limit em memória para a criação aberta de eventos.
// Chaves por hash curto de IP (nunca o IP puro) e por e-mail, mais um teto
// diário por IP. Tetos configuráveis por ambiente; janela deslizante.
const crypto = require('crypto');

const JANELA_PADRAO_MS = 10 * 60 * 1000; // 10 minutos
const DIA_MS = 24 * 60 * 60 * 1000;
const PADROES = { maxPorIp: 5, maxPorEmail: 3, maxDiarioPorIp: 20, janelaMs: JANELA_PADRAO_MS };

const inteiro = (valor, padrao) => {
  const n = parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : padrao;
};

// No ambiente de teste, limites não configurados explicitamente são infinitos,
// para as suítes existentes criarem eventos livremente. Fora de teste (ou com a
// variável definida) valem os padrões/tetos reais.
const teto = (env, chave, padrao) => {
  if (env.NODE_ENV === 'test' && (env[chave] === undefined || env[chave] === '')) return Infinity;
  return inteiro(env[chave], padrao);
};

function hashIp(ip, salt) {
  if (!ip) return null;
  const base = String(ip).replace(/^::ffff:/, '');
  return crypto.createHash('sha256').update(`${salt}:${base}`).digest('hex').slice(0, 12);
}

function normalizarEmail(v) {
  if (!v || typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return s ? s.slice(0, 120) : null;
}

function createLimites({ env = process.env, agora = () => Date.now(), salt, config } = {}) {
  const cfg = {
    maxPorIp: teto(env, 'ANTISPAM_MAX_IP', PADROES.maxPorIp),
    maxPorEmail: teto(env, 'ANTISPAM_MAX_EMAIL', PADROES.maxPorEmail),
    maxDiarioPorIp: teto(env, 'ANTISPAM_MAX_DIA_IP', PADROES.maxDiarioPorIp),
    janelaMs: inteiro(env.ANTISPAM_JANELA_MIN, PADROES.janelaMs / 60000) * 60000,
    ...config,
  };
  const segredo = salt || crypto.randomBytes(16).toString('hex');
  const porIp = new Map();
  const porEmail = new Map();
  const diaIp = new Map();

  const recentes = (mapa, chave, janela) => {
    const t = agora();
    const lista = (mapa.get(chave) || []).filter((x) => t - x < janela);
    mapa.set(chave, lista);
    return lista;
  };

  function checar({ ip, email } = {}) {
    const ipH = hashIp(ip, segredo);
    const em = normalizarEmail(email);
    if (ipH) {
      if (recentes(porIp, ipH, cfg.janelaMs).length >= cfg.maxPorIp)
        return { ok: false, status: 429, erro: 'Muitos casamentos criados deste dispositivo em pouco tempo. Tente de novo em alguns minutos.' };
      if (recentes(diaIp, ipH, DIA_MS).length >= cfg.maxDiarioPorIp)
        return { ok: false, status: 429, erro: 'Você atingiu o limite diário de novos casamentos. Tente novamente amanhã.' };
    }
    if (em && recentes(porEmail, em, cfg.janelaMs).length >= cfg.maxPorEmail)
      return { ok: false, status: 429, erro: 'Muitos casamentos criados com este e-mail em pouco tempo. Tente de novo em alguns minutos.' };
    return { ok: true, chaves: { ipH, email: em } };
  }

  function registrar({ ipH, email } = {}) {
    const t = agora();
    if (ipH) { recentes(porIp, ipH, cfg.janelaMs).push(t); recentes(diaIp, ipH, DIA_MS).push(t); }
    if (email) recentes(porEmail, email, cfg.janelaMs).push(t);
  }

  return { checar, registrar, cfg, hashIp: (ip) => hashIp(ip, segredo) };
}

module.exports = { createLimites, hashIp, normalizarEmail, PADROES, DIA_MS };
